require('module-alias/register');
const { app, request, createTestProduct } = require('./http-setup');
const { Category, Brand } = require('@models');

const TS = Date.now();
let product, variant, cat, brand;

beforeAll(async () => {
  ({ product, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
});

describe('GET /api/products', () => {
  test('→ 200 + data', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });

  ['price_asc', 'price_desc', 'newest', 'popular'].forEach((sort) => {
    test(`sort=${sort} → 200`, async () => {
      const res = await request(app).get(`/api/products?sort=${sort}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });
});

describe('GET /api/products/:id', () => {
  test('tồn tại → 200', async () => {
    const res = await request(app).get(`/api/products/${product.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });

  test('không tồn tại → 404', async () => {
    const res = await request(app).get('/api/products/999999999');
    expect(res.status).toBe(404);
  });
});

['featured', 'new-arrivals', 'best-sellers', 'deals'].forEach((endpoint) => {
  describe(`GET /api/products/${endpoint}`, () => {
    test('→ 200', async () => {
      const res = await request(app).get(`/api/products/${endpoint}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });
});

describe('GET /api/products/search', () => {
  test('với query → 200', async () => {
    const res = await request(app).get('/api/products/search?q=laptop');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});
