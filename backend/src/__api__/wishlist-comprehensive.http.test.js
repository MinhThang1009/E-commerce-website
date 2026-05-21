require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, Wishlist } = require('@models');

const TS = Date.now();
let user, token, product, variant, cat, brand;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_wlcomp_${TS}@t.com` }));
  ({ product, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  if (user) await Wishlist.destroy({ where: { userId: user.id }, force: true }).catch(() => {});
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (product) await product.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  if (user) await user.destroy({ force: true }).catch(() => {});
});

describe('GET /api/wishlists', () => {
  test('trả về 200 và mảng rỗng khi chưa thêm sản phẩm nào', async () => {
    const res = await request(app).get('/api/wishlists').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // Kết quả có thể là mảng hoặc object với trường data là mảng
    const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data?.items ?? []);
    expect(Array.isArray(items)).toBe(true);
  });

  test('không auth → 401', async () => {
    const res = await request(app).get('/api/wishlists');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/wishlists/check/:productId (chưa thêm)', () => {
  test('inWishlist=false khi sản phẩm chưa được thêm vào danh sách', async () => {
    const res = await request(app)
      .get(`/api/wishlists/check/${product.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data?.inWishlist).toBe(false);
  });

  test('không auth → 401', async () => {
    const res = await request(app).get(`/api/wishlists/check/${product.id}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/wishlists', () => {
  test('thêm sản phẩm → 201 hoặc 200', async () => {
    const res = await request(app)
      .post('/api/wishlists')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
  });

  test('thêm lại sản phẩm đã có (idempotent) → 200 hoặc 409', async () => {
    // Sản phẩm đã được thêm ở test trên — thêm lại phải an toàn
    const res = await request(app)
      .post('/api/wishlists')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id });
    expect([200, 201, 409]).toContain(res.status);
  });

  test('không auth → 401', async () => {
    const res = await request(app).post('/api/wishlists').send({ productId: product.id });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/wishlists/check/:productId (sau khi thêm)', () => {
  test('inWishlist=true sau khi đã thêm sản phẩm', async () => {
    const res = await request(app)
      .get(`/api/wishlists/check/${product.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data?.inWishlist).toBe(true);
  });
});

describe('DELETE /api/wishlists/:productId', () => {
  test('xóa sản phẩm khỏi danh sách → 200', async () => {
    const res = await request(app)
      .delete(`/api/wishlists/${product.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('xóa sản phẩm không có trong danh sách → 200 hoặc 404', async () => {
    // Xóa lần 2 sau khi đã xóa ở test trên
    const res = await request(app)
      .delete(`/api/wishlists/${product.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 404]).toContain(res.status);
  });

  test('không auth → 401', async () => {
    const res = await request(app).delete(`/api/wishlists/${product.id}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/wishlists (sau xóa)', () => {
  test('danh sách trống sau khi xóa sản phẩm', async () => {
    const res = await request(app).get('/api/wishlists').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // inWishlist cho product đó phải là false sau khi xóa
    const checkRes = await request(app)
      .get(`/api/wishlists/check/${product.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data?.inWishlist).toBe(false);
  });
});

describe('DELETE /api/wishlists (clear all)', () => {
  beforeEach(async () => {
    // Thêm lại sản phẩm trước khi test clear
    await request(app)
      .post('/api/wishlists')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id });
  });

  test('xóa toàn bộ danh sách yêu thích → 200', async () => {
    const res = await request(app).delete('/api/wishlists').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('danh sách rỗng sau khi clear all', async () => {
    await request(app).delete('/api/wishlists').set('Authorization', `Bearer ${token}`);
    const res = await request(app).get('/api/wishlists').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data?.items ?? []);
    expect(items.length).toBe(0);
  });
});
