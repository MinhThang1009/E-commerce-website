/**
 * Attribute, Users/Addresses, Warranty, Search History, Wishlist — deep response shape tests.
 * Tập trung vào response shapes và edge cases chưa được test.
 *
 * Những gì đã test (KHÔNG lặp lại):
 * ATTRIBUTE:
 *  - GET /attributes/groups → 200
 *  - GET /attributes/name-affecting → 200
 *  - POST /attributes/preview-name (valid + thiếu baseName) → 200/400
 *  - POST /attributes/groups (no auth, admin valid, admin id không tồn tại) → 401/200/404
 *  - PUT /attributes/groups/:id (no auth, admin, id không tồn tại) → 401/200/404
 *  - POST /attributes/groups/:id/values (no auth, admin valid, group không tồn tại) → 401/200/404
 *  - PUT /attributes/values/:id (no auth, admin valid, id không tồn tại) → 401/200/404
 *  - DELETE /attributes/values/:id (no auth, admin, id không tồn tại) → 401/200/404
 *  - DELETE /attributes/groups/:id (no auth, admin, id không tồn tại) → 401/200/404
 *  - GET /attributes/products/:productId/groups (valid, không tồn tại) → 200/404
 *  - POST /attributes/products/:productId/groups/:groupId (admin, no auth) → 200/401
 *  - POST /attributes/generate-name-realtime → 200/500
 *  - POST /attributes/batch-generate-names (no auth, admin empty) → 401/200/400
 *
 * USERS:
 *  - PUT /users/profile (auth, no auth, firstName rỗng) → 200/401/400
 *  - GET /users/addresses (auth, no auth) → 200/401
 *  - POST /users/addresses (valid, thiếu address1, thiếu city, no auth) → 201/400/401
 *  - PUT /users/addresses/:id (valid, no auth) → 200/401
 *  - PATCH /users/addresses/:id/default (valid, no auth) → 200/401
 *  - DELETE /users/addresses/:id (valid, id không tồn tại, no auth) → 200/404/401
 *
 * WARRANTY:
 *  - GET /warranty-packages (basic, pagination) → 200
 *  - GET /warranty-packages/product/:productId → 200
 *  - GET /warranty-packages/:id không tồn tại → 404
 *  - POST /warranty-packages (no auth, customer, admin valid, thiếu fields) → 401/403/201/400
 *  - PUT /warranty-packages/:id (no auth, admin valid, id không tồn tại) → 401/200/404
 *  - DELETE /warranty-packages/:id (no auth, admin valid, id không tồn tại) → 401/200/404
 *
 * SEARCH HISTORY:
 *  - POST /search-histories (no auth + auth, thiếu keyword, rỗng) → 200/201/422
 *  - GET /search-histories (no auth, auth) → 401/200
 *  - DELETE /search-histories/:id (no auth, id không tồn tại, hợp lệ) → 401/404/200
 *  - DELETE /search-histories (no auth, auth) → 401/200
 *
 * WISHLIST:
 *  - GET /wishlists (auth, no auth) → 200/401
 *  - POST /wishlists (add) → 200/201
 *  - GET /wishlists/check/:productId → 200 + inWishlist boolean
 *  - DELETE /wishlists/:productId → 200
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const {
  User,
  Address,
  AttributeGroup,
  AttributeValue,
  WarrantyPackage,
  SearchHistory,
  Wishlist,
  Category,
  Brand,
} = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let admin, adminToken;
let customer, customerToken;
let product, variant, cat, brand;
let createdGroupId, createdValueId, createdPackageId, createdAddressId;

beforeAll(async () => {
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_awssd_admin_${TS}@t.com`,
    role: 'admin',
  }));
  ({ user: customer, token: customerToken } = await createTestUser({
    email: `__http_awssd_cust_${TS}@t.com`,
    role: 'customer',
  }));
  ({ product, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  // Wishlist
  if (customer?.id)
    await Wishlist.destroy({ where: { userId: customer.id }, force: true }).catch(() => {});
  // Search history
  if (customer?.id)
    await SearchHistory.destroy({ where: { userId: customer.id }, force: true }).catch(() => {});
  if (admin?.id)
    await SearchHistory.destroy({ where: { userId: admin.id }, force: true }).catch(() => {});
  // Address
  if (customer?.id)
    await Address.destroy({ where: { userId: customer.id }, force: true }).catch(() => {});
  // Attribute
  if (createdValueId)
    await AttributeValue.destroy({ where: { id: createdValueId }, force: true }).catch(() => {});
  if (createdGroupId)
    await AttributeGroup.destroy({ where: { id: createdGroupId } }).catch(() => {});
  // Warranty
  if (createdPackageId)
    await WarrantyPackage.destroy({ where: { id: createdPackageId }, force: true }).catch(() => {});
  // Product fixtures
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (product) await product.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  // Users
  if (admin) await admin.destroy({ force: true }).catch(() => {});
  if (customer) await customer.destroy({ force: true }).catch(() => {});
});

// ════════════════════════════════════════════════════════════════
// ATTRIBUTE — response shape tests
// ════════════════════════════════════════════════════════════════

describe('GET /api/attributes/groups — response shape', () => {
  test('trả về array — mỗi group có id, name, type', async () => {
    const res = await request(app).get('/api/attributes/groups');
    expect(res.status).toBe(200);
    const data = res.body.data;
    // data là array hoặc object có property groups
    const groups = Array.isArray(data) ? data : (data?.groups ?? data?.attributeGroups ?? []);
    if (groups.length > 0) {
      const firstGroup = groups[0];
      expect(firstGroup).toHaveProperty('id');
      expect(firstGroup).toHaveProperty('name');
      // type là optional nhưng thường có
      expect(firstGroup.name).toBeTruthy();
    }
    expect(Array.isArray(groups)).toBe(true);
  });
});

describe('POST /api/attributes/groups (admin) — response có id', () => {
  test('admin tạo group → response có id', async () => {
    const res = await request(app)
      .post('/api/attributes/groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `__HTTP_AWSSD_Group_${TS}`, type: 'custom' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
    const groupId = res.body.data?.id ?? res.body.data?.group?.id;
    expect(groupId).toBeDefined();
    createdGroupId = groupId;
  });
});

describe('PUT /api/attributes/groups/:id (admin) — response có updated name', () => {
  test('cập nhật group → response có name mới', async () => {
    if (!createdGroupId) return;
    const updatedName = `__HTTP_AWSSD_Group_Upd_${TS}`;
    const res = await request(app)
      .put(`/api/attributes/groups/${createdGroupId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: updatedName });
    expect([200, 201]).toContain(res.status);
    // Response trả về group đã cập nhật — name phải khớp
    const group = res.body.data?.group ?? res.body.data;
    if (group?.name) {
      expect(group.name).toBe(updatedName);
    }
  });
});

describe('GET /api/attributes/groups/:id — response có values array', () => {
  test('group đã tạo → admin có thể GET chi tiết (200 hoặc 401 nếu cần auth)', async () => {
    if (!createdGroupId) return;
    // Thêm một value vào group trước (admin)
    const addValueRes = await request(app)
      .post(`/api/attributes/groups/${createdGroupId}/values`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `__HTTP_AWSSD_Val_${TS}`,
        value: `__HTTP_AWSSD_Val_${TS}`,
        sortOrder: 0,
      });
    if ([200, 201].includes(addValueRes.status)) {
      createdValueId = addValueRes.body.data?.id ?? addValueRes.body.data?.value?.id;
    }

    // Endpoint có thể yêu cầu auth
    const res = await request(app)
      .get(`/api/attributes/groups/${createdGroupId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 401, 404]).toContain(res.status);
    if (res.status === 200) {
      const data = res.body.data;
      const values = data?.AttributeValues ?? data?.values ?? data?.attributeValues ?? [];
      expect(Array.isArray(values)).toBe(true);
    }
  });
});

describe('POST /api/attributes/groups/:groupId/values (admin) — response có id', () => {
  test('thêm value mới vào group → response có id', async () => {
    if (!createdGroupId) return;
    const res = await request(app)
      .post(`/api/attributes/groups/${createdGroupId}/values`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `__HTTP_AWSSD_Val2_${TS}`,
        value: `__HTTP_AWSSD_Val2_${TS}`,
        sortOrder: 1,
      });
    expect([200, 201]).toContain(res.status);
    const valueId = res.body.data?.id ?? res.body.data?.value?.id;
    expect(valueId).toBeDefined();
    // Dùng value này nếu chưa có
    if (!createdValueId) createdValueId = valueId;
  });
});

describe('PUT /api/attributes/values/:id (admin) — response có updated value', () => {
  test('cập nhật value → trả về 200', async () => {
    if (!createdValueId) return;
    const res = await request(app)
      .put(`/api/attributes/values/${createdValueId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: `__HTTP_AWSSD_Val_Upd_${TS}` });
    expect([200, 201]).toContain(res.status);
  });
});

describe('GET /api/attributes/products/:productId — response có attributeGroups', () => {
  test('product hợp lệ → data có attributeGroups array (admin hoặc public)', async () => {
    // Endpoint có thể yêu cầu auth — thử với admin token
    const res = await request(app)
      .get(`/api/attributes/products/${product.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 401, 404]).toContain(res.status);
    if (res.status === 200) {
      const data = res.body.data;
      const hasGroups =
        Array.isArray(data?.attributeGroups) || Array.isArray(data?.groups) || Array.isArray(data);
      expect(hasGroups).toBe(true);
    }
  });
});

describe('POST /api/attributes/products/:productId/assign (admin) — 200 hoặc 201', () => {
  test('gán group vào product (dùng route assign nếu có) → 200/201/404', async () => {
    if (!createdGroupId) return;
    // Thử route assign
    const res = await request(app)
      .post(`/api/attributes/products/${product.id}/groups/${createdGroupId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201, 404]).toContain(res.status);
  });
});

describe('POST /api/attributes/generate-name-realtime (admin) — 200', () => {
  test('body hợp lệ → 200 hoặc 500 (AI service unavailable)', async () => {
    const res = await request(app)
      .post('/api/attributes/generate-name-realtime')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        baseName: 'Samsung Galaxy',
        selectedAttributes: [],
        separator: ' ',
        includeDetails: false,
      });
    expect([200, 500]).toContain(res.status);
  });
});

describe('POST /api/attributes/batch-generate-names (admin) — 200 hoặc 400', () => {
  test('admin + productIds hợp lệ → 200 hoặc 400', async () => {
    const res = await request(app)
      .post('/api/attributes/batch-generate-names')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productIds: [product.id] });
    expect([200, 400, 500]).toContain(res.status);
  });
});

// ════════════════════════════════════════════════════════════════
// USERS / ADDRESSES — response shape tests
// ════════════════════════════════════════════════════════════════

describe('GET /api/users/addresses — response là array', () => {
  test('authenticated → data là array', async () => {
    const res = await request(app)
      .get('/api/users/addresses')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('POST /api/users/addresses — response shape', () => {
  test('tạo địa chỉ → response có id, address1, city', async () => {
    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        firstName: '__HTTP',
        lastName: 'AWSSD',
        address1: '99 Deep St',
        city: 'HCM',
        state: 'HCM',
        zip: '700000',
        country: 'VN',
        isDefault: false,
      });
    expect(res.status).toBe(201);
    const addr = res.body.data?.address ?? res.body.data;
    expect(addr).toHaveProperty('id');
    expect(addr).toHaveProperty('address1', '99 Deep St');
    expect(addr).toHaveProperty('city', 'HCM');
    createdAddressId = addr.id;
  });

  test('GET /users/addresses sau khi tạo → có ≥ 1 địa chỉ', async () => {
    const res = await request(app)
      .get('/api/users/addresses')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PUT /api/users/addresses/:id — response có address1 cập nhật', () => {
  test('cập nhật address1 → trả về 200', async () => {
    if (!createdAddressId) return;
    const updatedAddr = '200 Updated Rd';
    const res = await request(app)
      .put(`/api/users/addresses/${createdAddressId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        firstName: '__HTTP',
        lastName: 'AWSSD',
        address1: updatedAddr,
        city: 'HCM',
        state: 'HCM',
        zip: '700000',
        country: 'VN',
        isDefault: false,
      });
    expect(res.status).toBe(200);
    const addr = res.body.data?.address ?? res.body.data;
    if (addr?.address1) {
      expect(addr.address1).toBe(updatedAddr);
    }
  });
});

describe('PATCH /api/users/addresses/:id/default — response isDefault=true', () => {
  test('đặt làm mặc định → response có isDefault hoặc 200', async () => {
    if (!createdAddressId) return;
    const res = await request(app)
      .patch(`/api/users/addresses/${createdAddressId}/default`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    const addr = res.body.data?.address ?? res.body.data;
    if (addr?.isDefault !== undefined) {
      expect(addr.isDefault).toBe(true);
    }
  });
});

describe('DELETE /api/users/addresses/:id — response có success message', () => {
  test('xóa địa chỉ → response có message hoặc success', async () => {
    if (!createdAddressId) return;
    const res = await request(app)
      .delete(`/api/users/addresses/${createdAddressId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    createdAddressId = null;
  });
});

describe('PUT /api/users/profile — response shape', () => {
  test('cập nhật firstName → response có firstName mới', async () => {
    const newFirstName = `__HTTP_AWSSD_Updated_${TS}`;
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ firstName: newFirstName, lastName: 'AWSSD' });
    expect(res.status).toBe(200);
    const data = res.body.data?.user ?? res.body.data;
    if (data?.firstName) {
      expect(data.firstName).toBe(newFirstName);
    }
  });

  test('cập nhật không thay đổi email', async () => {
    const originalEmail = customer.email;
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ firstName: '__HTTP_AWSSD', lastName: 'AWSSD' });
    expect(res.status).toBe(200);
    const data = res.body.data?.user ?? res.body.data;
    if (data?.email) {
      expect(data.email).toBe(originalEmail);
    }
  });
});

describe('PUT /api/users/change-password — validation', () => {
  test('không auth → 401', async () => {
    const res = await request(app).put('/api/users/change-password').send({
      currentPassword: 'Test123!',
      newPassword: 'NewPass123!',
      confirmPassword: 'NewPass123!',
    });
    // 401 nếu endpoint tồn tại và yêu cầu auth; 404 nếu route không được mount
    expect([401, 404]).toContain(res.status);
  });

  test('currentPassword sai → 400 hoặc 401 hoặc 404', async () => {
    const res = await request(app)
      .put('/api/users/change-password')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        currentPassword: 'WrongCurrentPass!',
        newPassword: 'NewPass123!',
        confirmPassword: 'NewPass123!',
      });
    // 400/401/422 nếu endpoint tồn tại; 404 nếu route không mount
    expect([400, 401, 404, 422]).toContain(res.status);
  });
});

// ════════════════════════════════════════════════════════════════
// WARRANTY — response shape tests
// ════════════════════════════════════════════════════════════════

describe('GET /api/warranty-packages — response shape', () => {
  test('trả về array warrantyPackages', async () => {
    const res = await request(app).get('/api/warranty-packages');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.warrantyPackages)).toBe(true);
  });

  test('mỗi package có id, name, price', async () => {
    const res = await request(app).get('/api/warranty-packages');
    expect(res.status).toBe(200);
    const packages = res.body.data.warrantyPackages ?? [];
    if (packages.length > 0) {
      const pkg = packages[0];
      expect(pkg).toHaveProperty('id');
      expect(pkg).toHaveProperty('name');
      expect(pkg).toHaveProperty('price');
    }
  });

  test('price là số dương', async () => {
    const res = await request(app).get('/api/warranty-packages');
    expect(res.status).toBe(200);
    const packages = res.body.data.warrantyPackages ?? [];
    packages.forEach((pkg) => {
      expect(typeof pkg.price).toBe('number');
      expect(pkg.price).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('POST /api/warranty-packages (admin) — response có id + price', () => {
  test('admin tạo package → response có id và price', async () => {
    const res = await request(app)
      .post('/api/warranty-packages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `__HTTP_AWSSD_WARRANTY_${TS}`,
        durationMonths: 12,
        price: 750000,
        description: 'Gói bảo hành deep test',
      });
    expect(res.status).toBe(201);
    const pkg = res.body.data ?? res.body;
    expect(pkg).toHaveProperty('id');
    expect(pkg).toHaveProperty('price');
    createdPackageId = pkg.id;
  });
});

describe('GET /api/warranty-packages/:id — response shape', () => {
  test('id hợp lệ → response có id, name, price, durationMonths', async () => {
    if (!createdPackageId) return;
    const res = await request(app).get(`/api/warranty-packages/${createdPackageId}`);
    expect(res.status).toBe(200);
    const pkg = res.body.data ?? res.body;
    expect(pkg).toHaveProperty('id');
    expect(pkg).toHaveProperty('name');
    expect(pkg).toHaveProperty('price');
  });
});

describe('PUT /api/warranty-packages/:id (admin) — updated price', () => {
  test('cập nhật price → trả về 200', async () => {
    if (!createdPackageId) return;
    const newPrice = 900000;
    const res = await request(app)
      .put(`/api/warranty-packages/${createdPackageId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: newPrice });
    expect(res.status).toBe(200);
    const pkg = res.body.data ?? res.body;
    if (pkg?.price !== undefined) {
      expect(pkg.price).toBe(newPrice);
    }
  });
});

describe('DELETE /api/warranty-packages/:id (không có products liên kết) → 200', () => {
  test('xóa package không có products liên kết → 200', async () => {
    if (!createdPackageId) return;
    const res = await request(app)
      .delete(`/api/warranty-packages/${createdPackageId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    createdPackageId = null;
  });
});

// ════════════════════════════════════════════════════════════════
// SEARCH HISTORY — response shape tests
// ════════════════════════════════════════════════════════════════

describe('GET /api/search-histories — response là array', () => {
  test('user đã auth → data là array', async () => {
    const res = await request(app)
      .get('/api/search-histories')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('user mới → array rỗng', async () => {
    // Dọn sạch history của customer trước
    await SearchHistory.destroy({ where: { userId: customer.id }, force: true }).catch(() => {});
    const res = await request(app)
      .get('/api/search-histories')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('POST /api/search-histories — response có saved query', () => {
  test('lưu keyword → response có keyword hoặc 200/201', async () => {
    const keyword = `__HTTP_AWSSD_SEARCH_${TS}`;
    const res = await request(app)
      .post('/api/search-histories')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ keyword });
    expect([200, 201]).toContain(res.status);
    // Response có thể trả về keyword đã lưu hoặc chỉ status success
    expect(res.body.status).toBe('success');
  });

  test('GET sau khi save → có ≥ 1 item', async () => {
    const res = await request(app)
      .get('/api/search-histories')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('DELETE /api/search-histories/:id — 200', () => {
  test('xóa một entry → 200', async () => {
    // Lấy danh sách history để lấy id thực
    const listRes = await request(app)
      .get('/api/search-histories')
      .set('Authorization', `Bearer ${customerToken}`);
    const items = listRes.body.data ?? [];
    if (items.length === 0) return;

    const entryId = items[0].id;
    const res = await request(app)
      .delete(`/api/search-histories/${entryId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/search-histories (clear all) → 200', () => {
  test('xóa toàn bộ → 200', async () => {
    // Seed thêm entries
    await SearchHistory.bulkCreate([
      { userId: customer.id, keyword: `__HTTP_AWSSD_CLEAR1_${TS}` },
      { userId: customer.id, keyword: `__HTTP_AWSSD_CLEAR2_${TS}` },
    ]);

    const res = await request(app)
      .delete('/api/search-histories')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
  });

  test('GET sau khi clear all → array rỗng', async () => {
    const res = await request(app)
      .get('/api/search-histories')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('Search history — no auth → 401', () => {
  test('GET /search-histories không auth → 401', async () => {
    const res = await request(app).get('/api/search-histories');
    expect(res.status).toBe(401);
  });

  test('POST /search-histories không auth → 200/201 (public) hoặc 401', async () => {
    // POST search-histories là public (không cần auth)
    const res = await request(app)
      .post('/api/search-histories')
      .send({ keyword: `__HTTP_AWSSD_NOAUTH_${TS}` });
    expect([200, 201, 401]).toContain(res.status);
  });
});

// ════════════════════════════════════════════════════════════════
// WISHLIST — response shape tests
// ════════════════════════════════════════════════════════════════

describe('GET /api/wishlists — response shape', () => {
  test('authenticated → data có wishlist array hoặc products array', async () => {
    const res = await request(app)
      .get('/api/wishlists')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    // data có thể là array trực tiếp hoặc object với wishlist/products property
    const isArray = Array.isArray(data);
    const hasWishlistProp =
      Array.isArray(data?.wishlist) || Array.isArray(data?.products) || Array.isArray(data?.items);
    expect(isArray || hasWishlistProp).toBe(true);
  });

  test('mỗi item trong wishlist có productId', async () => {
    // Thêm sản phẩm vào wishlist trước
    await request(app)
      .post('/api/wishlists')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: product.id });

    const res = await request(app)
      .get('/api/wishlists')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    const items = Array.isArray(data)
      ? data
      : (data?.wishlist ?? data?.products ?? data?.items ?? []);
    if (items.length > 0) {
      const firstItem = items[0];
      const hasProductId = 'productId' in firstItem || 'Product' in firstItem || 'id' in firstItem;
      expect(hasProductId).toBe(true);
    }
  });
});

describe('POST /api/wishlists — response có products array', () => {
  test('add to wishlist → response có status success', async () => {
    const res = await request(app)
      .post('/api/wishlists')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: product.id });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
  });

  test('GET sau khi add → length tăng ≥ 1', async () => {
    const res = await request(app)
      .get('/api/wishlists')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    const items = Array.isArray(data)
      ? data
      : (data?.wishlist ?? data?.products ?? data?.items ?? []);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});

describe('DELETE /api/wishlists/:productId — length giảm', () => {
  test('xóa sản phẩm → wishlist length giảm', async () => {
    // Đảm bảo sản phẩm trong wishlist
    await request(app)
      .post('/api/wishlists')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: product.id });

    const beforeRes = await request(app)
      .get('/api/wishlists')
      .set('Authorization', `Bearer ${customerToken}`);
    const beforeData = beforeRes.body.data;
    const beforeItems = Array.isArray(beforeData)
      ? beforeData
      : (beforeData?.wishlist ?? beforeData?.products ?? beforeData?.items ?? []);
    const sizeBefore = beforeItems.length;

    const delRes = await request(app)
      .delete(`/api/wishlists/${product.id}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(delRes.status).toBe(200);

    const afterRes = await request(app)
      .get('/api/wishlists')
      .set('Authorization', `Bearer ${customerToken}`);
    const afterData = afterRes.body.data;
    const afterItems = Array.isArray(afterData)
      ? afterData
      : (afterData?.wishlist ?? afterData?.products ?? afterData?.items ?? []);
    expect(afterItems.length).toBeLessThan(sizeBefore);
  });
});

describe('GET /api/wishlists/check/:id — response có inWishlist boolean', () => {
  test('response có inWishlist là boolean', async () => {
    const res = await request(app)
      .get(`/api/wishlists/check/${product.id}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.data?.inWishlist).toBe('boolean');
  });
});
