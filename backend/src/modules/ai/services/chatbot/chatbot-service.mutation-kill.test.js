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
  // _registeredSession đã xóa — FE compat only
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
  it('có sessionId tồn tại → delete, trả true', async () => {
    svc.conversationHistory.set('s1', { messages: [], lastAccess: 1 });
    expect(await svc.clearSession('s1')).toBe(true);
    expect(svc.conversationHistory.has('s1')).toBe(false);
  });

  it('sessionId không tồn tại → trả false', async () => {
    expect(await svc.clearSession('nope')).toBe(false);
  });

  it('không truyền sessionId → throw Error (guard tránh xóa toàn server Map)', async () => {
    svc.conversationHistory.set('s1', { messages: [], lastAccess: 1 });
    await expect(svc.clearSession()).rejects.toThrow('ai.sessionIdRequired');
    expect(svc.conversationHistory.size).toBe(1); // không bị xóa
  });
});

describe('registerSession', () => {
  it('registerSession không throw (dead-state field đã xóa)', () => {
    expect(() => svc.registerSession('sess-ui')).not.toThrow();
  });
});

describe('getSessionMessages', () => {
  it('không có sessionId → trả mảng rỗng, không query', async () => {
    expect(await svc.getSessionMessages(null)).toEqual([]);
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  // Verifies [M6]: query DESC lấy N tin MỚI nhất, sau đó reverse về thứ tự thời gian
  // (trước fix: ASC + limit → session dài mất các tin gần đây khi FE restore)
  it('có sessionId → findAll DESC + reverse về thứ tự thời gian tăng dần', async () => {
    mockFindAll.mockResolvedValue([
      { role: 'assistant', content: 'mới nhất' },
      { role: 'user', content: 'cũ hơn' },
    ]);
    const res = await svc.getSessionMessages('s1', 20);
    // reverse: tin cũ hơn đứng trước để FE render đúng chiều hội thoại
    expect(res).toEqual([
      { role: 'user', content: 'cũ hơn' },
      { role: 'assistant', content: 'mới nhất' },
    ]);
    expect(mockFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sessionId: 's1', messageType: 'ai_chatbot' }),
        order: [
          ['createdAt', 'DESC'],
          ['id', 'DESC'],
        ],
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
// handleMessage — session write re-read (chống lost-update giữa 2 request đồng thời)
// ══════════════════════════════════════════════════════════════════════════════

describe('handleMessage — session memory re-read trước khi ghi', () => {
  afterEach(() => jest.restoreAllMocks());

  // Verifies [M15]: turn của request đồng thời (ghi vào Map TRONG LÚC request này chờ LLM)
  // không bị mất khi request này ghi history — trước fix append vào snapshot cũ từ bước 4
  it('message ghi vào Map giữa chừng (request song song) vẫn còn sau khi handleMessage ghi', async () => {
    const sid = 'sess-race';
    svc.conversationHistory.set(sid, {
      messages: [{ role: 'user', content: 'turn cũ' }],
      lastAccess: Date.now(),
    });

    jest.spyOn(svc, 'augmentAndGenerate').mockImplementation(async () => {
      // Mô phỏng request đồng thời hoàn thành trước: ghi thêm 1 turn vào Map
      const entry = svc.conversationHistory.get(sid);
      svc.conversationHistory.set(sid, {
        messages: [
          ...entry.messages,
          { role: 'user', content: 'turn song song' },
          { role: 'assistant', content: 'trả lời song song' },
        ],
        lastAccess: Date.now(),
      });
      return { response: 'ok', products: [], suggestions: [], intent: 'general' };
    });

    await svc.handleMessage('tìm laptop Dell mới', null, sid);

    const contents = svc.conversationHistory.get(sid).messages.map((m) => m.content);
    expect(contents).toContain('turn song song'); // không bị ghi đè mất
    expect(contents).toContain('ok'); // turn hiện tại vẫn được append
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// isFallback persist + stripNegation terminator
// ══════════════════════════════════════════════════════════════════════════════

describe('persist isFallback khi LLM down', () => {
  // Verifies: keyword fallback (0 provider) phải được ghi DB với isFallback=true
  // — trước fix hardcode false làm analytics không thấy LLM outage
  it('0 provider → assistant row có isFallback=true, cờ không lộ ra response', async () => {
    const origProviders = svc.providers;
    svc.providers = [];
    mockBulkCreate.mockResolvedValue([]);

    const out = await svc.handleMessage('tìm laptop Dell mới', null, 'sess-fb');
    await Promise.resolve();

    expect(out.isFallback).toBeUndefined(); // cờ nội bộ đã bị xóa khỏi response
    const rows = mockBulkCreate.mock.calls[0][0];
    expect(rows[1].role).toBe('assistant');
    expect(rows[1].isFallback).toBe(true);

    svc.providers = origProviders;
  });
});

describe('_retrieveProducts — stripNegation giữ phần yêu cầu sau mệnh đề phủ định', () => {
  // Verifies: terminator có dấu (giá, rẻ) hoạt động — \b ASCII-only từng làm capture
  // lan tới cuối câu, strip mất "giá rẻ"
  it('"không cần iphone giá rẻ" → query search vẫn còn "giá rẻ"', async () => {
    const origProviders = svc.providers;
    svc.providers = []; // rewriteQuery → null nhanh
    const vs = require('@services/vector-store/vector-store');
    vs.items = [];
    vs.hybridSearch.mockResolvedValue([{ metadata: { id: 1, name: 'X' }, score: 0.9 }]);

    await svc._retrieveProducts(
      'mình muốn mua điện thoại, không cần iphone giá rẻ',
      'mình muốn mua điện thoại, không cần iphone giá rẻ',
    );

    const searchedQuery = vs.hybridSearch.mock.calls[0][0];
    expect(searchedQuery).toContain('giá rẻ'); // yêu cầu giá không bị strip oan
    expect(searchedQuery).not.toContain('iphone'); // brand bị phủ định thì strip

    svc.providers = origProviders;
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
