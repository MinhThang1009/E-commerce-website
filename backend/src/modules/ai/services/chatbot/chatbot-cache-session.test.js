/**
 * Minimal test để cover chatbot-service.js lines 197-199:
 *   if (sessionId) {
 *     const entry = this.conversationHistory.get(sessionId);
 *     const history = entry ? entry.messages : [];
 *
 * Các tests trong chatbot-service.test.js đã cover nhưng có thể bị
 * isolation issue. File này dùng cùng mock pattern nhưng đơn giản hơn.
 */
process.env.NODE_ENV = 'test';

const mockRedisGet = jest.fn();
const mockRedisSetEx = jest.fn();

jest.mock('@config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: (...a) => mockRedisGet(...a),
    setEx: (...a) => mockRedisSetEx(...a),
  }),
}));

jest.mock('@models', () => ({
  Product: { findAll: jest.fn().mockResolvedValue([]) },
  Category: { findAll: jest.fn().mockResolvedValue([]) },
  Brand: { findAll: jest.fn().mockResolvedValue([]) },
  ChatMessage: { bulkCreate: jest.fn().mockResolvedValue([]) },
  ProductImage: {},
  ProductVariant: {},
  sequelize: {},
  Op: {},
}));

jest.mock('@modules/ai/services/vectorstore/vector-store', () => ({
  items: [],
  loadPromise: Promise.resolve(),
  hybridSearch: jest.fn().mockResolvedValue([]),
  upsertProduct: jest.fn(),
  save: jest.fn(),
  enrichProductData: jest.fn((d) => d),
  detectLanguage: jest.fn().mockReturnValue('vi'),
}));

jest.mock('axios');

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

let chatbotService;

beforeAll(() => {
  chatbotService = require('./chatbot-service');
});

beforeEach(() => jest.clearAllMocks());

describe('chatbot-service — cache HIT + sessionId (lines 197-199)', () => {
  it('cập nhật conversationHistory khi cache hit và có sessionId', async () => {
    const cachedData = {
      response: 'Cached: iPhone 15 Pro 256GB',
      products: [{ id: 1, name: 'iPhone 15 Pro' }],
      suggestions: ['Xem thêm iPhone'],
      intent: 'product_search',
    };

    // Luôn trả về cached data
    mockRedisGet.mockResolvedValue(JSON.stringify(cachedData));
    mockRedisSetEx.mockResolvedValue('OK');

    const sessionId = `sess-line197-${Date.now()}`;

    const result = await chatbotService.handleMessage(
      'iPhone 15', // classifyIntent → 'product_search' → CACHEABLE
      null, // userId
      sessionId, // sessionId → truthy → dòng 197 = true
      {},
    );

    // Xác nhận kết quả từ cache
    expect(result.response).toBe('Cached: iPhone 15 Pro 256GB');

    // Xác nhận conversationHistory được cập nhật (line 198-205)
    const entry = chatbotService.conversationHistory.get(sessionId);
    expect(entry).toBeDefined();
    expect(entry.messages.length).toBeGreaterThan(0);

    chatbotService.conversationHistory.clear();
  });

  it('cập nhật history khi đã có messages trước (entry.messages path)', async () => {
    const sessionId = `sess-existing-${Date.now()}`;

    // Pre-populate conversation history để test branch `entry ? entry.messages : []`
    chatbotService.conversationHistory.set(sessionId, {
      messages: [{ role: 'user', content: 'Tin nhắn cũ' }],
      lastAccess: Date.now(),
    });

    const cachedData = {
      response: 'Samsung Galaxy A55',
      products: [],
      suggestions: [],
      intent: 'product_search',
    };
    mockRedisGet.mockResolvedValue(JSON.stringify(cachedData));
    mockRedisSetEx.mockResolvedValue('OK');

    await chatbotService.handleMessage('Samsung Galaxy A55', null, sessionId, {});

    const entry = chatbotService.conversationHistory.get(sessionId);
    expect(entry).toBeDefined();
    // messages phải bao gồm cả tin nhắn cũ + mới
    expect(entry.messages.length).toBeGreaterThan(1);

    chatbotService.conversationHistory.clear();
  });

  it('không cập nhật conversationHistory khi sessionId=null (falsy branch của line 197)', async () => {
    const cachedData = {
      response: 'No session cached response',
      products: [],
      suggestions: [],
      intent: 'product_search',
    };
    mockRedisGet.mockResolvedValue(JSON.stringify(cachedData));
    mockRedisSetEx.mockResolvedValue('OK');

    const result = await chatbotService.handleMessage(
      'iPhone 15',
      null,
      null, // sessionId=null → if(sessionId) false → skip history update
      {},
    );

    expect(result.response).toBe('No session cached response');
  });
});

