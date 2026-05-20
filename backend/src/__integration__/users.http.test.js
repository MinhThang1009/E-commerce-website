require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { User, Address } = require('@models');

const TS = Date.now();
let user, token, createdAddressId;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_users_${TS}@t.com` }));
});

afterAll(async () => {
  await Address.destroy({ where: { userId: user?.id }, force: true });
  await User.destroy({ where: { id: user?.id }, force: true });
});

describe('PUT /api/users/profile', () => {
  test('authenticated → 200', async () => {
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: '__HTTP_Updated', lastName: 'Test' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
  test('không auth → 401', async () => {
    const res = await request(app).put('/api/users/profile').send({ firstName: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/addresses', () => {
  test('authenticated → 200', async () => {
    const res = await request(app)
      .get('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('POST /api/users/addresses', () => {
  test('tạo địa chỉ → 201', async () => {
    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: '__HTTP',
        lastName: 'Addr',
        address1: '123 Test St',
        city: 'HCM',
        state: 'HCM',
        zip: '700000',
        country: 'VN',
        isDefault: false,
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    createdAddressId = res.body?.data?.id || res.body?.data?.address?.id;
  });
});

describe('PUT /api/users/addresses/:id', () => {
  test('update → 200', async () => {
    if (!createdAddressId) return;
    const res = await request(app)
      .put(`/api/users/addresses/${createdAddressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: '__HTTP',
        lastName: 'Updated',
        address1: '456 New St',
        city: 'HN',
        state: 'HN',
        zip: '100000',
        country: 'VN',
        isDefault: false,
      });
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/users/addresses/:id/default', () => {
  test('set default → 200', async () => {
    if (!createdAddressId) return;
    const res = await request(app)
      .patch(`/api/users/addresses/${createdAddressId}/default`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/users/addresses/:id', () => {
  test('xóa → 200', async () => {
    if (!createdAddressId) return;
    const res = await request(app)
      .delete(`/api/users/addresses/${createdAddressId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
