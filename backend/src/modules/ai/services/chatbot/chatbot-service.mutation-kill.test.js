/**
 * chatbot-service.mutation-kill.test.js
 *
 * Bổ sung cho chatbot-service.test.js (baseline mutation 53%). Tập trung các method
 * PURE-LOGIC dễ kill (không cần mock LLM HTTP):
 *   - _sanitizeMessage: replace " → ', gộp \n, trim, cắt 500
 *   - session: clearSession, registerSession, getSessionMessages
 *   - _persistMessages: skip / bulkCreate args / metadata / DB error warn
 *   - _evictStaleSessions: TTL + LRU
 */

const mockFindOne = jest.fn();
const mockFindAll = jest.fn();
const mockBulkCreate = jest.fn();

jest.mock('@models', () => ({
  Product: { findAll: jest.fn().mockResolvedValue([]) },
  Category: { findAll: jest.fn().mockResolvedValue([]) },
  Brand: { findAll: jest.fn().mockResolvedValue([]) },
  ChatMessage: {
    findOne: (...a) => mockFindOne(...a),
    findAll: (...a) => mockFindAll(...a),
    bulkCreate: (...a) => mockBulkCreate(...a),
  },
  ProductImage: {},
  ProductVariant: {},
  sequelize: {},
  Op: { in: 'in' },
}));

jest.mock('@services/vector-store/vector-store', () => ({
  items: [],
  loadPromise: Promise.resolve(),
  hybridSearch: jest.fn().mockResolvedValue([]),
  detectLanguage: jest.fn(() => 'vi'),
}));

jest.mock('axios');

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const logger = require('@utils/logger');
let svc;
beforeAll(() => {
  svc = require('./chatbot-service');
  svc.initialize(require('@models'));
});

beforeEach(() => {
  jest.clearAllMocks();
  svc.conversationHistory.clear();
  svc._registeredSession = null;
});

// ══════════════════════════════════════════════════════════════════════════════
// _sanitizeMessage
// ══════════════════════════════════════════════════════════════════════════════

describe('_sanitizeMessage', () => {
  it('đổi dấu " thành \'', () => {
    expect(svc._sanitizeMessage('nói "xin chào"')).toBe("nói 'xin chào'");
  });

  it('gộp nhiều \\n liên tiếp thành 1', () => {
    expect(svc._sanitizeMessage('a\n\n\nb')).toBe('a\nb');
  });

  it('trim khoảng trắng đầu/cuối', () => {
    expect(svc._sanitizeMessage('  hello  ')).toBe('hello');
  });

  it('cắt tối đa 500 ký tự', () => {
    expect(svc._sanitizeMessage('a'.repeat(600))).toHaveLength(500);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Session management
// ══════════════════════════════════════════════════════════════════════════════

describe('clearSession', () => {
  it('có sessionId tồn tại → delete, trả true', () => {
    svc.conversationHistory.set('s1', { messages: [], lastAccess: 1 });
    expect(svc.clearSession('s1')).toBe(true);
    expect(svc.conversationHistory.has('s1')).toBe(false);
  });

  it('sessionId không tồn tại → trả false', () => {
    expect(svc.clearSession('nope')).toBe(false);
  });

  it('không truyền sessionId → clear toàn bộ, trả true', () => {
    svc.conversationHistory.set('s1', { messages: [], lastAccess: 1 });
    svc.conversationHistory.set('s2', { messages: [], lastAccess: 2 });
    expect(svc.clearSession()).toBe(true);
    expect(svc.conversationHistory.size).toBe(0);
  });
});

describe('registerSession', () => {
  it('registerSession lưu _registeredSession', () => {
    svc.registerSession('sess-ui');
    expect(svc._registeredSession).toBe('sess-ui');
  });
});

describe('getSessionMessages', () => {
  it('không có sessionId → trả mảng rỗng, không query', async () => {
    expect(await svc.getSessionMessages(null)).toEqual([]);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it('có sessionId → findAll đúng where/order/limit/attributes', async () => {
    mockFindAll.mockResolvedValue([{ role: 'user', content: 'x' }]);
    const res = await svc.getSessionMessages('s1', 20);
    expect(res).toEqual([{ role: 'user', content: 'x' }]);
    expect(mockFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sessionId: 's1', messageType: 'ai_chatbot' }),
        order: [['createdAt', 'ASC']],
        limit: 20,
        attributes: ['role', 'content', 'intent', 'metadata', 'createdAt'],
        raw: true,
      }),
    );
  });

  it('limit mặc định 50', async () => {
    mockFindAll.mockResolvedValue([]);
    await svc.getSessionMessages('s1');
    expect(mockFindAll.mock.calls[0][0].limit).toBe(50);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// _persistMessages
// ══════════════════════════════════════════════════════════════════════════════

describe('_persistMessages', () => {
  it('không có sessionId → skip, không gọi bulkCreate', async () => {
    await svc._persistMessages(null, 1, 'u', 'a', 'general', 100, false);
    expect(mockBulkCreate).not.toHaveBeenCalled();
  });

  it('bulkCreate 2 message: user (isFallback false) + assistant (responseTime, isFallback)', async () => {
    mockBulkCreate.mockResolvedValue([]);
    await svc._persistMessages('s1', 7, 'câu hỏi', 'trả lời', 'product_search', 250, true);
    const rows = mockBulkCreate.mock.calls[0][0];
    expect(rows[0]).toEqual({
      sessionId: 's1',
      userId: 7,
      content: 'câu hỏi',
      role: 'user',
      messageType: 'ai_chatbot',
      intent: 'product_search',
      isFallback: false,
    });
    expect(rows[1]).toEqual({
      sessionId: 's1',
      userId: 7,
      content: 'trả lời',
      role: 'assistant',
      messageType: 'ai_chatbot',
      intent: 'product_search',
      responseTimeMs: 250,
      isFallback: true,
    });
  });

  it('aiMeta có → assistant row kèm metadata JSON-stringify', async () => {
    mockBulkCreate.mockResolvedValue([]);
    await svc._persistMessages('s1', null, 'u', 'a', 'general', 10, false, {
      products: [1],
      suggestions: ['x'],
    });
    const assistantRow = mockBulkCreate.mock.calls[0][0][1];
    expect(assistantRow.metadata).toBe(JSON.stringify({ products: [1], suggestions: ['x'] }));
    expect(assistantRow.userId).toBeNull();
  });

  it('DB lỗi → chỉ log warn, không throw', async () => {
    mockBulkCreate.mockRejectedValue(new Error('connection dropped'));
    await expect(
      svc._persistMessages('s1', 1, 'u', 'a', 'general', 10, false),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Không thể lưu'),
      'connection dropped',
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// _evictStaleSessions
// ══════════════════════════════════════════════════════════════════════════════

describe('_evictStaleSessions', () => {
  afterEach(() => jest.useRealTimers());

  it('xóa session quá hạn TTL (>30 phút không hoạt động)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T12:00:00Z'));
    const now = Date.now();
    svc.conversationHistory.set('fresh', { messages: [], lastAccess: now - 60_000 }); // 1 phút
    svc.conversationHistory.set('stale', { messages: [], lastAccess: now - 31 * 60_000 }); // 31 phút
    svc._evictStaleSessions();
    expect(svc.conversationHistory.has('fresh')).toBe(true);
    expect(svc.conversationHistory.has('stale')).toBe(false);
  });

  it('rỗng → no-op (không lỗi)', () => {
    expect(() => svc._evictStaleSessions()).not.toThrow();
  });
});
