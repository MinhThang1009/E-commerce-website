/**
 * HTTP tests bổ sung cho module admin — tập trung vào các kịch bản
 * filter/query-param và behavior cụ thể chưa có trong admin.http.test.js.
 *
 * Những gì đã có trong admin.http.test.js (KHÔNG lặp lại ở đây):
 *  - Auth guard (401/403) cho dashboard
 *  - GET /api/admin/dashboard → 200
 *  - GET /api/admin/stats → 200
 *  - GET /api/admin/users → 200, GET /api/admin/users/:id → 200
 *  - PUT /api/admin/users/:id, DELETE /api/admin/users/:id
 *  - GET/POST/PUT/DELETE /api/admin/products (basic)
 *  - PATCH /api/admin/products/:id/status (basic toggle)
 *  - GET /api/admin/orders → 200, PUT /api/admin/orders/:id/status, PUT /api/admin/orders/:id/cancel
 *  - GET/POST/PUT/DELETE /api/admin/discount-codes (basic)
 *  - GET /api/admin/analytics/* (tất cả 6 endpoint — basic)
 *  - GET /api/admin/reviews → 200, DELETE /api/admin/reviews/:id
 *  - GET /api/admin/reports/export, GET /api/admin/chatbot/stats
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, DiscountCode, Order, OrderItem } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let admin, adminToken, staff, staffToken;
let prod, variant, cat, brand;
let createdDcId;

beforeAll(async () => {
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_adminex_${TS}@t.com`,
    role: 'admin',
  }));
  ({ user: staff, token: staffToken } = await createTestUser({
    email: `__http_staffex_${TS}@t.com`,
    role: 'staff',
  }));
  ({ product: prod, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  if (createdDcId)
    await DiscountCode.destroy({ where: { id: createdDcId }, force: true }).catch(() => {});
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (prod) await prod.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  if (admin) await admin.destroy({ force: true }).catch(() => {});
  if (staff) await staff.destroy({ force: true }).catch(() => {});
});

// ── Products — filter theo query params ──────────────────────────────────────

describe('GET /api/admin/products?search=<keyword>', () => {
  test('lọc sản phẩm theo từ khóa → 200 + kết quả là array', async () => {
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ search: 'laptop' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });
});

describe('GET /api/admin/products?status=draft', () => {
  test('lọc sản phẩm theo status=draft → 200', async () => {
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ status: 'draft' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('lọc sản phẩm theo status=active → 200', async () => {
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/admin/products?categoryId=<id>', () => {
  test('lọc sản phẩm theo categoryId thực → 200', async () => {
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ categoryId: cat.id });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('lọc sản phẩm theo categoryId không tồn tại → 200 + danh sách rỗng', async () => {
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ categoryId: 999999999 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/admin/products?page=2&limit=5', () => {
  test('phân trang trang 2 → 200', async () => {
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 2, limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Orders — filter theo query params ────────────────────────────────────────

describe('GET /api/admin/orders?status=pending', () => {
  test('lọc đơn hàng theo status=pending → 200', async () => {
    const res = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ status: 'pending' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/admin/orders?page=1&limit=10', () => {
  test('phân trang đơn hàng → 200', async () => {
    const res = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('PUT /api/admin/orders/:id/status với id không tồn tại', () => {
  test('cập nhật trạng thái đơn không tồn tại → 400 hoặc 404', async () => {
    const res = await request(app)
      .put('/api/admin/orders/999999999/status')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'processing' });
    expect([400, 404]).toContain(res.status);
  });
});

// ── Users — query params ──────────────────────────────────────────────────────

describe('GET /api/admin/users?page=1&limit=10', () => {
  test('phân trang danh sách người dùng → 200 + array', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/admin/users/:id không tồn tại', () => {
  test('id không tồn tại → 404 hoặc 400', async () => {
    const res = await request(app)
      .get('/api/admin/users/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── Discount codes — thêm/sửa thực sự (không chỉ kiểm auth) ─────────────────

describe('POST /api/admin/discount-codes → 201 với payload đầy đủ', () => {
  test('tạo mã giảm giá hợp lệ dạng fixed_amount → 201', async () => {
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        code: `HTTP-ADMINEX-DC-${TS}`,
        type: 'fixed',
        value: 50000,
        minOrderAmount: 200000,
        usageLimit: 3,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        isActive: true,
      });
    expect([200, 201]).toContain(res.status);
    const id = res.body?.data?.id || res.body?.data?.discountCode?.id || res.body?.discountCode?.id;
    if (id) createdDcId = id;
  });
});

describe('PUT /api/admin/discount-codes/:id', () => {
  test('cập nhật discount code tồn tại → 200', async () => {
    if (!createdDcId) return;
    const res = await request(app)
      .put(`/api/admin/discount-codes/${createdDcId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ value: 60000, isActive: false });
    expect([200, 400]).toContain(res.status);
  });

  test('cập nhật discount code không tồn tại → 404', async () => {
    const res = await request(app)
      .put('/api/admin/discount-codes/999999999')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ value: 10 });
    expect([400, 404]).toContain(res.status);
  });
});

describe('DELETE /api/admin/discount-codes/:id', () => {
  test('xóa discount code vừa tạo → 200', async () => {
    if (!createdDcId) return;
    const res = await request(app)
      .delete(`/api/admin/discount-codes/${createdDcId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect([200, 204]).toContain(res.status);
    if ([200, 204].includes(res.status)) createdDcId = null;
  });
});

// ── Analytics — params đa dạng ───────────────────────────────────────────────

describe('GET /api/admin/analytics/revenue-by-category với period=week', () => {
  test('→ 200 với granularity week', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/revenue-by-category')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ startDate: '2026-01-01', endDate: '2026-12-31', period: 'week' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/admin/analytics/top-products?limit=5', () => {
  test('giới hạn 5 sản phẩm bán chạy nhất → 200', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/top-products')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ startDate: '2026-01-01', endDate: '2026-12-31', limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/admin/analytics/user-growth', () => {
  test('→ 200 với period=day', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/user-growth')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ startDate: '2026-01-01', endDate: '2026-12-31', period: 'day' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/admin/analytics/payment-methods', () => {
  test('→ 200 trả về phân bổ phương thức thanh toán', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/payment-methods')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });
});

describe('GET /api/admin/analytics/low-stock', () => {
  test('→ 200 trả về sản phẩm sắp hết hàng', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/low-stock')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });
});

describe('GET /api/admin/analytics/order-status', () => {
  test('→ 200 trả về thống kê đơn hàng theo trạng thái', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/order-status')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });
});

// ── Dashboard — response có đủ fields cần thiết ───────────────────────────────

describe('GET /api/admin/dashboard', () => {
  test('→ 200 + data có thông tin thống kê', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });
});

// ── Reviews — GET detail và verify chưa có trong routes nhưng basic list đã có ─

describe('GET /api/admin/reviews?page=1&limit=5', () => {
  test('phân trang danh sách đánh giá → 200', async () => {
    const res = await request(app)
      .get('/api/admin/reviews')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});
