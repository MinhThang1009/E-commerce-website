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

// ── Merged from: users-comprehensive.http.test.js ────────────────────────────

describe('Users Comprehensive', () => {
  const tsComp = Date.now();
  let userComp, tokenComp, createdAddressIdComp;

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
    ({ user: userComp, token: tokenComp } = await createTestUser({
      email: `__http_userscomp_${tsComp}@t.com`,
    }));
  });

  afterAll(async () => {
    if (userComp)
      await Address.destroy({ where: { userId: userComp.id }, force: true }).catch(() => {});
    if (userComp) await userComp.destroy({ force: true }).catch(() => {});
  });

  // ── GET /api/auth/me ────────────────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    test('authenticated → 200 kèm thông tin user hiện tại', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenComp}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      // Phải trả về email của user đang đăng nhập
      expect(res.body.data?.email).toBe(userComp.email);
    });

    test('không auth → 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/users/profile ──────────────────────────────────────────────────

  describe('PUT /api/users/profile', () => {
    test('cập nhật firstName thành công → 200 + firstName mới', async () => {
      const updatedName = `__HTTP_UsersComp_Updated_${tsComp}`;
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${tokenComp}`)
        .send({ firstName: updatedName, lastName: 'Test' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('firstName rỗng → 400 validation error', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${tokenComp}`)
        .send({ firstName: '', lastName: 'Test' });
      expect(res.status).toBe(400);
    });

    test('không auth → 401', async () => {
      const res = await request(app).put('/api/users/profile').send({ firstName: 'NoAuth' });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/users/addresses ────────────────────────────────────────────────

  describe('GET /api/users/addresses', () => {
    test('authenticated → 200 + mảng địa chỉ (ban đầu rỗng)', async () => {
      const res = await request(app)
        .get('/api/users/addresses')
        .set('Authorization', `Bearer ${tokenComp}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('không auth → 401', async () => {
      const res = await request(app).get('/api/users/addresses');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/users/addresses ───────────────────────────────────────────────

  describe('POST /api/users/addresses', () => {
    test('payload đầy đủ → 201 + địa chỉ được tạo', async () => {
      const res = await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${tokenComp}`)
        .send(validAddress);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      createdAddressIdComp = res.body?.data?.id || res.body?.data?.address?.id;
      expect(createdAddressIdComp).toBeDefined();
    });

    test('thiếu trường address1 bắt buộc → 400', async () => {
      const { address1: _omitted, ...withoutAddress1 } = validAddress;
      const res = await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${tokenComp}`)
        .send(withoutAddress1);
      expect(res.status).toBe(400);
    });

    test('thiếu trường city bắt buộc → 400', async () => {
      const { city: _omitted, ...withoutCity } = validAddress;
      const res = await request(app)
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${tokenComp}`)
        .send(withoutCity);
      expect(res.status).toBe(400);
    });

    test('không auth → 401', async () => {
      const res = await request(app).post('/api/users/addresses').send(validAddress);
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/users/addresses/:id ────────────────────────────────────────────

  describe('PUT /api/users/addresses/:id', () => {
    test('cập nhật địa chỉ hợp lệ → 200', async () => {
      if (!createdAddressIdComp) return;
      const updatedAddress = {
        ...validAddress,
        address1: '456 Đường Mới',
        city: 'Hà Nội',
        state: 'HN',
      };
      const res = await request(app)
        .put(`/api/users/addresses/${createdAddressIdComp}`)
        .set('Authorization', `Bearer ${tokenComp}`)
        .send(updatedAddress);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('không auth → 401', async () => {
      const res = await request(app)
        .put(`/api/users/addresses/${createdAddressIdComp || 1}`)
        .send(validAddress);
      expect(res.status).toBe(401);
    });
  });

  // ── PATCH /api/users/addresses/:id/default ──────────────────────────────────

  describe('PATCH /api/users/addresses/:id/default', () => {
    test('đặt địa chỉ làm mặc định → 200', async () => {
      if (!createdAddressIdComp) return;
      const res = await request(app)
        .patch(`/api/users/addresses/${createdAddressIdComp}/default`)
        .set('Authorization', `Bearer ${tokenComp}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('không auth → 401', async () => {
      const res = await request(app).patch(
        `/api/users/addresses/${createdAddressIdComp || 1}/default`,
      );
      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /api/users/addresses/:id ────────────────────────────────────────

  describe('DELETE /api/users/addresses/:id', () => {
    test('xóa địa chỉ tồn tại → 200', async () => {
      if (!createdAddressIdComp) return;
      const res = await request(app)
        .delete(`/api/users/addresses/${createdAddressIdComp}`)
        .set('Authorization', `Bearer ${tokenComp}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('id không tồn tại → 404', async () => {
      const res = await request(app)
        .delete('/api/users/addresses/999999')
        .set('Authorization', `Bearer ${tokenComp}`);
      expect(res.status).toBe(404);
    });

    test('không auth → 401', async () => {
      const res = await request(app).delete('/api/users/addresses/999999');
      expect(res.status).toBe(401);
    });
  });
});
