/**
 * Unit tests cho GeminiChatbotService.
 * Tập trung vào các nhánh chưa được covered trong chatbot.test.js:
 *  - handleMessage: off_topic shortcut, cache hit, cache miss, session history, fallback
 *  - _persistMessages: với/không có sessionId
 *  - getFallbackResponse: cấu trúc response
 *  - preprocessMessage: demo-key shortcut và axios error
 *  - _evictStaleSessions: evict theo TTL và evict khi vượt MAX_SESSIONS
 *  - createPrompt: chứa product list và user message
 *  - getAllProducts: DB thành công và DB lỗi
 *  - getAIResponse: demo-key shortcut trả về fallback
 */

// ---------- Mocks ----------

const mockRedisGet = jest.fn();
const mockRedisSetEx = jest.fn();
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(() =>
    Promise.resolve({ get: mockRedisGet, setEx: mockRedisSetEx })
  ),
}));

jest.mock('../../models', () => ({
  Product: {
    findAll: jest.fn().mockResolvedValue([]),
  },
  Category: { findAll: jest.fn().mockResolvedValue([]) },
  Brand: { findAll: jest.fn().mockResolvedValue([]) },
  ChatMessage: { bulkCreate: jest.fn().mockResolvedValue([]) },
  ProductImage: {},
  ProductVariant: {},
  sequelize: {},
  Op: {},
}));

jest.mock('../../services/ai/vectorStore', () => ({
  items: [],
  loadPromise: Promise.resolve(),
  search: jest.fn().mockResolvedValue([]),
  addProduct: jest.fn(),
  save: jest.fn(),
  // enrichProductData ใช้โดย getAllProducts — trả về data nguyên bản
  enrichProductData: jest.fn((data) => data),
}));

jest.mock('axios');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ---------- Require sau khi mock ----------

const axios = require('axios');
const vectorStoreService = require('../../services/ai/vectorStore');
const { ChatMessage, Product } = require('../../models');
const { getRedisClient } = require('../../config/redis');

// Quan trọng: require sau khi mock để singleton nhận đúng env
let geminiService;
beforeAll(() => {
  geminiService = require('./geminiChatbot');
});

afterEach(() => {
  jest.clearAllMocks();
  // Reset conversation history giữa các test
  geminiService.conversationHistory.clear();
});

// ============================================================
// GeminiChatbotService.getFallbackResponse
// ============================================================

describe('GeminiChatbotService.getFallbackResponse', () => {
  test('trả về object có field response là string', () => {
    const result = geminiService.getFallbackResponse('xin chào');
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(0);
  });

  test('trả về suggestions là mảng không rỗng', () => {
    const result = geminiService.getFallbackResponse('hello');
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  test('trả về intent = general', () => {
    const result = geminiService.getFallbackResponse('bất kỳ');
    expect(result.intent).toBe('general');
  });

  test('không crash khi gọi với message rỗng', () => {
    expect(() => geminiService.getFallbackResponse('')).not.toThrow();
  });
});

// ============================================================
// GeminiChatbotService.preprocessMessage
// ============================================================

describe('GeminiChatbotService.preprocessMessage', () => {
  test('trả về message gốc và intent=general khi apiKey = demo-key', async () => {
    // setup.js set OPENROUTER_API_KEY = 'demo-key'
    const result = await geminiService.preprocessMessage('ip 15 pro max');
    expect(result.rewrittenQuery).toBe('ip 15 pro max');
    expect(result.intent).toBe('general');
    // axios không được gọi khi demo-key
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('trả về message gốc và intent=general khi axios throw', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';
    axios.post.mockRejectedValueOnce(new Error('Network error'));

    const result = await geminiService.preprocessMessage('tìm iphone');
    expect(result.rewrittenQuery).toBe('tìm iphone');
    expect(result.intent).toBe('general');

    geminiService.apiKey = originalKey;
  });

  test('parse đúng JSON response từ API', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({ rewrittenQuery: 'iPhone 15 Pro Max', intent: 'product_search' }),
          },
        }],
      },
    });

    const result = await geminiService.preprocessMessage('ip 15 pm');
    expect(result.rewrittenQuery).toBe('iPhone 15 Pro Max');
    expect(result.intent).toBe('product_search');

    geminiService.apiKey = originalKey;
  });

  test('fallback khi API trả về choices rỗng', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';
    axios.post.mockResolvedValueOnce({ data: { choices: [] } });

    const result = await geminiService.preprocessMessage('xin chào');
    expect(result.rewrittenQuery).toBe('xin chào');
    expect(result.intent).toBe('general');

    geminiService.apiKey = originalKey;
  });
});

