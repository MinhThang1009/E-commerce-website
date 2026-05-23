/**
 * Test POST /api/contact/feedback
 *
 * Rule 30: endpoint mới bắt buộc có test happy path, validation boundary, auth.
 *
 * Tests feedback:
 *  - 422 khi thiếu content (< 10 ký tự)
 *  - 422 khi thiếu name
 *  - 422 khi thiếu email
 *  - 422 khi thiếu subject
 *  - 201 happy path — gửi phản hồi thành công
 */

// ---------- Mocks ----------

jest.mock('@models', () => ({
  // Phase 42 modules/content yêu cầu đầy đủ models cho DI; các model không liên
  // quan stub rỗng để không crash module init.
  Feedback: {
    create: jest.fn(),
  },
  User: { findAll: jest.fn(), findByPk: jest.fn() },
  sequelize: {
    Sequelize: { Op: {} },
  },
}));

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
}));

// email service: fire-and-forget trong controller, không cần thực sự gửi
jest.mock('@services/email', () => ({
  sendAdminFeedbackNotification: jest.fn().mockResolvedValue(undefined),
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const buildContentModule = require('@modules/content/module');
const { Feedback, User } = require('@models');
const emailService = require('@services/email');
const eventBus = require('@shared/event-bus');
const logger = require('@utils/logger');

const contentModule = buildContentModule({
  Feedback,
  User,
  emailService,
  eventBus,
  logger,
});

const app = express();
app.use(express.json());
app.use('/api/contact', contentModule.router);
app.use((err, _req, res, _next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});

const request = supertest(app);

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
    const res = await request.post('/api/contact/feedback').send({ ...validBody, content: 'Ngắn' });
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
    expect(Feedback.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
  });
});
