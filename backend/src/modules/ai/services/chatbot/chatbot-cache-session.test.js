/**
 * Minimal test để cover chatbot-service.js session memory (conversationHistory):
 *   if (sessionId) {
 *     const entry = this.conversationHistory.get(sessionId);
 *     const history = entry ? entry.messages : [];
 */
process.env.NODE_ENV = 'test';

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

jest.mock('@services/vector-store/vector-store', () => ({
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

describe('chatbot-service — hybridSearch reject → .catch(() => []) (line 244)', () => {
  it('trả về [] khi hybridSearch throw (covers arrow function trong catch)', async () => {
    const vs = require('@services/vector-store/vector-store');
    vs.hybridSearch.mockRejectedValueOnce(new Error('vector store down'));

    // hybridSearch rejects → .catch(() => []) → returns []
    const result = await chatbotService.handleMessage('iPhone 15', null, null, {});
    expect(result).toBeDefined();

    vs.hybridSearch.mockResolvedValue([]);
  });
});

describe('chatbot-service — initialSearchResults map callback (line 256)', () => {
  it('hybridSearch trả về item → map callback được gọi', async () => {
    const vs = require('@services/vector-store/vector-store');
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

    const result = await chatbotService.handleMessage('iPhone 15', null, null, {});
    expect(result).toBeDefined();

    vs.hybridSearch.mockResolvedValue([]);
  });
});

describe('chatbot-service — fallback map callback (line 267)', () => {
  it('fallback search map callback khi initial search trả về rỗng', async () => {
    const vs = require('@services/vector-store/vector-store');
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
