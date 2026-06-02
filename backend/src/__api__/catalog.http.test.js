require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let admin, staffToken;
let prod, variant, cat, brand;

beforeAll(async () => {
  ({ user: admin, token: staffToken } = await createTestUser({
    email: `__http_catalog_${TS}@t.com`,
    role: 'staff',
  }));
  ({ product: prod, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (prod) await prod.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  if (admin) await admin.destroy({ force: true }).catch(() => {});
});

// ── Categories ──────────────────────────────────────────────
describe('GET /api/categories', () => {
  test('→ 200', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/categories/tree', () => {
  test('→ 200', async () => {
    const res = await request(app).get('/api/categories/tree');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/categories/featured', () => {
  test('→ 200', async () => {
    const res = await request(app).get('/api/categories/featured');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/categories/:id', () => {
  test('tồn tại → 200', async () => {
    const res = await request(app).get(`/api/categories/${cat.id}`);
    expect(res.status).toBe(200);
  });
  test('không tồn tại → 404', async () => {
    const res = await request(app).get('/api/categories/999999999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/categories/slug/:slug', () => {
  test('→ 200', async () => {
    const res = await request(app).get(`/api/categories/slug/${cat.slug}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/categories/:id/products', () => {
  test('→ 200', async () => {
    const res = await request(app).get(`/api/categories/${cat.id}/products`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/categories (admin)', () => {
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/categories').send({ nameVi: 'X', slug: 'x' });
    expect(res.status).toBe(401);
  });
  test('admin → 201', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `__HTTP_Cat2_${TS}`, isActive: true });
    expect([200, 201]).toContain(res.status);
    if (res.body.data?.id) await Category.destroy({ where: { id: res.body.data.id } });
  });
});

// ── Brands ──────────────────────────────────────────────────
describe('GET /api/brands', () => {
  test('→ 200', async () => {
    const res = await request(app).get('/api/brands');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/brands/slug/:slug', () => {
  test('→ 200', async () => {
    const res = await request(app).get(`/api/brands/slug/${brand.slug}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/brands/slug/:slug/products', () => {
  test('→ 200', async () => {
    const res = await request(app).get(`/api/brands/slug/${brand.slug}/products`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/brands (admin)', () => {
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/brands').send({ nameVi: 'X' });
    expect(res.status).toBe(401);
  });
  test('admin → 201', async () => {
    const res = await request(app)
      .post('/api/brands')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `__HTTP_Brand2_${TS}` });
    expect([200, 201]).toContain(res.status);
    if (res.body.data?.id) await Brand.destroy({ where: { id: res.body.data.id } });
  });
});
