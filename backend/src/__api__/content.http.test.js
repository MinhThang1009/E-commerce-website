require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { Feedback } = require('@models');

const TS = Date.now();
let admin, adminToken;

beforeAll(async () => {
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_content_${TS}@t.com`,
    role: 'admin',
  }));
});

afterAll(async () => {
  // Feedback tạo qua POST /contact/feedback — xóa theo email test
  await Feedback.destroy({ where: { email: `__http_content_fb_${TS}@t.com` }, force: true }).catch(
    () => {},
  );
  if (admin) await admin.destroy({ force: true }).catch(() => {});
});

// ── Contact ──────────────────────────────────────────────────

describe('POST /api/contact/feedback', () => {
  test('body hợp lệ → 200 hoặc 201', async () => {
    const res = await request(app)
      .post('/api/contact/feedback')
      .send({
        name: '__HTTP_Content_User',
        email: `__http_content_fb_${TS}@t.com`,
        subject: 'Phản hồi test',
        content: 'Đây là nội dung phản hồi test tích hợp HTTP đủ dài.',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
  });
  test('thiếu name → 422', async () => {
    const res = await request(app).post('/api/contact/feedback').send({
      email: 'test@example.com',
      subject: 'Subject test',
      content: 'Nội dung test đủ dài tối thiểu mười ký tự.',
    });
    expect(res.status).toBe(422);
  });
  test('email không hợp lệ → 422', async () => {
    const res = await request(app).post('/api/contact/feedback').send({
      name: '__HTTP_User',
      email: 'not-valid-email',
      subject: 'Subject test',
      content: 'Nội dung test đủ dài tối thiểu mười ký tự.',
    });
    expect(res.status).toBe(422);
  });
  test('content quá ngắn → 422', async () => {
    const res = await request(app).post('/api/contact/feedback').send({
      name: '__HTTP_User',
      email: 'test@example.com',
      subject: 'Subject test',
      content: 'Ngắn',
    });
    expect(res.status).toBe(422);
  });
});
