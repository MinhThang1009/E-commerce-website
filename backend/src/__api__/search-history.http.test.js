require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { User, SearchHistory } = require('@models');

const TS = Date.now();
let user, token;

beforeAll(async () => {
  ({ user, token } = await createTestUser({
    email: `__http_searchhist_${TS}@t.com`,
  }));
});

afterAll(async () => {
  await SearchHistory.destroy({ where: { userId: user?.id }, force: true });
  await User.destroy({ where: { id: user?.id }, force: true });
});

// ── POST (public) ────────────────────────────────────────────
describe('POST /api/search-histories', () => {
  test('keyword hợp lệ, không cần auth → 200 hoặc 201', async () => {
    const res = await request(app)
      .post('/api/search-histories')
      .send({ keyword: `__HTTP_SEARCHHIST_${TS}` });
    expect([200, 201]).toContain(res.status);
  });

  test('keyword hợp lệ, có auth → 200 hoặc 201', async () => {
    const res = await request(app)
      .post('/api/search-histories')
      .set('Authorization', `Bearer ${token}`)
      .send({ keyword: `__HTTP_SEARCHHIST_AUTH_${TS}` });
    expect([200, 201]).toContain(res.status);
  });

  test('thiếu keyword → 422', async () => {
    const res = await request(app).post('/api/search-histories').send({});
    expect(res.status).toBe(422);
  });

  test('keyword rỗng → 422', async () => {
    const res = await request(app).post('/api/search-histories').send({ keyword: '' });
    expect(res.status).toBe(422);
  });
});

// ── GET (authenticate) ───────────────────────────────────────
describe('GET /api/search-histories', () => {
  test('không auth → 401', async () => {
    const res = await request(app).get('/api/search-histories');
    expect(res.status).toBe(401);
  });

  test('có auth → 200 + trả về array', async () => {
    const res = await request(app)
      .get('/api/search-histories')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ── DELETE /:id (authenticate) ───────────────────────────────
describe('DELETE /api/search-histories/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/search-histories/1');
    expect(res.status).toBe(401);
  });

  test('id không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/search-histories/999999999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('id thuộc user hiện tại → 200', async () => {
    // Tạo 1 entry trước rồi xóa để test happy path
    const saved = await SearchHistory.create({
      userId: user.id,
      keyword: `__HTTP_TO_DELETE_${TS}`,
    });
    const res = await request(app)
      .delete(`/api/search-histories/${saved.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ── DELETE / — xóa tất cả (authenticate) ────────────────────
describe('DELETE /api/search-histories (clear all)', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/search-histories');
    expect(res.status).toBe(401);
  });

  test('có auth → 200, xóa toàn bộ lịch sử', async () => {
    // Seed thêm vài entry trước khi clear
    await SearchHistory.bulkCreate([
      { userId: user.id, keyword: `__HTTP_CLEAR_1_${TS}` },
      { userId: user.id, keyword: `__HTTP_CLEAR_2_${TS}` },
    ]);

    const res = await request(app)
      .delete('/api/search-histories')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    // Xác nhận DB sạch
    const remaining = await SearchHistory.count({ where: { userId: user.id } });
    expect(remaining).toBe(0);
  });
});
