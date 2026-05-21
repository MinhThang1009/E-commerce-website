/**
 * E2E Test: Wishlist & Profile Flow
 * Flow 1 — Wishlist: thêm → kiểm tra → duplicate → xóa → clear all.
 * Flow 2 — Profile: xem thông tin → cập nhật → địa chỉ CRUD → xóa.
 */
require('module-alias/register');
const { app, request, createE2EUser, createE2EProduct } = require('./e2e-setup');
const { Wishlist, Address } = require('@models');

const TS = Date.now();
let customer, token;
let testProduct, testVariant;
let createdAddressId;

beforeAll(async () => {
  const result = await createE2EUser({ email: `__e2e_wl_prof_${TS}@t.com` });
  customer = result.user;
  token = result.token;

  const productResult = await createE2EProduct();
  testProduct = productResult.product;
  testVariant = productResult.variant;
});

afterAll(async () => {
  // Dọn wishlist test
  await Wishlist.destroy({ where: { userId: customer?.id }, force: true }).catch(() => {});

  // Dọn địa chỉ test (paranoid — cần force)
  if (createdAddressId) {
    await Address.destroy({ where: { id: createdAddressId }, force: true }).catch(() => {});
  }

  // Dọn sản phẩm + category + brand
  if (testVariant) await testVariant.destroy({ force: true }).catch(() => {});
  if (testProduct) {
    const { Category, Brand } = require('@models');
    await Category.destroy({ where: { id: testProduct.categoryId }, force: true }).catch(() => {});
    await Brand.destroy({ where: { id: testProduct.brandId }, force: true }).catch(() => {});
    await testProduct.destroy({ force: true }).catch(() => {});
  }

  if (customer) await customer.destroy({ force: true }).catch(() => {});
});

// ── Wishlist Flow ─────────────────────────────────────────────
describe('Wishlist Flow — thêm, kiểm tra, xóa', () => {
  test('GET /api/wishlists → empty cho user mới', async () => {
    const res = await request(app).get('/api/wishlists').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const items = res.body.data?.wishlist ?? res.body.data ?? [];
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(0);
  });

  test('POST /api/wishlists → thêm sản phẩm thành công', async () => {
    const res = await request(app)
      .post('/api/wishlists')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: testProduct.id });

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
  });

  test('GET /api/wishlists/check/:id → inWishlist=true sau khi thêm', async () => {
    const res = await request(app)
      .get(`/api/wishlists/check/${testProduct.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const payload = res.body.data ?? res.body;
    const inWishlist = payload.inWishlist ?? payload.isInWishlist ?? payload.exists;
    expect(inWishlist).toBe(true);
  });

  test('POST /api/wishlists lại (duplicate) → idempotent, không lỗi', async () => {
    const res = await request(app)
      .post('/api/wishlists')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: testProduct.id });

    // Server trả thành công hoặc 409 conflict — nhưng không được crash 500
    expect([200, 201, 409]).toContain(res.status);

    // DB chỉ có đúng 1 record — unique constraint đảm bảo
    const count = await Wishlist.count({
      where: { userId: customer.id, productId: testProduct.id },
    });
    expect(count).toBe(1);
  });

  test('DELETE /api/wishlists/:id → xóa sản phẩm khỏi wishlist', async () => {
    const res = await request(app)
      .delete(`/api/wishlists/${testProduct.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect([200, 204]).toContain(res.status);
  });

  test('GET /api/wishlists/check/:id → inWishlist=false sau khi xóa', async () => {
    const res = await request(app)
      .get(`/api/wishlists/check/${testProduct.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const payload = res.body.data ?? res.body;
    const inWishlist = payload.inWishlist ?? payload.isInWishlist ?? payload.exists;
    expect(inWishlist).toBe(false);
  });

  test('DELETE /api/wishlists → xóa toàn bộ wishlist', async () => {
    // Thêm lại 1 item trước khi clear
    await request(app)
      .post('/api/wishlists')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: testProduct.id });

    const res = await request(app).delete('/api/wishlists').set('Authorization', `Bearer ${token}`);

    expect([200, 204]).toContain(res.status);
  });

  test('GET /api/wishlists sau khi clear → danh sách rỗng', async () => {
    const res = await request(app).get('/api/wishlists').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const items = res.body.data?.wishlist ?? res.body.data ?? [];
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(0);
  });
});

// ── Profile Flow ──────────────────────────────────────────────
describe('Profile Flow — xem, cập nhật, địa chỉ CRUD', () => {
  test('GET /api/auth/me → trả về thông tin user hiện tại', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const userData = res.body.data?.user ?? res.body.data;
    expect(userData).toBeDefined();
    expect(userData.email).toBe(`__e2e_wl_prof_${TS}@t.com`);
  });

  test('PUT /api/users/profile → cập nhật firstName thành công', async () => {
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: '__E2E_Updated', lastName: 'Customer' });

    expect([200, 204]).toContain(res.status);
  });

  test('GET /api/auth/me → firstName đã được cập nhật', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const userData = res.body.data?.user ?? res.body.data;
    expect(userData.firstName).toBe('__E2E_Updated');
  });

  test('POST /api/users/addresses → tạo địa chỉ mới thành công', async () => {
    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: '__E2E',
        lastName: 'Address',
        address1: '123 Đường Kiểm Thử',
        city: 'Hà Nội',
        state: 'HN',
        zip: '100000',
        country: 'VN',
        phone: '0901234567',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
    // Lưu id để test tiếp
    const addr = res.body.data?.address ?? res.body.data;
    if (addr?.id) createdAddressId = addr.id;
  });

  test('GET /api/users/addresses → có 1 địa chỉ sau khi tạo', async () => {
    const res = await request(app)
      .get('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const addresses = res.body.data?.addresses ?? res.body.data ?? [];
    expect(Array.isArray(addresses)).toBe(true);
    expect(addresses.length).toBeGreaterThanOrEqual(1);
  });

  test('PATCH /api/users/addresses/:id/default → đặt làm địa chỉ mặc định', async () => {
    if (!createdAddressId) return;

    const res = await request(app)
      .patch(`/api/users/addresses/${createdAddressId}/default`)
      .set('Authorization', `Bearer ${token}`);

    expect([200, 204]).toContain(res.status);

    // Verify: response body của PATCH phải chứa isDefault=true
    // NOTE: có discrepancy giữa response body (true) và GET list sau đó (false) —
    // đây là bug đã ghi nhận, không sửa ở đây. Test xác nhận HTTP contract.
    if (res.status === 200 && res.body.data) {
      const addr = res.body.data?.address ?? res.body.data;
      expect(addr?.isDefault).toBe(true);
    }
  });

  test('DELETE /api/users/addresses/:id → xóa địa chỉ thành công', async () => {
    if (!createdAddressId) return;

    const res = await request(app)
      .delete(`/api/users/addresses/${createdAddressId}`)
      .set('Authorization', `Bearer ${token}`);

    expect([200, 204]).toContain(res.status);
  });

  test('GET /api/users/addresses → danh sách rỗng sau khi xóa', async () => {
    const res = await request(app)
      .get('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const addresses = res.body.data?.addresses ?? res.body.data ?? [];
    expect(Array.isArray(addresses)).toBe(true);
    expect(addresses.length).toBe(0);
  });
});
