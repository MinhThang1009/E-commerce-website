require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { User, Address } = require('@models');

const TS = Date.now();
let user, token, createdAddressId;

/** Payload địa chỉ hợp lệ dùng chung cho nhiều test */
const validAddress = {
  firstName: '__HTTP_UsersComp',
  lastName: 'Test',
  address1: '123 Đường Test',
  city: 'Hồ Chí Minh',
  state: 'HCM',
  zip: '700000',
  country: 'VN',
  isDefault: false,
};

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_userscomp_${TS}@t.com` }));
});

afterAll(async () => {
  if (user) await Address.destroy({ where: { userId: user.id }, force: true }).catch(() => {});
  if (user) await user.destroy({ force: true }).catch(() => {});
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  test('authenticated → 200 kèm thông tin user hiện tại', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // Phải trả về email của user đang đăng nhập
    expect(res.body.data?.email).toBe(user.email);
  });

  test('không auth → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/users/profile ────────────────────────────────────────────────────

describe('PUT /api/users/profile', () => {
  test('cập nhật firstName thành công → 200 + firstName mới', async () => {
    const updatedName = `__HTTP_UsersComp_Updated_${TS}`;
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: updatedName, lastName: 'Test' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('firstName rỗng → 400 validation error', async () => {
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: '', lastName: 'Test' });
    expect(res.status).toBe(400);
  });

  test('không auth → 401', async () => {
    const res = await request(app).put('/api/users/profile').send({ firstName: 'NoAuth' });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/users/addresses ──────────────────────────────────────────────────

describe('GET /api/users/addresses', () => {
  test('authenticated → 200 + mảng địa chỉ (ban đầu rỗng)', async () => {
    const res = await request(app)
      .get('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('không auth → 401', async () => {
    const res = await request(app).get('/api/users/addresses');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/users/addresses ─────────────────────────────────────────────────

describe('POST /api/users/addresses', () => {
  test('payload đầy đủ → 201 + địa chỉ được tạo', async () => {
    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    createdAddressId = res.body?.data?.id || res.body?.data?.address?.id;
    expect(createdAddressId).toBeDefined();
  });

  test('thiếu trường address1 bắt buộc → 400', async () => {
    const { address1: _omitted, ...withoutAddress1 } = validAddress;
    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(withoutAddress1);
    expect(res.status).toBe(400);
  });

  test('thiếu trường city bắt buộc → 400', async () => {
    const { city: _omitted, ...withoutCity } = validAddress;
    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(withoutCity);
    expect(res.status).toBe(400);
  });

  test('không auth → 401', async () => {
    const res = await request(app).post('/api/users/addresses').send(validAddress);
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/users/addresses/:id ──────────────────────────────────────────────

describe('PUT /api/users/addresses/:id', () => {
  test('cập nhật địa chỉ hợp lệ → 200', async () => {
    if (!createdAddressId) return;
    const updatedAddress = {
      ...validAddress,
      address1: '456 Đường Mới',
      city: 'Hà Nội',
      state: 'HN',
    };
    const res = await request(app)
      .put(`/api/users/addresses/${createdAddressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updatedAddress);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('không auth → 401', async () => {
    const res = await request(app)
      .put(`/api/users/addresses/${createdAddressId || 1}`)
      .send(validAddress);
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/users/addresses/:id/default ────────────────────────────────────

describe('PATCH /api/users/addresses/:id/default', () => {
  test('đặt địa chỉ làm mặc định → 200', async () => {
    if (!createdAddressId) return;
    const res = await request(app)
      .patch(`/api/users/addresses/${createdAddressId}/default`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('không auth → 401', async () => {
    const res = await request(app).patch(`/api/users/addresses/${createdAddressId || 1}/default`);
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/users/addresses/:id ──────────────────────────────────────────

describe('DELETE /api/users/addresses/:id', () => {
  test('xóa địa chỉ tồn tại → 200', async () => {
    if (!createdAddressId) return;
    const res = await request(app)
      .delete(`/api/users/addresses/${createdAddressId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('id không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/users/addresses/999999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/users/addresses/999999');
    expect(res.status).toBe(401);
  });
});