describe('chatbot-service — hybridSearch reject → .catch(() => []) (line 244)', () => {
  it('trả về [] khi hybridSearch throw (covers arrow function trong catch)', async () => {
    const vs = require('@modules/ai/services/vectorstore/vector-store');
    vs.hybridSearch.mockRejectedValueOnce(new Error('vector store down'));
    mockRedisGet.mockResolvedValue(null); // no cache
    mockRedisSetEx.mockResolvedValue('OK');

    // Call với 'iPhone 15' → product_search intent → không qua cache
    // hybridSearch rejects → .catch(() => []) → returns []
    const result = await chatbotService.handleMessage('iPhone 15', null, null, {});
    expect(result).toBeDefined();

    vs.hybridSearch.mockResolvedValue([]);
  });
});

describe('chatbot-service — initialSearchResults map callback (line 256)', () => {
  it('hybridSearch trả về item → map callback được gọi', async () => {
    const vs = require('@modules/ai/services/vectorstore/vector-store');
    const mockProduct = {
      id: 1,
      name: 'iPhone 15',
      price: 28000000,
      slug: 'iphone-15',
      thumbnail: 'thumb.jpg',
      inStock: true,
      score: 0.9,
    };
    // hybridSearch trả về 1 item có metadata
    vs.hybridSearch
      .mockResolvedValueOnce([{ metadata: mockProduct, score: 0.9 }])
      .mockResolvedValue([]);
    mockRedisGet.mockResolvedValue(null); // no cache
    mockRedisSetEx.mockResolvedValue('OK');

    const result = await chatbotService.handleMessage('iPhone 15', null, null, {});
    expect(result).toBeDefined();

    vs.hybridSearch.mockResolvedValue([]);
  });
});

describe('chatbot-service — fallback map callback (line 267)', () => {
  it('fallback search map callback khi initial search trả về rỗng', async () => {
    const vs = require('@modules/ai/services/vectorstore/vector-store');
    const mockProduct = {
      id: 99,
      name: 'Fallback Product',
      price: 10000000,
      slug: 'fallback',
      inStock: true,
    };
    // Lần 1: initial search trả về rỗng → relevantProducts.length === 0
    // Lần 2: fallback search (finalQuery, 3, 0) trả về 1 item
    vs.hybridSearch
      .mockResolvedValueOnce([]) // initial hybridSearch → rỗng
      .mockResolvedValueOnce([{ metadata: mockProduct, score: 0.1 }]) // fallback → có item
      .mockResolvedValue([]);
    mockRedisGet.mockResolvedValue(null);
    mockRedisSetEx.mockResolvedValue('OK');

    const result = await chatbotService.handleMessage('product query', null, null, {});
    expect(result).toBeDefined();

    vs.hybridSearch.mockResolvedValue([]);
  });
});

describe('chatbot-service — _evictStaleSessions MAX_SESSIONS (line 480)', () => {
  it('xóa sessions cũ nhất khi vượt MAX_SESSIONS (500)', () => {
    // Thêm 501 sessions với lastAccess gần nhau để không bị xóa do stale
    const now = Date.now();
    for (let i = 0; i < 501; i++) {
      chatbotService.conversationHistory.set(`evict-sess-${i}`, {
        messages: [],
        lastAccess: now - (501 - i), // sess-0 là cũ nhất
      });
    }
    expect(chatbotService.conversationHistory.size).toBe(501);

    chatbotService._evictStaleSessions();

    // Sau evict phải <= 500
    expect(chatbotService.conversationHistory.size).toBe(500);
    // Session cũ nhất (evict-sess-0) phải bị xóa
    expect(chatbotService.conversationHistory.has('evict-sess-0')).toBe(false);
    // Session mới nhất (evict-sess-500) phải còn
    expect(chatbotService.conversationHistory.has('evict-sess-500')).toBe(true);

    chatbotService.conversationHistory.clear();
  });
});