// ============================================================
// GeminiChatbotService._persistMessages
// ============================================================

describe('GeminiChatbotService._persistMessages', () => {
  test('không gọi bulkCreate khi sessionId = null', async () => {
    await geminiService._persistMessages(null, 1, 'hello', 'hi', 'general', 100, false);
    expect(ChatMessage.bulkCreate).not.toHaveBeenCalled();
  });

  test('gọi bulkCreate với 2 records (user + assistant) khi có sessionId', async () => {
    await geminiService._persistMessages('sess-1', 42, 'xin chào', 'chào bạn!', 'general', 250, false);

    expect(ChatMessage.bulkCreate).toHaveBeenCalledTimes(1);
    const [[userMsg, assistantMsg]] = ChatMessage.bulkCreate.mock.calls;
    expect(userMsg).toHaveLength(2);
    expect(userMsg[0].role).toBe('user');
    expect(userMsg[0].content).toBe('xin chào');
    expect(userMsg[1].role).toBe('assistant');
    expect(userMsg[1].content).toBe('chào bạn!');
  });

  test('lưu đúng sessionId và userId vào cả 2 records', async () => {
    await geminiService._persistMessages('sess-abc', 7, 'hello', 'hi', 'product_search', 180, true);
    const [[records]] = ChatMessage.bulkCreate.mock.calls;
    records.forEach((r) => {
      expect(r.sessionId).toBe('sess-abc');
      expect(r.userId).toBe(7);
    });
  });

  test('lưu isFallback = true cho assistant message', async () => {
    await geminiService._persistMessages('sess-2', null, 'hi', 'fallback reply', 'off_topic', 50, true);
    const [[records]] = ChatMessage.bulkCreate.mock.calls;
    const assistantRecord = records.find((r) => r.role === 'assistant');
    expect(assistantRecord.isFallback).toBe(true);
  });

  test('userId = null khi không có userId', async () => {
    await geminiService._persistMessages('sess-3', null, 'msg', 'reply', 'general', 100, false);
    const [[records]] = ChatMessage.bulkCreate.mock.calls;
    records.forEach((r) => expect(r.userId).toBeNull());
  });

  test('không throw khi bulkCreate fail — lỗi DB không ảnh hưởng flow', async () => {
    ChatMessage.bulkCreate.mockRejectedValueOnce(new Error('DB error'));
    await expect(
      geminiService._persistMessages('sess-4', 1, 'msg', 'reply', 'general', 100, false)
    ).resolves.not.toThrow();
  });
});

// ============================================================
// GeminiChatbotService.createPrompt
// ============================================================

describe('GeminiChatbotService.createPrompt', () => {
  const sampleProducts = [
    { name: 'iPhone 15 Pro', category: 'Điện thoại', shortDescription: 'Flagship Apple', price: 29990000, basePrice: undefined, stockQuantity: 5 },
    { name: 'Galaxy S24', category: 'Điện thoại', shortDescription: 'Flagship Samsung', price: undefined, basePrice: 19990000, stockQuantity: 3 },
  ];

  test('chứa tên sản phẩm trong prompt', () => {
    const prompt = geminiService.createPrompt('tìm điện thoại', sampleProducts, {});
    expect(prompt).toContain('iPhone 15 Pro');
    expect(prompt).toContain('Galaxy S24');
  });

  test('chứa tin nhắn người dùng trong prompt', () => {
    const userMsg = 'tôi muốn mua điện thoại gaming';
    const prompt = geminiService.createPrompt(userMsg, sampleProducts, {});
    expect(prompt).toContain(userMsg);
  });

  test('chứa hướng dẫn format JSON', () => {
    const prompt = geminiService.createPrompt('hello', sampleProducts, {});
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('response');
    expect(prompt).toContain('matchedProducts');
  });

  test('xử lý được danh sách sản phẩm rỗng', () => {
    expect(() => geminiService.createPrompt('hello', [], {})).not.toThrow();
  });

  test('dùng price từ field price khi có (vector store source)', () => {
    const prompt = geminiService.createPrompt('iphone', [sampleProducts[0]], {});
    expect(prompt).toContain('29.990.000');
  });

  test('fallback sang basePrice khi price = undefined (DB source)', () => {
    const prompt = geminiService.createPrompt('samsung', [sampleProducts[1]], {});
    expect(prompt).toContain('19.990.000');
  });
});

// ============================================================
// GeminiChatbotService._evictStaleSessions
// ============================================================

