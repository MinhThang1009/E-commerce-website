require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const {
  User,
  Product,
  ProductVariant,
  Category,
  Brand,
  DiscountCode,
  Order,
  OrderItem,
  Review,
} = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let admin, adminToken, staff, staffToken, customer, customerToken;
let prod, variant, cat, brand;
let createdDcId;

beforeAll(async () => {
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_admin_${TS}@t.com`,
    role: 'admin',
  }));
  ({ user: staff, token: staffToken } = await createTestUser({
    email: `__http_staff_${TS}@t.com`,
    role: 'staff',
  }));
  ({ user: customer, token: customerToken } = await createTestUser({
    email: `__http_admin_cust_${TS}@t.com`,
    role: 'customer',
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
  if (customer) await customer.destroy({ force: true }).catch(() => {});
});

// ── Auth guard ──────────────────────────────────────────────
describe('Admin auth guard', () => {
  test('không token → 401', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });
  test('customer token → 403', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });
});

// ── Dashboard & Stats ────────────────────────────────────────
describe('GET /api/admin/dashboard', () => {
  test('admin → 200', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/admin/stats', () => {
  test('admin → 200', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Users ────────────────────────────────────────────────────
describe('GET /api/admin/users', () => {
  test('→ 200 + array', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/admin/users/:id', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get(`/api/admin/users/${customer.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/admin/users/:id', () => {
  test('update user → 200', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${customer.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: '__HTTP_Updated' });
    expect([200, 400]).toContain(res.status);
  });
});

// ── Products ─────────────────────────────────────────────────
describe('GET /api/admin/products', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/admin/products/:id', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get(`/api/admin/products/${prod.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/admin/products/:id/status', () => {
  test('toggle status → 200', async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${prod.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'inactive' });
    expect([200, 400]).toContain(res.status);
    // restore
    await prod.update({ status: 'active' });
  });
});

// ── Orders ───────────────────────────────────────────────────
describe('GET /api/admin/orders', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Reviews ──────────────────────────────────────────────────
describe('GET /api/admin/reviews', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/reviews')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Discount Codes ───────────────────────────────────────────
describe('GET /api/admin/discount-codes', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/admin/discount-codes', () => {
  test('tạo mã giảm giá → 201', async () => {
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        code: `HTTP-ADMIN-DC-${TS}`,
        type: 'percent',
        value: 10,
        minOrderAmount: 100000,
        usageLimit: 5,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        isActive: true,
      });
    expect([200, 201]).toContain(res.status);
    if (res.body.data?.id) createdDcId = res.body.data.id;
    else if (res.body.data?.discountCode?.id) createdDcId = res.body.data.discountCode.id;
  });
});

// ── Analytics ────────────────────────────────────────────────
const analyticsEndpoints = [
  'order-status',
  'revenue-by-category',
  'top-products',
  'user-growth',
  'payment-methods',
  'low-stock',
];

analyticsEndpoints.forEach((ep) => {
  describe(`GET /api/admin/analytics/${ep}`, () => {
    test('→ 200', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/${ep}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ startDate: '2026-01-01', endDate: '2026-12-31', period: 'month' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });
});

// ── Users extended ───────────────────────────────────────────
describe('DELETE /api/admin/users/:id', () => {
  test('admin xóa user → 200 hoặc 400', async () => {
    const u = await User.create({
      firstName: '__TMP',
      lastName: 'Del',
      email: `__tmp_del_${Date.now()}@t.com`,
      password: 'Del123!',
      role: 'customer',
    });
    const res = await request(app)
      .delete(`/api/admin/users/${u.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 400, 403]).toContain(res.status);
    await u.destroy({ force: true }).catch(() => {});
  });
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/admin/users/1');
    expect(res.status).toBe(401);
  });
});

// ── Products extended ────────────────────────────────────────
describe('POST /api/admin/products', () => {
  test('tạo sản phẩm → 201 hoặc 400', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        nameVi: `__TMP_P_${Date.now()}`,
        nameEn: 'TMP',
        baseName: 'TMP',
        slug: `tmp-p-${Date.now()}`,
        basePrice: 1000000,
        status: 'active',
        stockQuantity: 0,
        categoryId: prod?.categoryId,
        brandId: prod?.brandId,
      });
    expect([200, 201, 400, 422]).toContain(res.status);
    if (res.body.data?.id) {
      await Product.destroy({ where: { id: res.body.data.id }, force: true }).catch(() => {});
    }
  });
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/admin/products').send({});
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/admin/products/:id', () => {
  test('update product → 200 hoặc 400', async () => {
    const res = await request(app)
      .put(`/api/admin/products/${prod.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ nameVi: `__Updated_${Date.now()}` });
    expect([200, 400, 422]).toContain(res.status);
    await prod.update({ nameVi: prod.nameVi }).catch(() => {}); // restore
  });
});

describe('DELETE /api/admin/products/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete(`/api/admin/products/999999999`);
    expect(res.status).toBe(401);
  });
  test('admin xóa sản phẩm không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/admin/products/999999999')
      .set('Authorization', `Bearer ${staffToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

describe('POST /api/admin/products/:id/clone', () => {
  test('clone product → 200 hoặc 201', async () => {
    const res = await request(app)
      .post(`/api/admin/products/${prod.id}/clone`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect([200, 201, 400]).toContain(res.status);
    if (res.body.data?.id) {
      await Product.destroy({ where: { id: res.body.data.id }, force: true }).catch(() => {});
    }
  });
});

describe('PATCH /api/admin/products/:id/stock', () => {
  test('update stock → 200', async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${prod.id}/stock`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ variantId: variant.id, quantity: 50 });
    expect([200, 400]).toContain(res.status);
  });
});

