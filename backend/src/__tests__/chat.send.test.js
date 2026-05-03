/**
 * Test POST /api/chat — sendMessage
 *
 * Rule 30: endpoint mới bắt buộc có test happy path, validation boundary, auth.
 *
 * Tests:
 *  - 422 khi content vượt 2000 ký tự (validation boundary)
 *  - 422 khi content đúng 2001 ký tự
 *  - 201 khi content đúng 2000 ký tự (boundary hợp lệ)
 *  - 422 khi thiếu content
 *  - 400 khi guest không cung cấp sessionId
 *  - 201 happy path — user đã đăng nhập
 *  - 201 happy path — guest có sessionId
 */

// ---------- Mocks ----------

jest.mock('../models', () => ({
  ChatMessage: {
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

// optionalAuthenticate: inject user nếu có Authorization header
jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    req.user = { id: 1, role: 'user' };
    next();
  },
  optionalAuthenticate: (req, _res, next) => {
    if (req.headers.authorization) {
      req.user = { id: 1, role: 'user' };
    }
    next();
  },
}));

jest.mock('../middlewares/adminAuth', () => ({
  adminAuthenticate: (_req, _res, next) => next(),
}));

// chatLimiter: bypass trong tests
jest.mock('../middlewares/rateLimiter', () => ({
  chatLimiter: (_req, _res, next) => next(),
  chatbotLimiter: (_req, _res, next) => next(),
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const chatRouter = require('../routes/chat');
const { ChatMessage } = require('../models');

const app = express();
app.use(express.json());
app.use('/api/chat', chatRouter);
// Error handler đơn giản bắt next(error)
app.use((err, _req, res, _next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});

const request = supertest(app);

// Chuỗi có độ dài chính xác N ký tự
const str = (n) => 'a'.repeat(n);

// ============================================================
// POST /api/chat — sendMessage
// ============================================================

describe('POST /api/chat — sendMessage', () => {
  beforeEach(() => {
    ChatMessage.create.mockResolvedValue({
      id: 1,
      content: 'Xin chào',
      userId: 1,
      sessionId: null,
      isFromAdmin: false,
      isRead: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- Validation boundary: max 2000 ký tự ---

  test('422 khi content = 2001 ký tự (vượt max)', async () => {
    const res = await request
      .post('/api/chat')
      .set('Authorization', 'Bearer token')
      .send({ content: str(2001) });
    expect(res.status).toBe(422);
  });

  test('201 khi content = 2000 ký tự (đúng boundary hợp lệ)', async () => {
    const res = await request
      .post('/api/chat')
      .set('Authorization', 'Bearer token')
      .send({ content: str(2000) });
    expect(res.status).toBe(201);
  });

  test('201 khi content = 1 ký tự (min boundary)', async () => {
    const res = await request
      .post('/api/chat')
      .set('Authorization', 'Bearer token')
      .send({ content: 'X' });
    expect(res.status).toBe(201);
  });

  // --- Validation: thiếu content ---

  test('422 khi thiếu content', async () => {
    const res = await request
      .post('/api/chat')
      .set('Authorization', 'Bearer token')
      .send({});
    expect(res.status).toBe(422);
  });

  test('422 khi content là chuỗi rỗng', async () => {
    const res = await request
      .post('/api/chat')
      .set('Authorization', 'Bearer token')
      .send({ content: '' });
    expect(res.status).toBe(422);
  });

  // --- Guest: thiếu sessionId ---

  test('400 khi guest không có Authorization và không có sessionId', async () => {
    const res = await request
      .post('/api/chat')
      .send({ content: 'Xin chào' }); // không có Authorization, không có sessionId
    expect(res.status).toBe(400);
  });

  // --- Happy path: user đăng nhập ---

  test('201 happy path — user đã đăng nhập gửi tin nhắn thành công', async () => {
    const res = await request
      .post('/api/chat')
      .set('Authorization', 'Bearer token')
      .send({ content: 'Tôi muốn hỏi về sản phẩm' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(ChatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ isFromAdmin: false })
    );
  });

  // --- Happy path: guest có sessionId ---

  test('201 happy path — guest có sessionId hợp lệ', async () => {
    const res = await request
      .post('/api/chat')
      .send({
        content: 'Xin hỏi về bảo hành',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
      });
    expect(res.status).toBe(201);
    expect(ChatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: '550e8400-e29b-41d4-a716-446655440000' })
    );
  });
});