describe('GeminiChatbotService._evictStaleSessions', () => {
  const SESSION_TTL_MS = 30 * 60 * 1000;

  test('xóa session hết hạn (lastAccess > 30 phút)', () => {
    const staleTime = Date.now() - SESSION_TTL_MS - 1000; // 1s quá hạn
    geminiService.conversationHistory.set('stale-sess', {
      messages: [{ role: 'user', content: 'hi' }],
      lastAccess: staleTime,
    });

    geminiService._evictStaleSessions();

    expect(geminiService.conversationHistory.has('stale-sess')).toBe(false);
  });

  test('giữ session còn hạn', () => {
    const freshTime = Date.now() - 1000; // 1s trước
    geminiService.conversationHistory.set('fresh-sess', {
      messages: [],
      lastAccess: freshTime,
    });

    geminiService._evictStaleSessions();

    expect(geminiService.conversationHistory.has('fresh-sess')).toBe(true);
  });

  test('evict session cũ nhất khi vượt MAX_SESSIONS (500)', () => {
    // Tạo 501 sessions — session đầu tiên phải bị xóa
    geminiService.conversationHistory.clear();
    const baseTime = Date.now() - 5000; // tất cả còn hạn nhưng số lượng vượt ngưỡng

    for (let i = 0; i < 501; i++) {
      geminiService.conversationHistory.set(`sess-${i}`, {
        messages: [],
        lastAccess: baseTime + i, // sess-0 cũ nhất, sess-500 mới nhất
      });
    }

    geminiService._evictStaleSessions();

    // Sau khi evict còn đúng 500
    expect(geminiService.conversationHistory.size).toBe(500);
    // Session cũ nhất (sess-0) phải bị xóa
    expect(geminiService.conversationHistory.has('sess-0')).toBe(false);
    // Session mới nhất (sess-500) phải còn
    expect(geminiService.conversationHistory.has('sess-500')).toBe(true);
  });
});

// ============================================================
// GeminiChatbotService.handleMessage — integration flow
// ============================================================

describe('GeminiChatbotService.handleMessage', () => {
  test('off_topic → trả về fallback ngay, không gọi vector store', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    // preprocessMessage trả về intent off_topic
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({ rewrittenQuery: 'bóng đá hôm nay', intent: 'off_topic' }),
          },
        }],
      },
    });

    const result = await geminiService.handleMessage('bóng đá hôm nay ai thắng', null, null, {});

    expect(result).toHaveProperty('response');
    expect(result.intent).toBe('off_topic');
    // Vector store không được gọi khi off_topic
    expect(vectorStoreService.search).not.toHaveBeenCalled();

    geminiService.apiKey = originalKey;
  });

  test('cache HIT → trả về kết quả từ cache, không gọi vector store', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    const cachedResponse = {
      response: 'Kết quả từ cache',
      products: [],
      suggestions: ['Xem thêm'],
      intent: 'product_search',
    };

    // preprocessMessage trả về intent product_search (cacheable)
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({ rewrittenQuery: 'iphone 15', intent: 'product_search' }),
          },
        }],
      },
    });

    // Redis trả về cached result
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedResponse));

    const result = await geminiService.handleMessage('iphone 15', 1, 'session-test', {});

    expect(result.response).toBe('Kết quả từ cache');
    expect(vectorStoreService.search).not.toHaveBeenCalled();

    geminiService.apiKey = originalKey;
  });

  test('fallback về getFallbackResponse khi apiKey = demo-key', async () => {
    // setup.js đặt OPENROUTER_API_KEY = 'demo-key' → preprocessMessage skip API call
    // vectorStore.search trả về [] → getAIResponse → demo-key → getFallbackResponse
    vectorStoreService.search.mockResolvedValueOnce([]);

    const result = await geminiService.handleMessage('tìm iphone', null, null, {});

    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('suggestions');
  });

  test('lưu session history khi có sessionId', async () => {
    vectorStoreService.search.mockResolvedValueOnce([]);

    await geminiService.handleMessage('hello', null, 'my-session', {});

    expect(geminiService.conversationHistory.has('my-session')).toBe(true);
    const entry = geminiService.conversationHistory.get('my-session');
    expect(entry.messages.length).toBeGreaterThanOrEqual(2); // user + assistant
    expect(entry.messages[0].role).toBe('user');
    expect(entry.messages[1].role).toBe('assistant');
  });

  test('không lưu session khi không có sessionId', async () => {
    vectorStoreService.search.mockResolvedValueOnce([]);

    await geminiService.handleMessage('hello', null, null, {});

    expect(geminiService.conversationHistory.size).toBe(0);
  });

  test('giới hạn history tối đa 20 messages (10 turns)', async () => {
    const sessionId = 'long-session';
    // Seed 20 messages (10 turns) vào history
    const existingMessages = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
    }));
    geminiService.conversationHistory.set(sessionId, {
      messages: existingMessages,
      lastAccess: Date.now(),
    });

    vectorStoreService.search.mockResolvedValueOnce([]);
    await geminiService.handleMessage('new message', null, sessionId, {});

    const entry = geminiService.conversationHistory.get(sessionId);
    // Sau khi thêm 2 messages mới và trim, tổng tối đa vẫn là 20
    expect(entry.messages.length).toBeLessThanOrEqual(20);
  });

  test('trả về fallback khi có lỗi không mong đợi', async () => {
    vectorStoreService.search.mockRejectedValueOnce(new Error('vector fail'));
    // getAllProducts fallback cũng fail
    Product.findAll.mockRejectedValueOnce(new Error('DB fail'));

    const result = await geminiService.handleMessage('iphone', null, null, {});
    expect(result).toHaveProperty('response');
  });
});