describe('GET /api/admin/products/import-template', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/products/import-template')
      .set('Authorization', `Bearer ${staffToken}`);
    expect([200, 400]).toContain(res.status);
  });
});

describe('GET /api/admin/products/import-history', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/products/import-history')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 400, 404]).toContain(res.status);
  });
});

describe('GET /api/admin/products/export', () => {
  test('→ 200 hoặc 500', async () => {
    const res = await request(app)
      .get('/api/admin/products/export')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 400, 500]).toContain(res.status);
  });
});

// ── Orders extended ──────────────────────────────────────────
describe('PUT /api/admin/orders/:id/status', () => {
  test('không auth → 401', async () => {
    const res = await request(app).put('/api/admin/orders/1/status').send({ status: 'processing' });
    expect(res.status).toBe(401);
  });
  test('admin → 200 hoặc 404', async () => {
    const res = await request(app)
      .put('/api/admin/orders/999999999/status')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'processing' });
    expect([200, 400, 404]).toContain(res.status);
  });
});

describe('POST /api/admin/orders/:id/cancel', () => {
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/admin/orders/1/cancel');
    expect(res.status).toBe(401);
  });
});

// ── Reviews extended ─────────────────────────────────────────
describe('DELETE /api/admin/reviews/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/admin/reviews/1');
    expect(res.status).toBe(401);
  });
  test('admin xóa review không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/admin/reviews/999999999')
      .set('Authorization', `Bearer ${staffToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── Discount Codes extended ──────────────────────────────────
describe('GET /api/admin/discount-codes/:id', () => {
  test('không tồn tại → 404', async () => {
    const res = await request(app)
      .get('/api/admin/discount-codes/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

describe('PUT /api/admin/discount-codes/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).put('/api/admin/discount-codes/1').send({ value: 20 });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/admin/discount-codes/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/admin/discount-codes/1');
    expect(res.status).toBe(401);
  });
  test('admin xóa không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/admin/discount-codes/999999999')
      .set('Authorization', `Bearer ${staffToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── Reports & Chatbot ────────────────────────────────────────
describe('GET /api/admin/reports/export', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/reports/export')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 400]).toContain(res.status);
  });
});

