/**
 * Test GET /api/chat/admin/list — getAdminChatList
 *
 * AC 9.10b: AI chatbot messages (messageType = 'ai_chatbot') phải bị lọc bỏ.
 * Chỉ lấy support_chat và null được hiển thị trong Admin Dashboard.
 *
 * Tests:
 *  - 401 khi không có token
 *  - 403 khi user không phải admin
 *  - 200 + WHERE clause chỉ query support_chat và null (không có ai_chatbot)
 *  - 200 + response shape đúng (sessionId, lastMessage, unreadCount)
 */

// ---------- Mocks ----------

// Prefix "mock" cho phép Jest hoist biến này vào factory (jest.mock scoping rule)
const mockOpOr = Symbol('or');
const mockOpAnd = Symbol('and');

jest.mock('../models', () => ({
  ChatMessage: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
  sequelize: {
    Sequelize: {
      Op: { or: mockOpOr, and: mockOpAnd },
    },
    // Stub Sequelize helpers dùng trong GROUP BY / ORDER BY
    fn: jest.fn((_func, _col) => 'fn_stub'),
    col: jest.fn((col) => col),
    literal: jest.fn((expr) => ({ literal: expr })),
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// authenticate: inject user dựa theo header để kiểm soát trong từng test
jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    // X-Test-Role header dùng để giả lập role trong test environment
    req.user = { id: 1, role: req.headers['x-test-role'] || 'user' };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
}));

// adminAuthenticate: kiểm tra role admin
jest.mock('../middlewares/adminAuth', () => ({
  adminAuthenticate: (req, res, next) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }
    next();
  },
  requireSuperAdmin: (_req, _res, next) => next(),
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const chatRouter = require('../routes/chat');
const { ChatMessage, User } = require('../models');

// App test với error handler đơn giản để bắt next(error)
const app = express();
app.use(express.json());
app.use('/api/chat', chatRouter);
app.use((err, _req, res, _next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});

const request = supertest(app);

// ============================================================
// GET /api/chat/admin/list
// ============================================================

describe('GET /api/chat/admin/list', () => {
  // Dữ liệu mock: 1 session support, cần verify AI session không được query
  const mockSession = {
    sessionId: 'sess_support_001',
    userId: null,
    getDataValue: jest.fn().mockReturnValue('2025-05-01T10:00:00.000Z'),
  };

  beforeEach(() => {
    ChatMessage.findAll.mockResolvedValue([mockSession]);
    ChatMessage.findOne.mockResolvedValue({ content: 'Xin chào, cần tư vấn sản phẩm' });
    ChatMessage.count.mockResolvedValue(2);
    User.findByPk.mockResolvedValue(null);
  });

  test('401 khi không có Authorization header', async () => {
    const res = await request.get('/api/chat/admin/list');
    expect(res.status).toBe(401);
  });

  test('403 khi user không phải admin', async () => {
    const res = await request
      .get('/api/chat/admin/list')
      .set('Authorization', 'Bearer token')
      .set('X-Test-Role', 'user');    // role = 'user' — không phải admin
    expect(res.status).toBe(403);
  });

  test('200 khi admin truy cập thành công', async () => {
    const res = await request
      .get('/api/chat/admin/list')
      .set('Authorization', 'Bearer token')
      .set('X-Test-Role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('ChatMessage.findAll được gọi với WHERE chỉ có support_chat và null', async () => {
    await request
      .get('/api/chat/admin/list')
      .set('Authorization', 'Bearer token')
      .set('X-Test-Role', 'admin');

    expect(ChatMessage.findAll).toHaveBeenCalled();
    const callOptions = ChatMessage.findAll.mock.calls[0][0];

    // WHERE phải có Op.or key
    expect(callOptions.where).toBeDefined();
    const whereConditions = callOptions.where[mockOpOr];

    expect(whereConditions).toBeDefined();
    expect(whereConditions).toBeInstanceOf(Array);

    // Phải chứa support_chat và null
    expect(whereConditions).toContainEqual({ messageType: 'support_chat' });
    expect(whereConditions).toContainEqual({ messageType: null });

    // AC 9.10b: KHÔNG được có ai_chatbot trong query
    expect(whereConditions).not.toContainEqual({ messageType: 'ai_chatbot' });
    // Số điều kiện phải đúng 2 — không được thêm hay bớt
    expect(whereConditions).toHaveLength(2);
  });

  test('response trả về đúng shape (sessionId, lastMessage, unreadCount)', async () => {
    const res = await request
      .get('/api/chat/admin/list')
      .set('Authorization', 'Bearer token')
      .set('X-Test-Role', 'admin');

    expect(res.status).toBe(200);
    const [session] = res.body.data;

    expect(session).toHaveProperty('sessionId', 'sess_support_001');
    expect(session).toHaveProperty('lastMessage', 'Xin chào, cần tư vấn sản phẩm');
    expect(session).toHaveProperty('unreadCount', 2);
    expect(session).toHaveProperty('user', null); // anonymous session
  });

  test('user null khi session là anonymous (userId = null)', async () => {
    await request
      .get('/api/chat/admin/list')
      .set('Authorization', 'Bearer token')
      .set('X-Test-Role', 'admin');

    // Không được gọi User.findByPk khi userId = null
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  test('user được trả về khi session có userId', async () => {
    const sessionWithUser = {
      sessionId: 'sess_user_001',
      userId: 5,
      getDataValue: jest.fn().mockReturnValue('2025-05-01T11:00:00.000Z'),
    };
    ChatMessage.findAll.mockResolvedValue([sessionWithUser]);
    User.findByPk.mockResolvedValue({
      id: 5, firstName: 'An', lastName: 'Nguyen', email: 'an@example.com', avatar: null,
    });

    const res = await request
      .get('/api/chat/admin/list')
      .set('Authorization', 'Bearer token')
      .set('X-Test-Role', 'admin');

    expect(res.status).toBe(200);
    expect(User.findByPk).toHaveBeenCalledWith(5, expect.any(Object));
    expect(res.body.data[0].user).toMatchObject({ id: 5, firstName: 'An' });
  });
});
