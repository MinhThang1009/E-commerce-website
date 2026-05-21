require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { User, AttributeGroup, AttributeValue } = require('@models');

const TS = Date.now();
let admin, adminToken;
let createdGroupId, createdValueId;

beforeAll(async () => {
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_attribute_${TS}@t.com`,
    role: 'admin',
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
      .set('Authorization', `Bearer ${adminToken}`)
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
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `__HTTP_Attribute_Group_Updated_${TS}` });
    expect([200, 201]).toContain(res.status);
  });
  test('admin + id không tồn tại → 404', async () => {
    const res = await request(app)
      .put('/api/attributes/groups/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
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
      .set('Authorization', `Bearer ${adminToken}`)
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
      .set('Authorization', `Bearer ${adminToken}`)
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
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: `__HTTP_Attribute_Value_Updated_${TS}` });
    expect([200, 201]).toContain(res.status);
  });
  test('admin + id không tồn tại → 404', async () => {
    const res = await request(app)
      .put('/api/attributes/values/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
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
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(res.status);
    createdValueId = null;
  });
  test('admin xóa value không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/attributes/values/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
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
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(res.status);
    createdGroupId = null;
  });
  test('admin xóa group không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/attributes/groups/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([400, 404]).toContain(res.status);
  });
});