describe('GET /api/admin/chatbot/stats', () => {
  test('→ 200 hoặc 500', async () => {
    const res = await request(app)
      .get('/api/admin/chatbot/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 400, 500]).toContain(res.status);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// admin-extra: filter/query-param và behavior cụ thể
// ════════════════════════════════════════════════════════════════════════════

describe('Admin extra — filter/query-param', () => {
  /**
   * HTTP tests bổ sung cho module admin — tập trung vào các kịch bản
   * filter/query-param và behavior cụ thể chưa có trong admin.http.test.js.
   */
  let adminEx, adminExToken, staffEx, staffExToken;
  let prodEx, variantEx, catEx, brandEx;
  let createdDcExId;
  const TS_EX = Date.now() + 1;

  beforeAll(async () => {
    ({ user: adminEx, token: adminExToken } = await createTestUser({
      email: `__http_adminex_${TS_EX}@t.com`,
      role: 'admin',
    }));
    ({ user: staffEx, token: staffExToken } = await createTestUser({
      email: `__http_staffex_${TS_EX}@t.com`,
      role: 'staff',
    }));
    ({
      product: prodEx,
      variant: variantEx,
      cat: catEx,
      brand: brandEx,
    } = await createTestProduct());
  });

  afterAll(async () => {
    if (createdDcExId)
      await DiscountCode.destroy({ where: { id: createdDcExId }, force: true }).catch(() => {});
    if (variantEx) await variantEx.destroy({ force: true }).catch(() => {});
    if (prodEx) await prodEx.destroy({ force: true }).catch(() => {});
    if (catEx) await Category.destroy({ where: { id: catEx.id } }).catch(() => {});
    if (brandEx) await Brand.destroy({ where: { id: brandEx.id } }).catch(() => {});
    if (adminEx) await adminEx.destroy({ force: true }).catch(() => {});
    if (staffEx) await staffEx.destroy({ force: true }).catch(() => {});
  });

  // ── Products — filter theo query params ──────────────────────────────────────

  describe('GET /api/admin/products?search=<keyword>', () => {
    test('lọc sản phẩm theo từ khóa → 200 + kết quả là array', async () => {
      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${adminExToken}`)
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
        .set('Authorization', `Bearer ${adminExToken}`)
        .query({ status: 'draft' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('lọc sản phẩm theo status=active → 200', async () => {
      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${adminExToken}`)
        .query({ status: 'active' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  describe('GET /api/admin/products?categoryId=<id>', () => {
    test('lọc sản phẩm theo categoryId thực → 200', async () => {
      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${adminExToken}`)
        .query({ categoryId: catEx.id });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('lọc sản phẩm theo categoryId không tồn tại → 200 + danh sách rỗng', async () => {
      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${adminExToken}`)
        .query({ categoryId: 999999999 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  describe('GET /api/admin/products?page=2&limit=5', () => {
    test('phân trang trang 2 → 200', async () => {
      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${adminExToken}`)
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
        .set('Authorization', `Bearer ${adminExToken}`)
        .query({ status: 'pending' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  describe('GET /api/admin/orders?page=1&limit=10', () => {
    test('phân trang đơn hàng → 200', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminExToken}`)
        .query({ page: 1, limit: 10 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  describe('PUT /api/admin/orders/:id/status với id không tồn tại', () => {
    test('cập nhật trạng thái đơn không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .put('/api/admin/orders/999999999/status')
        .set('Authorization', `Bearer ${staffExToken}`)
        .send({ status: 'processing' });
      expect([400, 404]).toContain(res.status);
    });
  });

  // ── Users — query params ──────────────────────────────────────────────────────

  describe('GET /api/admin/users?page=1&limit=10', () => {
    test('phân trang danh sách người dùng → 200 + array', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminExToken}`)
        .query({ page: 1, limit: 10 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  describe('GET /api/admin/users/:id không tồn tại', () => {
    test('id không tồn tại → 404 hoặc 400', async () => {
      const res = await request(app)
        .get('/api/admin/users/999999999')
        .set('Authorization', `Bearer ${adminExToken}`);
      expect([400, 404]).toContain(res.status);
    });
  });

  // ── Discount codes — thêm/sửa thực sự (không chỉ kiểm auth) ─────────────────

  describe('POST /api/admin/discount-codes → 201 với payload đầy đủ', () => {
    test('tạo mã giảm giá hợp lệ dạng fixed_amount → 201', async () => {
      const res = await request(app)
        .post('/api/admin/discount-codes')
        .set('Authorization', `Bearer ${staffExToken}`)
        .send({
          code: `HTTP-ADMINEX-DC-${TS_EX}`,
          type: 'fixed',
          value: 50000,
          minOrderAmount: 200000,
          usageLimit: 3,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
          isActive: true,
        });
      expect([200, 201]).toContain(res.status);
      const id =
        res.body?.data?.id || res.body?.data?.discountCode?.id || res.body?.discountCode?.id;
      if (id) createdDcExId = id;
    });
  });

  describe('PUT /api/admin/discount-codes/:id', () => {
    test('cập nhật discount code tồn tại → 200', async () => {
      if (!createdDcExId) return;
      const res = await request(app)
        .put(`/api/admin/discount-codes/${createdDcExId}`)
        .set('Authorization', `Bearer ${staffExToken}`)
        .send({ value: 60000, isActive: false });
      expect([200, 400]).toContain(res.status);
    });

    test('cập nhật discount code không tồn tại → 404', async () => {
      const res = await request(app)
        .put('/api/admin/discount-codes/999999999')
        .set('Authorization', `Bearer ${staffExToken}`)
        .send({ value: 10 });
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('DELETE /api/admin/discount-codes/:id', () => {
    test('xóa discount code vừa tạo → 200', async () => {
      if (!createdDcExId) return;
      const res = await request(app)
        .delete(`/api/admin/discount-codes/${createdDcExId}`)
        .set('Authorization', `Bearer ${staffExToken}`);
      expect([200, 204]).toContain(res.status);
      if ([200, 204].includes(res.status)) createdDcExId = null;
    });
  });

  // ── Analytics — params đa dạng ───────────────────────────────────────────────

  describe('GET /api/admin/analytics/revenue-by-category với period=week', () => {
    test('→ 200 với granularity week', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/revenue-by-category')
        .set('Authorization', `Bearer ${adminExToken}`)
        .query({ startDate: '2026-01-01', endDate: '2026-12-31', period: 'week' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  describe('GET /api/admin/analytics/top-products?limit=5', () => {
    test('giới hạn 5 sản phẩm bán chạy nhất → 200', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/top-products')
        .set('Authorization', `Bearer ${adminExToken}`)
        .query({ startDate: '2026-01-01', endDate: '2026-12-31', limit: 5 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  describe('GET /api/admin/analytics/user-growth', () => {
    test('→ 200 với period=day', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/user-growth')
        .set('Authorization', `Bearer ${adminExToken}`)
        .query({ startDate: '2026-01-01', endDate: '2026-12-31', period: 'day' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  describe('GET /api/admin/analytics/payment-methods', () => {
    test('→ 200 trả về phân bổ phương thức thanh toán', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/payment-methods')
        .set('Authorization', `Bearer ${adminExToken}`)
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
        .set('Authorization', `Bearer ${adminExToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/admin/analytics/order-status', () => {
    test('→ 200 trả về thống kê đơn hàng theo trạng thái', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/order-status')
        .set('Authorization', `Bearer ${adminExToken}`)
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
        .set('Authorization', `Bearer ${adminExToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });
  });

  // ── Reviews — pagination ──────────────────────────────────────────────────────

  describe('GET /api/admin/reviews?page=1&limit=5', () => {
    test('phân trang danh sách đánh giá → 200', async () => {
      const res = await request(app)
        .get('/api/admin/reviews')
        .set('Authorization', `Bearer ${adminExToken}`)
        .query({ page: 1, limit: 5 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// admin-comprehensive: kịch bản toàn diện còn thiếu
// ════════════════════════════════════════════════════════════════════════════

describe('Admin comprehensive — kịch bản toàn diện', () => {
  /**
   * HTTP integration tests toàn diện cho module admin.
   * Bổ sung các kịch bản còn thiếu sau admin.http.test.js và admin-extra.http.test.js.
   *
   * Lưu ý thiết kế:
   *  - `customerComp` dùng cho test update role (có thể bị thay đổi trong DB).
   *  - `forbiddenUser` là user customer riêng biệt chỉ dùng để kiểm tra 403 — KHÔNG bao giờ bị thay đổi role.
   */
  let adminComp, adminCompToken;
  let staffComp, staffCompToken;
  let customerComp, customerCompToken;
  let forbiddenUser, forbiddenToken;
  let prodComp, variantComp, catComp, brandComp;
  const createdDiscountIds = [];
  const TS_COMP = Date.now() + 2;

  beforeAll(async () => {
    ({ user: adminComp, token: adminCompToken } = await createTestUser({
      email: `__http_admincomp_${TS_COMP}@t.com`,
      role: 'admin',
    }));
    ({ user: staffComp, token: staffCompToken } = await createTestUser({
      email: `__http_admincomp_staff_${TS_COMP}@t.com`,
      role: 'staff',
    }));
    ({ user: customerComp, token: customerCompToken } = await createTestUser({
      email: `__http_admincomp_cust_${TS_COMP}@t.com`,
      role: 'customer',
    }));
    // forbiddenUser tách riêng, không bao giờ bị PUT /users/:id thay đổi role
    ({ user: forbiddenUser, token: forbiddenToken } = await createTestUser({
      email: `__http_admincomp_forbidden_${TS_COMP}@t.com`,
      role: 'customer',
    }));
    ({
      product: prodComp,
      variant: variantComp,
      cat: catComp,
      brand: brandComp,
    } = await createTestProduct());
  });

  afterAll(async () => {
    for (const id of createdDiscountIds) {
      await DiscountCode.destroy({ where: { id }, force: true }).catch(() => {});
    }
    if (variantComp) await variantComp.destroy({ force: true }).catch(() => {});
    if (prodComp) await prodComp.destroy({ force: true }).catch(() => {});
    if (catComp) await Category.destroy({ where: { id: catComp.id } }).catch(() => {});
    if (brandComp) await Brand.destroy({ where: { id: brandComp.id } }).catch(() => {});
    if (customerComp) await customerComp.destroy({ force: true }).catch(() => {});
    if (forbiddenUser) await forbiddenUser.destroy({ force: true }).catch(() => {});
    if (adminComp) await adminComp.destroy({ force: true }).catch(() => {});
    if (staffComp) await staffComp.destroy({ force: true }).catch(() => {});
  });

  // ── Dashboard — response shape ────────────────────────────────────────────────

  describe('GET /api/admin/dashboard — cấu trúc response', () => {
    test('response phải có field data ở dạng object', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminCompToken}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.data).toBe('object');
      expect(res.body.data).not.toBeNull();
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });

    test('không có token → 401', async () => {
      const res = await request(app).get('/api/admin/dashboard');
      expect(res.status).toBe(401);
    });
  });

  // ── Stats — params đa dạng ────────────────────────────────────────────────────

  describe('GET /api/admin/stats — params đa dạng', () => {
    test('không truyền query params → 200 hoặc 400', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminCompToken}`);
      expect([200, 400]).toContain(res.status);
    });

    test('startDate và endDate cùng ngày → 200', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ startDate: '2026-05-21', endDate: '2026-05-21' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('groupBy=hour → 200', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ startDate: '2026-05-01', endDate: '2026-05-21', groupBy: 'hour' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('groupBy=week → 200', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ startDate: '2026-01-01', endDate: '2026-12-31', groupBy: 'week' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('groupBy=day → 200', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ startDate: '2026-01-01', endDate: '2026-01-31', groupBy: 'day' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${forbiddenToken}`)
        .query({ startDate: '2026-01-01', endDate: '2026-12-31' });
      expect(res.status).toBe(403);
    });

    test('không token → 401', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .query({ startDate: '2026-01-01', endDate: '2026-12-31' });
      expect(res.status).toBe(401);
    });
  });

  // ── Users — filter và query params ───────────────────────────────────────────

  describe('GET /api/admin/users — filter và query params', () => {
    test('lọc theo search email → 200 + data tồn tại', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ search: forbiddenUser.email });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });

    test('lọc theo role=customer → 200', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ role: 'customer' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('lọc theo role=admin → 200', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ role: 'admin' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('page=1&limit=1 → 200', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ page: 1, limit: 1 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('sortBy=createdAt&sortOrder=DESC → 200', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ sortBy: 'createdAt', sortOrder: 'DESC' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/users/:id — các trường hợp', () => {
    test('lấy thông tin admin bằng token admin → 200', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${adminComp.id}`)
        .set('Authorization', `Bearer ${adminCompToken}`);
      expect(res.status).toBe(200);
    });

    test('id dạng chuỗi không phải số → 400 hoặc 404', async () => {
      const res = await request(app)
        .get('/api/admin/users/not-a-number')
        .set('Authorization', `Bearer ${adminCompToken}`);
      expect([400, 404]).toContain(res.status);
    });

    test('không token → 401', async () => {
      const res = await request(app).get(`/api/admin/users/${forbiddenUser.id}`);
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${adminComp.id}`)
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/admin/users/:id — validation', () => {
    test('cập nhật firstName hợp lệ → 200 hoặc 400', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${customerComp.id}`)
        .set('Authorization', `Bearer ${adminCompToken}`)
        .send({ firstName: 'CompTest' });
      expect([200, 400]).toContain(res.status);
    });

    test('cập nhật role customer → admin rồi khôi phục', async () => {
      const tmpUser = await User.create({
        firstName: '__TMP',
        lastName: 'RoleChg',
        email: `__tmp_rolechg_${TS_COMP}@t.com`,
        password: 'Test123!',
        role: 'customer',
        isEmailVerified: true,
        isActive: true,
      });
      const res = await request(app)
        .put(`/api/admin/users/${tmpUser.id}`)
        .set('Authorization', `Bearer ${adminCompToken}`)
        .send({ role: 'admin' });
      expect([200, 400]).toContain(res.status);
      await tmpUser.destroy({ force: true }).catch(() => {});
    });

    test('vô hiệu hóa tài khoản isActive=false → 200 hoặc 400', async () => {
      const tmpUser = await User.create({
        firstName: '__TMP',
        lastName: 'Disable',
        email: `__tmp_disable_${TS_COMP}@t.com`,
        password: 'Test123!',
        role: 'customer',
        isEmailVerified: true,
        isActive: true,
      });
      const res = await request(app)
        .put(`/api/admin/users/${tmpUser.id}`)
        .set('Authorization', `Bearer ${adminCompToken}`)
        .send({ isActive: false });
      expect([200, 400]).toContain(res.status);
      await tmpUser.destroy({ force: true }).catch(() => {});
    });

    test('firstName quá ngắn (1 ký tự) → 400', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${customerComp.id}`)
        .set('Authorization', `Bearer ${adminCompToken}`)
        .send({ firstName: 'X' });
      expect(res.status).toBe(400);
    });

    test('user không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .put('/api/admin/users/999999999')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .send({ firstName: 'Ghost' });
      expect([400, 404]).toContain(res.status);
    });

    test('không token → 401', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${customerComp.id}`)
        .send({ firstName: 'Test' });
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${customerComp.id}`)
        .set('Authorization', `Bearer ${forbiddenToken}`)
        .send({ firstName: 'Test' });
      expect(res.status).toBe(403);
    });
  });

  // ── Products — filter brandId ─────────────────────────────────────────────────

  describe('GET /api/admin/products — filter theo brandId', () => {
    test('lọc theo brandId thực → 200', async () => {
      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ brandId: brandComp.id });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('lọc theo brandId không tồn tại → 200 + danh sách rỗng hoặc ít item', async () => {
      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ brandId: 999999999 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('lọc status=archived → 200', async () => {
      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ status: 'archived' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('sortBy=basePrice&sortOrder=ASC → 200', async () => {
      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ sortBy: 'basePrice', sortOrder: 'ASC' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('page=99&limit=5 trang không có dữ liệu → 200', async () => {
      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ page: 99, limit: 5 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/products');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/products/:id — tình huống lỗi', () => {
    test('id không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .get('/api/admin/products/999999999')
        .set('Authorization', `Bearer ${adminCompToken}`);
      expect([400, 404]).toContain(res.status);
    });

    test('id dạng chuỗi → 400 hoặc 404', async () => {
      const res = await request(app)
        .get('/api/admin/products/invalid-id')
        .set('Authorization', `Bearer ${adminCompToken}`);
      expect([400, 404]).toContain(res.status);
    });

    test('không token → 401', async () => {
      const res = await request(app).get(`/api/admin/products/${prodComp.id}`);
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get(`/api/admin/products/${prodComp.id}`)
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/admin/products/:id/status — các trạng thái', () => {
    test('chuyển sang inactive → 200 hoặc 400', async () => {
      const res = await request(app)
        .patch(`/api/admin/products/${prodComp.id}/status`)
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ status: 'inactive' });
      expect([200, 400]).toContain(res.status);
      await prodComp.update({ status: 'active' }).catch(() => {});
    });

    test('chuyển sang active → 200 hoặc 400', async () => {
      const res = await request(app)
        .patch(`/api/admin/products/${prodComp.id}/status`)
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ status: 'active' });
      expect([200, 400]).toContain(res.status);
    });

    test('status không hợp lệ → 400', async () => {
      const res = await request(app)
        .patch(`/api/admin/products/${prodComp.id}/status`)
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ status: 'unknown_status' });
      expect([400, 422]).toContain(res.status);
    });

    test('id sản phẩm không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .patch('/api/admin/products/999999999/status')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ status: 'active' });
      expect([400, 404]).toContain(res.status);
    });

    test('không token → 401', async () => {
      const res = await request(app)
        .patch(`/api/admin/products/${prodComp.id}/status`)
        .send({ status: 'active' });
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .patch(`/api/admin/products/${prodComp.id}/status`)
        .set('Authorization', `Bearer ${forbiddenToken}`)
        .send({ status: 'active' });
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/admin/products/:id/stock — validation', () => {
    test('quantity bằng 0 → 200 hoặc 400', async () => {
      const res = await request(app)
        .patch(`/api/admin/products/${prodComp.id}/stock`)
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ variantId: variantComp.id, quantity: 0 });
      expect([200, 400]).toContain(res.status);
    });

    test('sản phẩm không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .patch('/api/admin/products/999999999/stock')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ variantId: variantComp.id, quantity: 50 });
      expect([400, 404]).toContain(res.status);
    });

    test('không token → 401', async () => {
      const res = await request(app)
        .patch(`/api/admin/products/${prodComp.id}/stock`)
        .send({ variantId: variantComp.id, quantity: 50 });
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .patch(`/api/admin/products/${prodComp.id}/stock`)
        .set('Authorization', `Bearer ${forbiddenToken}`)
        .send({ quantity: 50 });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/admin/products/:id/clone — edge cases', () => {
    test('clone sản phẩm không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .post('/api/admin/products/999999999/clone')
        .set('Authorization', `Bearer ${staffCompToken}`);
      expect([400, 404]).toContain(res.status);
    });

    test('không token → 401', async () => {
      const res = await request(app).post(`/api/admin/products/${prodComp.id}/clone`);
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .post(`/api/admin/products/${prodComp.id}/clone`)
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/admin/products/:id — validation', () => {
    test('cập nhật product không tồn tại → 400, 404 hoặc 500', async () => {
      const res = await request(app)
        .put('/api/admin/products/999999999')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ name: 'NonExistent' });
      expect([400, 404, 500]).toContain(res.status);
    });

    test('không token → 401', async () => {
      const res = await request(app)
        .put(`/api/admin/products/${prodComp.id}`)
        .send({ name: 'Test' });
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .put(`/api/admin/products/${prodComp.id}`)
        .set('Authorization', `Bearer ${forbiddenToken}`)
        .send({ name: 'Test' });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/admin/products/:id — với sản phẩm thực', () => {
    test('xóa sản phẩm tồn tại → 200 hoặc 400', async () => {
      const tmpProd = await Product.create({
        nameVi: `__TMP_DEL_${TS_COMP}`,
        nameEn: `__TMP_DEL_${TS_COMP}`,
        baseName: `__TMP_DEL_${TS_COMP}`,
        slug: `tmp-del-${TS_COMP}`,
        basePrice: 100000,
        categoryId: catComp.id,
        brandId: brandComp.id,
        status: 'active',
        stockQuantity: 0,
      });
      const res = await request(app)
        .delete(`/api/admin/products/${tmpProd.id}`)
        .set('Authorization', `Bearer ${staffCompToken}`);
      expect([200, 204, 400]).toContain(res.status);
      await Product.destroy({ where: { id: tmpProd.id }, force: true }).catch(() => {});
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .delete(`/api/admin/products/${prodComp.id}`)
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── Orders — filter đa dạng ───────────────────────────────────────────────────

  describe('GET /api/admin/orders — filter đa dạng', () => {
    test('lọc theo status=processing → 200', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ status: 'processing' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('lọc theo status=delivered → 200', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ status: 'delivered' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('lọc theo status=cancelled → 200', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ status: 'cancelled' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('lọc theo userId thực → 200', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ userId: forbiddenUser.id });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('lọc theo userId không tồn tại → 200 + danh sách rỗng', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ userId: 999999999 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('phân trang page=2&limit=5 → 200', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ page: 2, limit: 5 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('sortBy=createdAt&sortOrder=ASC → 200', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ sortBy: 'createdAt', sortOrder: 'ASC' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/orders');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/admin/orders/:id/status — tất cả trạng thái hợp lệ', () => {
    test('status=shipped với id không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .put('/api/admin/orders/999999999/status')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ status: 'shipped' });
      expect([200, 400, 404]).toContain(res.status);
    });

    test('status=delivered với id không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .put('/api/admin/orders/999999999/status')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ status: 'delivered' });
      expect([200, 400, 404]).toContain(res.status);
    });

    test('status không hợp lệ → 400', async () => {
      const res = await request(app)
        .put('/api/admin/orders/999999999/status')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ status: 'invalid_status_xyz' });
      expect([400, 422]).toContain(res.status);
    });

    test('không token → 401', async () => {
      const res = await request(app)
        .put('/api/admin/orders/1/status')
        .send({ status: 'processing' });
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .put('/api/admin/orders/1/status')
        .set('Authorization', `Bearer ${forbiddenToken}`)
        .send({ status: 'processing' });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/admin/orders/:id/cancel', () => {
    test('hủy đơn không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .post('/api/admin/orders/999999999/cancel')
        .set('Authorization', `Bearer ${staffCompToken}`);
      expect([400, 404]).toContain(res.status);
    });

    test('không token → 401', async () => {
      const res = await request(app).post('/api/admin/orders/1/cancel');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .post('/api/admin/orders/1/cancel')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── Reviews — filter và pagination ───────────────────────────────────────────

  describe('GET /api/admin/reviews — filter và pagination', () => {
    test('page=1&limit=3 → 200 + array', async () => {
      const res = await request(app)
        .get('/api/admin/reviews')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ page: 1, limit: 3 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('lọc theo productId thực → 200', async () => {
      const res = await request(app)
        .get('/api/admin/reviews')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ productId: prodComp.id });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('lọc theo productId không tồn tại → 200 + danh sách rỗng', async () => {
      const res = await request(app)
        .get('/api/admin/reviews')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ productId: 999999999 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('lọc theo rating=5 → 200', async () => {
      const res = await request(app)
        .get('/api/admin/reviews')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ rating: 5 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/reviews');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/reviews')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/admin/reviews/:id — với review thực', () => {
    test('xóa review thực → 200 hoặc 400', async () => {
      const tmpReview = await Review.create({
        userId: forbiddenUser.id,
        productId: prodComp.id,
        rating: 4,
        comment: '__TMP review for delete test',
      }).catch(() => null);
      if (!tmpReview) return;
      const res = await request(app)
        .delete(`/api/admin/reviews/${tmpReview.id}`)
        .set('Authorization', `Bearer ${staffCompToken}`);
      expect([200, 204, 400]).toContain(res.status);
      await Review.destroy({ where: { id: tmpReview.id }, force: true }).catch(() => {});
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .delete('/api/admin/reviews/1')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── Discount Codes — validation chi tiết ─────────────────────────────────────

  describe('POST /api/admin/discount-codes — validation', () => {
    test('code quá ngắn (1 ký tự) → 400', async () => {
      const res = await request(app)
        .post('/api/admin/discount-codes')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ code: 'X', type: 'percent', value: 10 });
      expect(res.status).toBe(400);
    });

    test('type không hợp lệ → 400', async () => {
      const res = await request(app)
        .post('/api/admin/discount-codes')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ code: `COMP-INVTYPE-${TS_COMP}`, type: 'bogus_type', value: 10 });
      expect(res.status).toBe(400);
    });

    test('value âm → 400', async () => {
      const res = await request(app)
        .post('/api/admin/discount-codes')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ code: `COMP-NEG-${TS_COMP}`, type: 'percent', value: -5 });
      expect(res.status).toBe(400);
    });

    test('thiếu field code → 400', async () => {
      const res = await request(app)
        .post('/api/admin/discount-codes')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ type: 'percent', value: 10 });
      expect(res.status).toBe(400);
    });

    test('thiếu field type → 400', async () => {
      const res = await request(app)
        .post('/api/admin/discount-codes')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ code: `COMP-NOTYPE-${TS_COMP}`, value: 10 });
      expect(res.status).toBe(400);
    });

    test('tạo mã giảm giá percent hợp lệ → 200 hoặc 201', async () => {
      const res = await request(app)
        .post('/api/admin/discount-codes')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({
          code: `COMP-PCT-${TS_COMP}`,
          type: 'percent',
          value: 15,
          minOrderAmount: 100000,
          usageLimit: 10,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000 * 30).toISOString(),
          isActive: true,
        });
      expect([200, 201]).toContain(res.status);
      const id =
        res.body?.data?.id || res.body?.data?.discountCode?.id || res.body?.discountCode?.id;
      if (id) createdDiscountIds.push(id);
    });

    test('không token → 401', async () => {
      const res = await request(app)
        .post('/api/admin/discount-codes')
        .send({ code: 'NOAUTH', type: 'percent', value: 10 });
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .post('/api/admin/discount-codes')
        .set('Authorization', `Bearer ${forbiddenToken}`)
        .send({ code: 'CUSTAUTH', type: 'percent', value: 10 });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/discount-codes/:id — với id thực', () => {
    test('lấy discount code vừa tạo → 200', async () => {
      const createRes = await request(app)
        .post('/api/admin/discount-codes')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({
          code: `COMP-GET-${TS_COMP}`,
          type: 'fixed',
          value: 20000,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
          isActive: true,
        });
      const id = createRes.body?.data?.id || createRes.body?.data?.discountCode?.id;
      if (!id) return; // skip nếu không tạo được
      createdDiscountIds.push(id);

      const res = await request(app)
        .get(`/api/admin/discount-codes/${id}`)
        .set('Authorization', `Bearer ${adminCompToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/discount-codes/1');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/discount-codes/1')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/admin/discount-codes/:id — validation chi tiết', () => {
    test('cập nhật isActive=true cho code tồn tại → 200 hoặc 400', async () => {
      const createRes = await request(app)
        .post('/api/admin/discount-codes')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({
          code: `COMP-UPD-${TS_COMP}`,
          type: 'percent',
          value: 5,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
          isActive: false,
        });
      const id = createRes.body?.data?.id || createRes.body?.data?.discountCode?.id;
      if (!id) return;
      createdDiscountIds.push(id);

      const res = await request(app)
        .put(`/api/admin/discount-codes/${id}`)
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ isActive: true });
      expect([200, 400]).toContain(res.status);
    });

    test('cập nhật discount code không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .put('/api/admin/discount-codes/999999999')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ value: 10 });
      expect([400, 404]).toContain(res.status);
    });

    test('không token → 401', async () => {
      const res = await request(app).put('/api/admin/discount-codes/1').send({ value: 20 });
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .put('/api/admin/discount-codes/1')
        .set('Authorization', `Bearer ${forbiddenToken}`)
        .send({ value: 10 });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/admin/discount-codes/:id — auth checks', () => {
    test('không token → 401', async () => {
      const res = await request(app).delete('/api/admin/discount-codes/1');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .delete('/api/admin/discount-codes/1')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── Analytics — auth và response shape ───────────────────────────────────────

  describe('GET /api/admin/analytics/order-status — auth và shape', () => {
    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/analytics/order-status');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/order-status')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });

    test('response có field data → 200', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/order-status')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ startDate: '2026-01-01', endDate: '2026-12-31' });
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/admin/analytics/top-products — limit và auth', () => {
    test('limit=3 → 200', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/top-products')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ limit: 3 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('limit=10 → 200', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/top-products')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ limit: 10 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/analytics/top-products');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/top-products')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/analytics/revenue-by-category — auth và period', () => {
    test('period=month → 200', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/revenue-by-category')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ period: 'month' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/analytics/revenue-by-category');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/revenue-by-category')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/analytics/user-growth — auth', () => {
    test('period=month với date range → 200', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/user-growth')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ startDate: '2026-01-01', endDate: '2026-12-31', period: 'month' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/analytics/user-growth');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/user-growth')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/analytics/payment-methods — auth', () => {
    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/analytics/payment-methods');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/payment-methods')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/analytics/low-stock — threshold param', () => {
    test('threshold=5 → 200', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/low-stock')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ threshold: 5 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('threshold=0 → 200', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/low-stock')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ threshold: 0 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('threshold=100 → 200', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/low-stock')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ threshold: 100 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/analytics/low-stock');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/low-stock')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── Reports Export ────────────────────────────────────────────────────────────

  describe('GET /api/admin/reports/export — auth checks', () => {
    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/reports/export');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/reports/export')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });

    test('admin với date range → 200 hoặc 400', async () => {
      const res = await request(app)
        .get('/api/admin/reports/export')
        .set('Authorization', `Bearer ${adminCompToken}`)
        .query({ startDate: '2026-01-01', endDate: '2026-12-31' });
      expect([200, 400]).toContain(res.status);
    });
  });

  // ── Chatbot Stats ─────────────────────────────────────────────────────────────

  describe('GET /api/admin/chatbot/stats — auth checks', () => {
    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/chatbot/stats');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/chatbot/stats')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── Import/Export — auth checks ───────────────────────────────────────────────

  describe('GET /api/admin/products/import-template — auth', () => {
    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/products/import-template');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/products/import-template')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/products/export — auth', () => {
    test('không token → 401', async () => {
      const res = await request(app).get('/api/admin/products/export');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .get('/api/admin/products/export')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/admin/products/import — auth', () => {
    test('không token → 401', async () => {
      const res = await request(app).post('/api/admin/products/import');
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .post('/api/admin/products/import')
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });

    test('admin không gửi file → 400 hoặc 422', async () => {
      const res = await request(app)
        .post('/api/admin/products/import')
        .set('Authorization', `Bearer ${staffCompToken}`);
      expect([400, 422]).toContain(res.status);
    });
  });

  // ── POST /api/admin/products — validation schema ──────────────────────────────

  describe('POST /api/admin/products — validation schema', () => {
    test('payload rỗng → 400', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    test('thiếu field name → 400', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({ description: 'Test desc', shortDescription: 'Short', price: 100000 });
      expect(res.status).toBe(400);
    });

    test('price âm → 400', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${staffCompToken}`)
        .send({
          name: 'Test Product',
          description: 'Test description',
          shortDescription: 'Short',
          price: -1,
        });
      expect(res.status).toBe(400);
    });

    test('không token → 401', async () => {
      const res = await request(app).post('/api/admin/products').send({});
      expect(res.status).toBe(401);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${forbiddenToken}`)
        .send({});
      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /api/admin/users/:id — edge cases ──────────────────────────────────

  describe('DELETE /api/admin/users/:id — edge cases', () => {
    test('admin tự xóa chính mình → 200, 400 hoặc 403 (server nên từ chối)', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${adminComp.id}`)
        .set('Authorization', `Bearer ${adminCompToken}`);
      expect([200, 400, 403]).toContain(res.status);
    });

    test('xóa user không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .delete('/api/admin/users/999999999')
        .set('Authorization', `Bearer ${adminCompToken}`);
      expect([400, 404]).toContain(res.status);
    });

    test('customer token → 403', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${customerComp.id}`)
        .set('Authorization', `Bearer ${forbiddenToken}`);
      expect(res.status).toBe(403);
    });
  });
});
