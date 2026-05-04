/**
 * Test POST /api/contact/newsletter và POST /api/contact/feedback
 *
 * Rule 30: endpoint mới bắt buộc có test happy path, validation boundary, auth.
 *
 * Tests newsletter:
 *  - 422 khi thiếu email
 *  - 422 khi email không hợp lệ
 *  - 200 happy path — đăng ký thành công
 *  - 200 khi đã đăng ký trước đó (idempotent)
 *
 * Tests feedback:
 *  - 422 khi thiếu content (< 10 ký tự)
 *  - 422 khi thiếu name
 *  - 422 khi thiếu email
 *  - 422 khi thiếu subject
 *  - 201 happy path — gửi phản hồi thành công
 */

// ---------- Mocks ----------

jest.mock('../models', () => ({
  NewsletterSubscriber: {
    findOrCreate: jest.fn(),
  },
  Feedback: {
    create: jest.fn(),
  },
  sequelize: {
    Sequelize: { Op: {} },
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../middlewares/rateLimiter', () => ({
  chatLimiter: (_req, _res, next) => next(),
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
}));

// email service: fire-and-forget trong controller, không cần thực sự gửi
jest.mock('../services/email', () => ({
  sendNewsletterWelcomeEmail:       jest.fn().mockResolvedValue(undefined),
  sendAdminFeedbackNotification:    jest.fn().mockResolvedValue(undefined),
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const contactRouter = require('../routes/contact');
const { NewsletterSubscriber, Feedback } = require('../models');

const app = express();
app.use(express.json());
app.use('/api/contact', contactRouter);
app.use((err, _req, res, _next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});

const request = supertest(app);

// ============================================================
// POST /api/contact/newsletter
// ============================================================

describe('POST /api/contact/newsletter — subscribeNewsletter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Validation ---

  test('422 khi thiếu email', async () => {
    const res = await request.post('/api/contact/newsletter').send({});
    expect(res.status).toBe(422);
  });

  test('422 khi email không hợp lệ', async () => {
    const res = await request
      .post('/api/contact/newsletter')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
  });

  // --- Happy path ---

  // Người dùng mới (created = true) → 201 theo REST convention
  test('201 happy path — đăng ký mới thành công', async () => {
    const mockSubscriber = { email: 'test@example.com', status: 'active' };
    NewsletterSubscriber.findOrCreate.mockResolvedValue([mockSubscriber, true]);

    const res = await request
      .post('/api/contact/newsletter')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
  });

  test('200 khi đã đăng ký trước đó — idempotent', async () => {
    const mockSubscriber = { email: 'existing@example.com', status: 'active' };
    NewsletterSubscriber.findOrCreate.mockResolvedValue([mockSubscriber, false]);

    const res = await request
      .post('/api/contact/newsletter')
      .send({ email: 'existing@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ============================================================
// POST /api/contact/feedback
// ============================================================

describe('POST /api/contact/feedback — sendFeedback', () => {
  const validBody = {
    name: 'Nguyễn Văn A',
    email: 'user@example.com',
    subject: 'Góp ý sản phẩm',
    content: 'Sản phẩm rất tốt, tôi rất hài lòng với chất lượng.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Feedback.create.mockResolvedValue({ id: 1, ...validBody, status: 'pending' });
  });

  // --- Validation ---

  test('422 khi thiếu name', async () => {
    const { name: _n, ...body } = validBody;
    const res = await request.post('/api/contact/feedback').send(body);
    expect(res.status).toBe(422);
  });

  test('422 khi thiếu email', async () => {
    const { email: _e, ...body } = validBody;
    const res = await request.post('/api/contact/feedback').send(body);
    expect(res.status).toBe(422);
  });

  test('422 khi thiếu subject', async () => {
    const { subject: _s, ...body } = validBody;
    const res = await request.post('/api/contact/feedback').send(body);
    expect(res.status).toBe(422);
  });

  test('422 khi content < 10 ký tự', async () => {
    const res = await request
      .post('/api/contact/feedback')
      .send({ ...validBody, content: 'Ngắn' });
    expect(res.status).toBe(422);
  });

  test('422 khi thiếu content', async () => {
    const { content: _c, ...body } = validBody;
    const res = await request.post('/api/contact/feedback').send(body);
    expect(res.status).toBe(422);
  });

  // --- Happy path ---

  test('201 happy path — gửi phản hồi thành công', async () => {
    const res = await request.post('/api/contact/feedback').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(Feedback.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' })
    );
  });
});
