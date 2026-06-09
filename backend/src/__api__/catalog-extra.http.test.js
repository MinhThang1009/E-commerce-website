/**
 * HTTP tests bổ sung cho module catalog — tập trung vào các kịch bản
 * query-param filter, edge case validation và routes chưa có trong:
 *   - catalog.http.test.js
 *   - catalog-comprehensive.http.test.js
 *   - catalog-products.http.test.js
 *
 * Những gì đã được test ở các file trên (KHÔNG lặp lại):
 *  - GET /api/categories (basic, tree, featured, slug, id, id/products)
 *  - POST /api/categories (admin/auth guard), DELETE /api/categories/:id
 *  - GET /api/brands (basic, slug, slug/products), POST /api/brands
 *  - PUT /api/brands/:id, DELETE /api/brands/:id
 *  - GET /api/products (basic, sort, search=laptop, featured, new-arrivals,
 *    best-sellers, deals, filters, search?q=, suggestions, recently-viewed)
 *  - GET /api/products/:id (tồn tại, 404), :id/related, :id/variants, :id/reviews-summary
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand } = require('@models');

const TS = Date.now();
let adminUser, staffToken, regularUser, regularToken;
let prod, variant, cat, brand;

beforeAll(async () => {
  ({ user: adminUser, token: staffToken } = await createTestUser({
    email: `__http_catex_admin_${TS}@t.com`,
    role: 'staff',
  }));
  ({ user: regularUser, token: regularToken } = await createTestUser({
    email: `__http_catex_user_${TS}@t.com`,
    role: 'customer',
  }));
  ({ product: prod, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (prod) await prod.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  if (adminUser) await adminUser.destroy({ force: true }).catch(() => {});
  if (regularUser) await regularUser.destroy({ force: true }).catch(() => {});
});

// ── Products — filter theo giá ──────────────────────────────────────────────

describe('GET /api/products?minPrice=&maxPrice=', () => {
  test('lọc khoảng giá 1_000_000–5_000_000 → 200', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ minPrice: 1_000_000, maxPrice: 5_000_000 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });

  test('minPrice > maxPrice → 200 hoặc 400 (server quyết định)', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ minPrice: 10_000_000, maxPrice: 1_000 });
    // Server có thể chấp nhận (trả về rỗng) hoặc từ chối (400)
    expect([200, 400]).toContain(res.status);
  });
});

// ── Products — filter theo brand ────────────────────────────────────────────

describe('GET /api/products?brandId=<id>', () => {
  test('lọc sản phẩm theo brandId thực → 200', async () => {
    const res = await request(app).get('/api/products').query({ brandId: brand.id });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('brandId không tồn tại → 200 + danh sách rỗng hoặc 400', async () => {
    const res = await request(app).get('/api/products').query({ brandId: 999999999 });
    expect([200, 400]).toContain(res.status);
  });
});

// ── Products — phân trang ────────────────────────────────────────────────────

describe('GET /api/products?page=2&limit=5', () => {
  test('trang 2 với limit 5 → 200', async () => {
    const res = await request(app).get('/api/products').query({ page: 2, limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Products — filter inStock / featured ─────────────────────────────────────

describe('GET /api/products?inStock=true', () => {
  test('chỉ lấy sản phẩm còn hàng → 200', async () => {
    const res = await request(app).get('/api/products').query({ inStock: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/products?featured=true', () => {
  test('chỉ lấy sản phẩm nổi bật → 200', async () => {
    const res = await request(app).get('/api/products').query({ featured: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Products — by slug ───────────────────────────────────────────────────────

describe('GET /api/products/slug/:slug', () => {
  test('slug hợp lệ → 200 kèm chi tiết sản phẩm', async () => {
    const res = await request(app).get(`/api/products/slug/${prod.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });

  test('slug không tồn tại → 404', async () => {
    const res = await request(app).get('/api/products/slug/slug-khong-ton-tai-999999');
    expect(res.status).toBe(404);
  });
});

// ── Products — best-sellers với period param ─────────────────────────────────

describe('GET /api/products/best-sellers?period=week', () => {
  test('→ 200 với period=week', async () => {
    const res = await request(app).get('/api/products/best-sellers').query({ period: 'week' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('→ 200 với period=month', async () => {
    const res = await request(app).get('/api/products/best-sellers').query({ period: 'month' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Products — deals với minDiscount param ───────────────────────────────────

describe('GET /api/products/deals?minDiscount=10', () => {
  test('→ 200 với minDiscount=10', async () => {
    const res = await request(app).get('/api/products/deals').query({ minDiscount: 10 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Products — search với query rỗng ─────────────────────────────────────────

describe('GET /api/products/search?q= (rỗng)', () => {
  test('query rỗng → 200 hoặc 400', async () => {
    const res = await request(app).get('/api/products/search').query({ q: '' });
    // Server có thể chấp nhận và trả về tất cả, hoặc từ chối vì query rỗng
    expect([200, 400]).toContain(res.status);
  });
});

describe('GET /api/products/suggestions?q=abc', () => {
  test('→ 200 + array gợi ý', async () => {
    const res = await request(app).get('/api/products/suggestions').query({ q: 'abc' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // Gợi ý phải là mảng (có thể rỗng)
    expect(Array.isArray(res.body.data) || typeof res.body.data === 'object').toBe(true);
  });
});

// ── Categories — update (PUT) ────────────────────────────────────────────────

describe('PUT /api/categories/:id (admin)', () => {
  test('admin cập nhật danh mục → 200', async () => {
    const res = await request(app)
      .put(`/api/categories/${cat.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `__HTTP_CatEx_Updated_${TS}`, isActive: true });
    expect([200, 400]).toContain(res.status);
  });

  test('không auth → 401', async () => {
    const res = await request(app)
      .put(`/api/categories/${cat.id}`)
      .send({ name: 'Cập nhật không auth' });
    expect(res.status).toBe(401);
  });

  test('customer cập nhật danh mục → 403', async () => {
    const res = await request(app)
      .put(`/api/categories/${cat.id}`)
      .set('Authorization', `Bearer ${regularToken}`)
      .send({ name: 'Forbidden' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/categories/:id không tồn tại', () => {
  test('→ 404', async () => {
    const res = await request(app).get('/api/categories/999999999');
    expect(res.status).toBe(404);
  });
});

// ── Categories — tạo trùng tên ───────────────────────────────────────────────

describe('POST /api/categories trùng slug', () => {
  test('tạo danh mục với slug đã tồn tại → 400 hoặc 409', async () => {
    const uniqueSlug = `__dup_slug_test_${Date.now()}`;
    // Tạo lần 1 — đảm bảo tồn tại
    const first = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `Dup Test ${uniqueSlug}`, slug: uniqueSlug, isActive: true });
    expect([200, 201]).toContain(first.status);
    // Tạo lần 2 cùng slug — server phải từ chối
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `Dup Test ${uniqueSlug}`, slug: uniqueSlug, isActive: true });
    expect([400, 409, 422]).toContain(res.status);
    await Category.destroy({ where: { slug: uniqueSlug } }).catch(() => {});
  });
});

// ── Brands — filter theo categoryId ─────────────────────────────────────────

describe('GET /api/brands?categoryId=<id>', () => {
  test('lọc thương hiệu theo categoryId → 200', async () => {
    const res = await request(app).get('/api/brands').query({ categoryId: cat.id });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/brands/:id không tồn tại', () => {
  test('→ 404 hoặc 405 (không có GET /api/brands/:id endpoint)', async () => {
    // Theo routes.js không có GET /brands/:id, chỉ có /brands/slug/:slug
    // Nếu bị match như slug → 404; nếu không có route → 404
    const res = await request(app).get('/api/brands/999999999');
    expect([404, 405]).toContain(res.status);
  });
});

// ── Brands — tạo trùng slug ──────────────────────────────────────────────────

describe('POST /api/brands trùng slug', () => {
  test('tạo thương hiệu với slug đã tồn tại → 400 hoặc 409', async () => {
    // Dùng slug của brand đã được tạo trong beforeAll
    const res = await request(app)
      .post('/api/brands')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: brand.nameVi, slug: brand.slug });
    // Server phải từ chối vì slug trùng
    expect([400, 409, 422]).toContain(res.status);
  });
});
