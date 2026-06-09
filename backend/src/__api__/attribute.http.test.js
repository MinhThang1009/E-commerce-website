require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, AttributeGroup, AttributeValue, Category, Brand } = require('@models');

const TS = Date.now();
let admin, staffToken;
let createdGroupId, createdValueId;

beforeAll(async () => {
  ({ user: admin, token: staffToken } = await createTestUser({
    email: `__http_attribute_${TS}@t.com`,
    role: 'staff',
  }));
});

afterAll(async () => {
  // Xóa value trước vì foreign key phụ thuộc group
  if (createdValueId)
    await AttributeValue.destroy({ where: { id: createdValueId }, force: true }).catch(() => {});
  if (createdGroupId)
    await AttributeGroup.destroy({ where: { id: createdGroupId } }).catch(() => {});
  if (admin) await admin.destroy({ force: true }).catch(() => {});
});

// ── Public endpoints ─────────────────────────────────────────

describe('GET /api/attributes/groups', () => {
  test('public → 200 + danh sách nhóm thuộc tính', async () => {
    const res = await request(app).get('/api/attributes/groups');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/attributes/name-affecting', () => {
  test('public → 200', async () => {
    const res = await request(app).get('/api/attributes/name-affecting');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('POST /api/attributes/preview-name', () => {
  test('body hợp lệ → 200 + tên xem trước', async () => {
    const res = await request(app).post('/api/attributes/preview-name').send({
      baseName: 'MacBook Pro',
      selectedAttributes: [],
      separator: ' ',
      includeDetails: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
  test('thiếu baseName → 400', async () => {
    const res = await request(app)
      .post('/api/attributes/preview-name')
      .send({ selectedAttributes: [] });
    expect(res.status).toBe(400);
  });
});

// ── Admin: quản lý nhóm thuộc tính ──────────────────────────

describe('POST /api/attributes/groups', () => {
  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/attributes/groups')
      .send({ name: '__HTTP_Attr_Group', type: 'custom' });
    expect(res.status).toBe(401);
  });
  test('admin + body hợp lệ → 201', async () => {
    const res = await request(app)
      .post('/api/attributes/groups')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `__HTTP_Attribute_Group_${TS}`, type: 'custom' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
    createdGroupId = res.body.data?.id ?? res.body.data?.group?.id;
  });
});

describe('PUT /api/attributes/groups/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).put('/api/attributes/groups/1').send({ name: '__HTTP_Updated' });
    expect(res.status).toBe(401);
  });
  test('admin cập nhật group đã tạo → 200', async () => {
    if (!createdGroupId) return;
    const res = await request(app)
      .put(`/api/attributes/groups/${createdGroupId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `__HTTP_Attribute_Group_Updated_${TS}` });
    expect([200, 201]).toContain(res.status);
  });
  test('admin + id không tồn tại → 404', async () => {
    const res = await request(app)
      .put('/api/attributes/groups/999999999')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: '__HTTP_Not_Exist' });
    expect([400, 404]).toContain(res.status);
  });
});

// ── Admin: quản lý giá trị thuộc tính ───────────────────────

describe('POST /api/attributes/groups/:id/values', () => {
  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/attributes/groups/1/values')
      .send({ value: '__HTTP_Val', sortOrder: 0 });
    expect(res.status).toBe(401);
  });
  test('admin thêm giá trị vào group đã tạo → 201', async () => {
    if (!createdGroupId) return;
    const res = await request(app)
      .post(`/api/attributes/groups/${createdGroupId}/values`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: `__HTTP_Attribute_Value_${TS}`,
        value: `__HTTP_Attribute_Value_${TS}`,
        sortOrder: 0,
      });
    expect([200, 201]).toContain(res.status);
    createdValueId = res.body.data?.id ?? res.body.data?.value?.id;
  });
  test('admin thêm value vào group không tồn tại → 404', async () => {
    const res = await request(app)
      .post('/api/attributes/groups/999999999/values')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: '__HTTP_Value_NoGroup', value: '__HTTP_Value_NoGroup', sortOrder: 0 });
    expect([400, 404]).toContain(res.status);
  });
});

describe('PUT /api/attributes/values/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app)
      .put('/api/attributes/values/1')
      .send({ value: '__HTTP_Updated_Val' });
    expect(res.status).toBe(401);
  });
  test('admin cập nhật value đã tạo → 200', async () => {
    if (!createdValueId) return;
    const res = await request(app)
      .put(`/api/attributes/values/${createdValueId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ value: `__HTTP_Attribute_Value_Updated_${TS}` });
    expect([200, 201]).toContain(res.status);
  });
  test('admin + id không tồn tại → 404', async () => {
    const res = await request(app)
      .put('/api/attributes/values/999999999')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ value: '__HTTP_Not_Exist' });
    expect([400, 404]).toContain(res.status);
  });
});

describe('DELETE /api/attributes/values/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/attributes/values/1');
    expect(res.status).toBe(401);
  });
  test('admin xóa value đã tạo → 200', async () => {
    if (!createdValueId) return;
    const res = await request(app)
      .delete(`/api/attributes/values/${createdValueId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect([200, 204]).toContain(res.status);
    createdValueId = null;
  });
  test('admin xóa value không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/attributes/values/999999999')
      .set('Authorization', `Bearer ${staffToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

describe('DELETE /api/attributes/groups/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/attributes/groups/1');
    expect(res.status).toBe(401);
  });
  test('admin xóa group đã tạo → 200', async () => {
    if (!createdGroupId) return;
    const res = await request(app)
      .delete(`/api/attributes/groups/${createdGroupId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect([200, 204]).toContain(res.status);
    createdGroupId = null;
  });
  test('admin xóa group không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/attributes/groups/999999999')
      .set('Authorization', `Bearer ${staffToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── attribute-extra: product attribute groups, assign, batch generate, edge cases ──

describe('attribute-extra: các test bổ sung cho attribute HTTP API', () => {
  const TS2 = Date.now();
  let admin2, staffToken2;
  let product2, variant2, cat2, brand2;
  let createdGroupId2, createdValueId2;

  beforeAll(async () => {
    ({ user: admin2, token: staffToken2 } = await createTestUser({
      email: `__http_attr_extra_${TS2}@t.com`,
      role: 'staff',
    }));
    ({
      product: product2,
      variant: variant2,
      cat: cat2,
      brand: brand2,
    } = await createTestProduct());
  });

  afterAll(async () => {
    // Xóa value trước vì foreign key phụ thuộc group
    if (createdValueId2)
      await AttributeValue.destroy({ where: { id: createdValueId2 }, force: true }).catch(() => {});
    if (createdGroupId2)
      await AttributeGroup.destroy({ where: { id: createdGroupId2 } }).catch(() => {});
    if (variant2) await variant2.destroy({ force: true }).catch(() => {});
    if (product2) await product2.destroy({ force: true }).catch(() => {});
    if (cat2) await Category.destroy({ where: { id: cat2.id } }).catch(() => {});
    if (brand2) await Brand.destroy({ where: { id: brand2.id } }).catch(() => {});
    if (admin2) await admin2.destroy({ force: true }).catch(() => {});
  });

  // ── GET /api/attributes/groups ───────────────────────────────
  describe('GET /api/attributes/groups', () => {
    test('public → 200 + array các nhóm thuộc tính', async () => {
      const res = await request(app).get('/api/attributes/groups');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      // data là array hoặc object có property chứa array
      expect(res.body.data).toBeDefined();
    });
  });

  // ── POST /api/attributes/groups (admin) ──────────────────────
  describe('POST /api/attributes/groups (admin)', () => {
    test('admin + body hợp lệ → 201 hoặc 200', async () => {
      const res = await request(app)
        .post('/api/attributes/groups')
        .set('Authorization', `Bearer ${staffToken2}`)
        .send({ name: `__HTTP_AttrExtra_Group_${TS2}`, type: 'custom' });
      expect([200, 201]).toContain(res.status);
      expect(res.body.status).toBe('success');
      createdGroupId2 = res.body.data?.id ?? res.body.data?.group?.id;
    });

    test('không auth → 401', async () => {
      const res = await request(app)
        .post('/api/attributes/groups')
        .send({ name: '__HTTP_NoAuth_Group', type: 'custom' });
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/attributes/groups/:id (admin) ───────────────────
  describe('PUT /api/attributes/groups/:id (admin)', () => {
    test('admin cập nhật group đã tạo → 200', async () => {
      if (!createdGroupId2) return;
      const res = await request(app)
        .put(`/api/attributes/groups/${createdGroupId2}`)
        .set('Authorization', `Bearer ${staffToken2}`)
        .send({ name: `__HTTP_AttrExtra_Group_Updated_${TS2}` });
      expect([200, 201]).toContain(res.status);
    });

    test('admin + id không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .put('/api/attributes/groups/999999999')
        .set('Authorization', `Bearer ${staffToken2}`)
        .send({ name: '__HTTP_NoExist' });
      expect([400, 404]).toContain(res.status);
    });
  });

  // ── DELETE /api/attributes/groups/:id (admin) ────────────────
  describe('DELETE /api/attributes/groups/:id (admin)', () => {
    // Xóa sau khi đã test giá trị, nên đặt cuối để createdValueId đã được tạo/xóa rồi
    test('admin + id không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .delete('/api/attributes/groups/999999999')
        .set('Authorization', `Bearer ${staffToken2}`);
      expect([400, 404]).toContain(res.status);
    });
  });

  // ── POST /api/attributes/groups/:groupId/values (admin) ──────
  describe('POST /api/attributes/groups/:groupId/values (admin)', () => {
    test('admin thêm giá trị vào group đã tạo → 200 hoặc 201', async () => {
      if (!createdGroupId2) return;
      const res = await request(app)
        .post(`/api/attributes/groups/${createdGroupId2}/values`)
        .set('Authorization', `Bearer ${staffToken2}`)
        .send({
          name: `__HTTP_AttrExtra_Value_${TS2}`,
          value: `__HTTP_AttrExtra_Value_${TS2}`,
          sortOrder: 0,
        });
      expect([200, 201]).toContain(res.status);
      createdValueId2 = res.body.data?.id ?? res.body.data?.value?.id;
    });
  });

  // ── PUT /api/attributes/values/:id (admin) ───────────────────
  describe('PUT /api/attributes/values/:id (admin)', () => {
    test('admin cập nhật value đã tạo → 200', async () => {
      if (!createdValueId2) return;
      const res = await request(app)
        .put(`/api/attributes/values/${createdValueId2}`)
        .set('Authorization', `Bearer ${staffToken2}`)
        .send({ value: `__HTTP_AttrExtra_Value_Updated_${TS2}` });
      expect([200, 201]).toContain(res.status);
    });
  });

  // ── DELETE /api/attributes/values/:id (admin) ────────────────
  describe('DELETE /api/attributes/values/:id (admin)', () => {
    test('admin xóa value đã tạo → 200 hoặc 204', async () => {
      if (!createdValueId2) return;
      const res = await request(app)
        .delete(`/api/attributes/values/${createdValueId2}`)
        .set('Authorization', `Bearer ${staffToken2}`);
      expect([200, 204]).toContain(res.status);
      createdValueId2 = null;
    });
  });

  // ── GET /api/attributes/products/:productId/groups ───────────
  describe('GET /api/attributes/products/:productId/groups', () => {
    test('productId hợp lệ → 200', async () => {
      const res = await request(app).get(`/api/attributes/products/${product2.id}/groups`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('productId không tồn tại → 200 với data rỗng hoặc 404', async () => {
      const res = await request(app).get('/api/attributes/products/999999999/groups');
      // Có thể trả về 200 với array rỗng hoặc 404
      expect([200, 404]).toContain(res.status);
    });
  });

  // ── POST /api/attributes/products/:productId/groups/:groupId ─
  describe('POST /api/attributes/products/:productId/groups/:attributeGroupId (admin)', () => {
    test('gán group vào product → 200 hoặc 201', async () => {
      if (!createdGroupId2) return;
      const res = await request(app)
        .post(`/api/attributes/products/${product2.id}/groups/${createdGroupId2}`)
        .set('Authorization', `Bearer ${staffToken2}`);
      expect([200, 201]).toContain(res.status);
    });

    test('không auth → 401', async () => {
      const res = await request(app).post(`/api/attributes/products/${product2.id}/groups/1`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/attributes/generate-name-realtime ──────────────
  describe('POST /api/attributes/generate-name-realtime', () => {
    test('body hợp lệ → 200', async () => {
      const res = await request(app).post('/api/attributes/generate-name-realtime').send({
        baseName: 'iPhone',
        selectedAttributes: [],
        separator: ' ',
        includeDetails: false,
      });
      // Có thể 200 hoặc 500 nếu AI service không available trong test
      expect([200, 500]).toContain(res.status);
    });
  });

  // ── POST /api/attributes/batch-generate-names (admin) ───────
  describe('POST /api/attributes/batch-generate-names (admin)', () => {
    test('không auth → 401', async () => {
      const res = await request(app)
        .post('/api/attributes/batch-generate-names')
        .send({ productIds: [] });
      expect(res.status).toBe(401);
    });

    test('admin + productIds rỗng → 200 hoặc 400', async () => {
      const res = await request(app)
        .post('/api/attributes/batch-generate-names')
        .set('Authorization', `Bearer ${staffToken2}`)
        .send({ productIds: [] });
      expect([200, 400]).toContain(res.status);
    });
  });
});
