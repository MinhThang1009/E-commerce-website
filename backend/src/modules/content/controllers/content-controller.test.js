// Unit tests cho ContentController — chỉ còn contact/feedback.
const ContentController = require('./content-controller');

function makeRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  return res;
}

function makeReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: undefined,
    ...overrides,
  };
}

let contentService;
let controller;

beforeEach(() => {
  contentService = {
    sendFeedback: jest.fn(),
  };
  controller = new ContentController({ contentService });
});

describe('ContentController — Feedback', () => {
  describe('sendFeedback', () => {
    it('trả 201 với message cảm ơn và data feedback', async () => {
      const feedbackRecord = { id: 1, name: 'Nguyễn Văn A', message: 'Sản phẩm tốt' };
      contentService.sendFeedback.mockResolvedValue(feedbackRecord);

      const req = makeReq({
        body: { name: 'Nguyễn Văn A', email: 'a@test.com', message: 'Sản phẩm tốt' },
      });
      const res = makeRes();
      const next = jest.fn();

      await controller.sendFeedback(req, res, next);

      expect(contentService.sendFeedback).toHaveBeenCalledWith({ payload: req.body });
      expect(res._status).toBe(201);
      expect(res._body.status).toBe('success');
      expect(res._body.message).toContain('Cảm ơn');
      expect(res._body.data).toEqual(feedbackRecord);
      expect(next).not.toHaveBeenCalled();
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      contentService.sendFeedback.mockRejectedValue(new Error('lưu thất bại'));

      const next = jest.fn();
      await controller.sendFeedback(makeReq({ body: {} }), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });
  });
});

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

describe('POST /api/contact/feedback — sendFeedback', () => {
  let request;
  let Feedback;
  let emailService;

  beforeAll(() => {
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

    const express = require('express');
    const supertest = require('supertest');
    const buildContentModule = require('@modules/content/module');
    const models = require('@models');
    Feedback = models.Feedback;
    const { User } = models;
    emailService = require('@services/email');
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

    request = supertest(app);
  });

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