// ============================================================
// GeminiChatbotService.getAllProducts
// ============================================================

describe('GeminiChatbotService.getAllProducts', () => {
  test('trả về mảng rỗng khi DB throw error', async () => {
    Product.findAll.mockRejectedValueOnce(new Error('DB connection failed'));
    const result = await geminiService.getAllProducts();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  test('gọi Product.findAll với status active', async () => {
    Product.findAll.mockResolvedValueOnce([]);
    await geminiService.getAllProducts();
    expect(Product.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active' }),
      })
    );
  });

  test('map sản phẩm qua enrichProductData', async () => {
    // toJSON mock — enrichProductData nhận raw object
    const mockProduct = {
      toJSON: () => ({
        id: 1,
        name: 'iPhone 15 Pro',
        basePrice: 29990000,
        compareAtPrice: null,
        slug: 'iphone-15-pro',
        shortDescription: 'Flagship Apple',
        description: 'Chi tiết',
        stockQuantity: 5,
        createdAt: new Date().toISOString(),
        productImages: [],
        variants: [],
        categories: [],
        category: null,
      }),
    };
    Product.findAll.mockResolvedValueOnce([mockProduct]);

    const result = await geminiService.getAllProducts();
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('name', 'iPhone 15 Pro');
  });
});

// ============================================================
// GeminiChatbotService.getAIResponse — demo-key shortcut
// ============================================================

// ============================================================
// GeminiChatbotService.initializeChatbot — line 50 và 55
// ============================================================

describe('GeminiChatbotService.initializeChatbot — real apiKey (line 50)', () => {
  const logger = require('../../utils/logger');

  test('ghi info log khi apiKey hợp lệ (không phải demo-key) — covers line 50', () => {
    logger.info.mockClear();
    const originalKey = geminiService.apiKey;

    geminiService.apiKey = 'real-openrouter-api-key-xyz';
    geminiService.initializeChatbot();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('OpenRouter AI khởi tạo thành công')
    );

    geminiService.apiKey = originalKey;
  });

  test('catch block ghi error log khi logger.info throw — covers line 55', () => {
    logger.info.mockImplementationOnce(() => { throw new Error('logger fail'); });
    logger.error.mockClear();

    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key-trigger-catch';

    geminiService.initializeChatbot();

    expect(logger.error).toHaveBeenCalledWith(
      'Khởi tạo Chatbot thất bại:',
      expect.any(String)
    );

    geminiService.apiKey = originalKey;
  });
});

describe('GeminiChatbotService.getAIResponse', () => {
  test('trả về fallback khi apiKey = demo-key', async () => {
    // setup.js đặt OPENROUTER_API_KEY = 'demo-key'
    const result = await geminiService.getAIResponse('tìm iphone', [], {}, []);
    expect(result).toHaveProperty('response');
    expect(result.intent).toBe('general');
  });

  test('gọi simpleKeywordMatch khi axios throw', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    // Catalog cache phải tồn tại để không gọi DB
    geminiService._brandsCache = ['Apple'];
    geminiService._categoriesCache = ['Điện thoại'];
    geminiService._catalogCacheExpiry = Date.now() + 60000;

    axios.post.mockRejectedValueOnce(new Error('timeout'));

    const products = [{ id: 1, name: 'iPhone 15', shortDescription: 'flagship', price: 29990000, basePrice: undefined, slug: 'iphone-15', inStock: true, compareAtPrice: null }];
    const result = await geminiService.getAIResponse('iphone', products, {}, []);

    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('products');

    geminiService.apiKey = originalKey;
  });
});
