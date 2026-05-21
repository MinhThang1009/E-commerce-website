require('module-alias/register');
// Tắt embedding providers trước khi app load — tránh network call chậm trong afterUpdate hook
process.env.JINA_API_KEY = '';
process.env.HF_API_KEY = '';
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, InventoryLog, Category, Brand, Product, ProductVariant } = require('@models');

const TS = Date.now();
let admin, adminToken, customer, customerToken;
let prod, variant, cat, brand;

beforeAll(async () => {
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_inv_admin_${TS}@t.com`,
    role: 'admin',
  }));
  ({ user: customer, token: customerToken } = await createTestUser({
    email: `__http_inv_cust_${TS}@t.com`,
    role: 'customer',
  }));
  // status 'inactive' để hook afterUpdate không gọi vector store (tránh network call chậm)
  ({ product: prod, variant, cat, brand } = await createTestProduct({ status: 'inactive' }));
});

afterAll(async () => {
  if (prod)
    await InventoryLog.destroy({ where: { productId: prod.id }, force: true }).catch(() => {});
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (prod) await prod.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  if (admin) await admin.destroy({ force: true }).catch(() => {});
  if (customer) await customer.destroy({ force: true }).catch(() => {});
});

// ── Auth guard chung ─────────────────────────────────────────
describe('Inventory auth guard', () => {
  test('GET /api/inventory/logs không token → 401', async () => {
    const res = await request(app).get('/api/inventory/logs');
    expect(res.status).toBe(401);
  });

  test('GET /api/inventory/logs customer token → 403', async () => {
    const res = await request(app)
      .get('/api/inventory/logs')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  test('POST /api/inventory/products/:id/restock không token → 401', async () => {
    const res = await request(app)
      .post(`/api/inventory/products/${prod.id}/restock`)
      .send({ quantity: 10, note: 'test' });
    expect(res.status).toBe(401);
  });

  test('POST /api/inventory/products/:id/restock customer token → 403', async () => {
    const res = await request(app)
      .post(`/api/inventory/products/${prod.id}/restock`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 10, note: 'test' });
    expect(res.status).toBe(403);
  });
});

// ── GET /api/inventory/logs ──────────────────────────────────
describe('GET /api/inventory/logs', () => {
  test('admin → 200 + trả về dữ liệu hợp lệ', async () => {
    const res = await request(app)
      .get('/api/inventory/logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('admin + query page/limit → 200', async () => {
    const res = await request(app)
      .get('/api/inventory/logs?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

// ── POST /api/inventory/products/:productId/restock ──────────
describe('POST /api/inventory/products/:productId/restock', () => {
  test('productId không tồn tại → 404', async () => {
    const res = await request(app)
      .post('/api/inventory/products/999999999/restock')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 10, note: 'nhập kho test' });
    expect(res.status).toBe(404);
  });

  // BUG: createInventoryLog trong inventory-service.js không nhận transaction opts →
  // FK constraint check trên products row bị lock bởi transaction → ER_LOCK_WAIT_TIMEOUT (50s).
  // Cần fix: truyền { transaction: tx } vào createInventoryLog(..., opts).
  // TODO(inventory): bỏ skip sau khi sửa bug transaction trong inventory-service.js
  test('productId hợp lệ + quantity hợp lệ → 200', async () => {
    const res = await request(app)
      .post(`/api/inventory/products/${prod.id}/restock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 20, note: '__HTTP_INV_RESTOCK_TEST' });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  test('restock tạo inventory log trong DB', async () => {
    await request(app)
      .post(`/api/inventory/products/${prod.id}/restock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 5, note: `__HTTP_INV_LOG_CHECK_${TS}` });

    const log = await InventoryLog.findOne({
      where: { productId: prod.id, note: `__HTTP_INV_LOG_CHECK_${TS}` },
    });
    expect(log).not.toBeNull();
    expect(log.changeAmount).toBeGreaterThan(0);
  });
});
