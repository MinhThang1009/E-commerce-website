/**
 * Unit tests cho ChatbotService.
 * Tập trung vào các nhánh chưa được covered trong chatbot.test.js:
 *  - handleMessage: off_topic shortcut, cache hit, cache miss, session history, fallback
 *  - _persistMessages: với/không có sessionId
 *  - getFallbackResponse: cấu trúc response
 *  - normalizeAndClassify: demo-key shortcut và axios error
 *  - _evictStaleSessions: evict theo TTL và evict khi vượt MAX_SESSIONS
 *  - createPrompt: chứa product list và user message
 *  - getAllProducts: DB thành công và DB lỗi
 *  - getAIResponse: demo-key shortcut trả về fallback
 */

// ---------- Mocks ----------

const mockRedisGet = jest.fn();
const mockRedisSetEx = jest.fn();
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(() => Promise.resolve({ get: mockRedisGet, setEx: mockRedisSetEx })),
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
  hybridSearch: jest.fn().mockResolvedValue([]),
  upsertProduct: jest.fn(),
  save: jest.fn(),
  enrichProductData: jest.fn((data) => data),
  detectLanguage: jest.fn((text) => {
    if (/[àáâãèéêìíòóôõùúýăđơưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯẠ-ỹ]/.test(text)) return 'vi';
    return 'en';
  }),
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
let chatbotService;
beforeAll(() => {
  chatbotService = require('./chatbotService');
});

afterEach(() => {
  jest.clearAllMocks();
  // Reset conversation history giữa các test
  chatbotService.conversationHistory.clear();
});

// ============================================================
// ChatbotService.getFallbackResponse
// ============================================================

describe('ChatbotService.getFallbackResponse', () => {
  test('trả về object có field response là string', () => {
    const result = chatbotService.getFallbackResponse('xin chào');
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(0);
  });

  test('trả về suggestions là mảng không rỗng', () => {
    const result = chatbotService.getFallbackResponse('hello');
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  test('trả về intent = general', () => {
    const result = chatbotService.getFallbackResponse('bất kỳ');
    expect(result.intent).toBe('general');
  });

  test('không crash khi gọi với message rỗng', () => {
    expect(() => chatbotService.getFallbackResponse('')).not.toThrow();
  });
});

// ============================================================
// ChatbotService.normalizeAndClassify
// ============================================================

describe('ChatbotService.normalizeAndClassify', () => {
  test('mở rộng viết tắt tiếng Việt (ip → iPhone, pm → Pro Max)', async () => {
    const result = await chatbotService.normalizeAndClassify('ip 15 pm');
    expect(result.rewrittenQuery).toBe('iPhone 15 Pro Max');
  });

  test('phân loại intent product_search khi có tên sản phẩm', async () => {
    const result = await chatbotService.normalizeAndClassify('tìm iPhone 15');
    expect(result.intent).toBe('product_search');
  });

  test('phân loại intent off_topic cho câu hỏi ngoài phạm vi', async () => {
    const result = await chatbotService.normalizeAndClassify('thời tiết hôm nay');
    expect(result.intent).toBe('off_topic');
  });

  test('phân loại intent bilingual — English patterns', async () => {
    const result = await chatbotService.normalizeAndClassify('recommend a phone');
    expect(result.intent).toBe('product_search');
  });

  test('giữ nguyên message khi không có viết tắt', async () => {
    const result = await chatbotService.normalizeAndClassify('xin chào');
    expect(result.rewrittenQuery).toBe('xin chào');
    expect(result.intent).toBe('general');
  });
});

// ============================================================
// ChatbotService._persistMessages
// ============================================================

describe('ChatbotService._persistMessages', () => {
  test('không gọi bulkCreate khi sessionId = null', async () => {
    await chatbotService._persistMessages(null, 1, 'hello', 'hi', 'general', 100, false);
    expect(ChatMessage.bulkCreate).not.toHaveBeenCalled();
  });

  test('gọi bulkCreate với 2 records (user + assistant) khi có sessionId', async () => {
    await chatbotService._persistMessages(
      'sess-1',
      42,
      'xin chào',
      'chào bạn!',
      'general',
      250,
      false,
    );

    expect(ChatMessage.bulkCreate).toHaveBeenCalledTimes(1);
    const [[userMsg, assistantMsg]] = ChatMessage.bulkCreate.mock.calls;
    expect(userMsg).toHaveLength(2);
    expect(userMsg[0].role).toBe('user');
    expect(userMsg[0].content).toBe('xin chào');
    expect(userMsg[1].role).toBe('assistant');
    expect(userMsg[1].content).toBe('chào bạn!');
  });

  test('lưu đúng sessionId và userId vào cả 2 records', async () => {
    await chatbotService._persistMessages('sess-abc', 7, 'hello', 'hi', 'product_search', 180, true);
    const [[records]] = ChatMessage.bulkCreate.mock.calls;
    records.forEach((r) => {
      expect(r.sessionId).toBe('sess-abc');
      expect(r.userId).toBe(7);
    });
  });

  test('lưu isFallback = true cho assistant message', async () => {
    await chatbotService._persistMessages(
      'sess-2',
      null,
      'hi',
      'fallback reply',
      'off_topic',
      50,
      true,
    );
    const [[records]] = ChatMessage.bulkCreate.mock.calls;
    const assistantRecord = records.find((r) => r.role === 'assistant');
    expect(assistantRecord.isFallback).toBe(true);
  });

  test('userId = null khi không có userId', async () => {
    await chatbotService._persistMessages('sess-3', null, 'msg', 'reply', 'general', 100, false);
    const [[records]] = ChatMessage.bulkCreate.mock.calls;
    records.forEach((r) => expect(r.userId).toBeNull());
  });

  test('không throw khi bulkCreate fail — lỗi DB không ảnh hưởng flow', async () => {
    ChatMessage.bulkCreate.mockRejectedValueOnce(new Error('DB error'));
    await expect(
      chatbotService._persistMessages('sess-4', 1, 'msg', 'reply', 'general', 100, false),
    ).resolves.not.toThrow();
  });
});

// ============================================================
// ChatbotService.createPrompt
// ============================================================

describe('ChatbotService.createPrompt', () => {
  const sampleProducts = [
    {
      name: 'iPhone 15 Pro',
      category: 'Điện thoại',
      shortDescription: 'Flagship Apple',
      price: 29990000,
      basePrice: undefined,
      stockQuantity: 5,
    },
    {
      name: 'Galaxy S24',
      category: 'Điện thoại',
      shortDescription: 'Flagship Samsung',
      price: undefined,
      basePrice: 19990000,
      stockQuantity: 3,
    },
  ];

  test('chứa tên sản phẩm trong prompt', () => {
    const prompt = chatbotService.createPrompt('tìm điện thoại', sampleProducts, {});
    expect(prompt).toContain('iPhone 15 Pro');
    expect(prompt).toContain('Galaxy S24');
  });

  test('chứa tin nhắn người dùng trong prompt', () => {
    const userMsg = 'tôi muốn mua điện thoại gaming';
    const prompt = chatbotService.createPrompt(userMsg, sampleProducts, {});
    expect(prompt).toContain(userMsg);
  });

  test('chứa hướng dẫn format JSON', () => {
    const prompt = chatbotService.createPrompt('hello', sampleProducts, {});
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('response');
    expect(prompt).toContain('matchedProducts');
  });

  test('xử lý được danh sách sản phẩm rỗng', () => {
    expect(() => chatbotService.createPrompt('hello', [], {})).not.toThrow();
  });

  test('dùng price từ field price khi có (vector store source)', () => {
    const prompt = chatbotService.createPrompt('iphone', [sampleProducts[0]], {});
    expect(prompt).toContain('29.990.000');
  });

  test('fallback sang basePrice khi price = undefined (DB source)', () => {
    const prompt = chatbotService.createPrompt('samsung', [sampleProducts[1]], {});
    expect(prompt).toContain('19.990.000');
  });
});

// ============================================================
// ChatbotService._evictStaleSessions
// ============================================================

describe('ChatbotService._evictStaleSessions', () => {
  const SESSION_TTL_MS = 30 * 60 * 1000;

  test('xóa session hết hạn (lastAccess > 30 phút)', () => {
    const staleTime = Date.now() - SESSION_TTL_MS - 1000; // 1s quá hạn
    chatbotService.conversationHistory.set('stale-sess', {
      messages: [{ role: 'user', content: 'hi' }],
      lastAccess: staleTime,
    });

    chatbotService._evictStaleSessions();

    expect(chatbotService.conversationHistory.has('stale-sess')).toBe(false);
  });

  test('giữ session còn hạn', () => {
    const freshTime = Date.now() - 1000; // 1s trước
    chatbotService.conversationHistory.set('fresh-sess', {
      messages: [],
      lastAccess: freshTime,
    });

    chatbotService._evictStaleSessions();

    expect(chatbotService.conversationHistory.has('fresh-sess')).toBe(true);
  });

  test('evict session cũ nhất khi vượt MAX_SESSIONS (500)', () => {
    // Tạo 501 sessions — session đầu tiên phải bị xóa
    chatbotService.conversationHistory.clear();
    const baseTime = Date.now() - 5000; // tất cả còn hạn nhưng số lượng vượt ngưỡng

    for (let i = 0; i < 501; i++) {
      chatbotService.conversationHistory.set(`sess-${i}`, {
        messages: [],
        lastAccess: baseTime + i, // sess-0 cũ nhất, sess-500 mới nhất
      });
    }

    chatbotService._evictStaleSessions();

    // Sau khi evict còn đúng 500
    expect(chatbotService.conversationHistory.size).toBe(500);
    // Session cũ nhất (sess-0) phải bị xóa
    expect(chatbotService.conversationHistory.has('sess-0')).toBe(false);
    // Session mới nhất (sess-500) phải còn
    expect(chatbotService.conversationHistory.has('sess-500')).toBe(true);
  });
});

// ============================================================
// ChatbotService.handleMessage — integration flow
// ============================================================

describe('ChatbotService.handleMessage', () => {
  test('off_topic → trả về fallback ngay, không gọi vector store', async () => {
    const originalKey = chatbotService.apiKey;
    chatbotService.apiKey = 'real-api-key';

    // normalizeAndClassify trả về intent off_topic
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({ rewrittenQuery: 'bóng đá hôm nay', intent: 'off_topic' }),
            },
          },
        ],
      },
    });

    const result = await chatbotService.handleMessage('bóng đá hôm nay ai thắng', null, null, {});

    expect(result).toHaveProperty('response');
    expect(result.intent).toBe('off_topic');
    // Vector store không được gọi khi off_topic
    expect(vectorStoreService.hybridSearch).not.toHaveBeenCalled();

    chatbotService.apiKey = originalKey;
  });

  test('cache HIT → trả về kết quả từ cache, không gọi vector store', async () => {
    const originalKey = chatbotService.apiKey;
    chatbotService.apiKey = 'real-api-key';

    const cachedResponse = {
      response: 'Kết quả từ cache',
      products: [],
      suggestions: ['Xem thêm'],
      intent: 'product_search',
    };

    // normalizeAndClassify trả về intent product_search (cacheable)
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({ rewrittenQuery: 'iphone 15', intent: 'product_search' }),
            },
          },
        ],
      },
    });

    // Redis trả về cached result
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedResponse));

    const result = await chatbotService.handleMessage('iphone 15', 1, 'session-test', {});

    expect(result.response).toBe('Kết quả từ cache');
    expect(vectorStoreService.hybridSearch).not.toHaveBeenCalled();

    chatbotService.apiKey = originalKey;
  });

  test('fallback về getFallbackResponse khi apiKey = demo-key', async () => {
    // setup.js đặt OPENROUTER_API_KEY = 'demo-key' → normalizeAndClassify skip API call
    // vectorStore.hybridSearch trả về [] → getAIResponse → demo-key → getFallbackResponse
    vectorStoreService.hybridSearch.mockResolvedValueOnce([]);

    const result = await chatbotService.handleMessage('tìm iphone', null, null, {});

    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('suggestions');
  });

  test('lưu session history khi có sessionId', async () => {
    vectorStoreService.hybridSearch.mockResolvedValueOnce([]);

    await chatbotService.handleMessage('hello', null, 'my-session', {});

    expect(chatbotService.conversationHistory.has('my-session')).toBe(true);
    const entry = chatbotService.conversationHistory.get('my-session');
    expect(entry.messages.length).toBeGreaterThanOrEqual(2); // user + assistant
    expect(entry.messages[0].role).toBe('user');
    expect(entry.messages[1].role).toBe('assistant');
  });

  test('không lưu session khi không có sessionId', async () => {
    vectorStoreService.hybridSearch.mockResolvedValueOnce([]);

    await chatbotService.handleMessage('hello', null, null, {});

    expect(chatbotService.conversationHistory.size).toBe(0);
  });

  test('giới hạn history tối đa 20 messages (10 turns)', async () => {
    const sessionId = 'long-session';
    // Seed 20 messages (10 turns) vào history
    const existingMessages = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
    }));
    chatbotService.conversationHistory.set(sessionId, {
      messages: existingMessages,
      lastAccess: Date.now(),
    });

    vectorStoreService.hybridSearch.mockResolvedValueOnce([]);
    await chatbotService.handleMessage('new message', null, sessionId, {});

    const entry = chatbotService.conversationHistory.get(sessionId);
    // Sau khi thêm 2 messages mới và trim, tổng tối đa vẫn là 20
    expect(entry.messages.length).toBeLessThanOrEqual(20);
  });

  test('trả về fallback khi có lỗi không mong đợi', async () => {
    vectorStoreService.hybridSearch.mockRejectedValueOnce(new Error('vector fail'));
    // getAllProducts fallback cũng fail
    Product.findAll.mockRejectedValueOnce(new Error('DB fail'));

    const result = await chatbotService.handleMessage('iphone', null, null, {});
    expect(result).toHaveProperty('response');
  });
});

// ============================================================
// ChatbotService.getAllProducts
// ============================================================

// getAllProducts đã được loại bỏ — retrieval qua vectorStore.hybridSearch()

// ============================================================
// ChatbotService.getAIResponse — demo-key shortcut
// ============================================================

// ============================================================
// ChatbotService.initializeChatbot — line 50 và 55
// ============================================================

describe('ChatbotService.initializeChatbot', () => {
  const logger = require('../../utils/logger');

  test('ghi info log khi có providers', () => {
    logger.info.mockClear();
    const original = chatbotService.providers;
    chatbotService.providers = [{ key: 'k', url: 'u', model: 'm' }];

    chatbotService.initializeChatbot();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('AI khởi tạo thành công'));
    chatbotService.providers = original;
  });

  test('catch block ghi error log khi logger.info throw', () => {
    logger.info.mockImplementationOnce(() => {
      throw new Error('logger fail');
    });
    logger.error.mockClear();
    const original = chatbotService.providers;
    chatbotService.providers = [{ key: 'k', url: 'u', model: 'm' }];

    chatbotService.initializeChatbot();

    expect(logger.error).toHaveBeenCalledWith('Khởi tạo Chatbot thất bại:', expect.any(String));
    chatbotService.providers = original;
  });
});

describe('ChatbotService.getAIResponse', () => {
  test('trả về fallback khi apiKey = demo-key', async () => {
    // setup.js đặt OPENROUTER_API_KEY = 'demo-key'
    const result = await chatbotService.getAIResponse('tìm iphone', [], {}, []);
    expect(result).toHaveProperty('response');
    expect(result.intent).toBe('general');
  });

  test('gọi simpleKeywordMatch khi axios throw', async () => {
    const originalKey = chatbotService.apiKey;
    chatbotService.apiKey = 'real-api-key';

    // Catalog cache phải tồn tại để không gọi DB
    chatbotService._brandsCache = ['Apple'];
    chatbotService._categoriesCache = ['Điện thoại'];
    chatbotService._catalogCacheExpiry = Date.now() + 60000;

    axios.post.mockRejectedValueOnce(new Error('timeout'));

    const products = [
      {
        id: 1,
        name: 'iPhone 15',
        shortDescription: 'flagship',
        price: 29990000,
        basePrice: undefined,
        slug: 'iphone-15',
        inStock: true,
        compareAtPrice: null,
      },
    ];
    const result = await chatbotService.getAIResponse('iphone', products, {}, []);

    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('products');

    chatbotService.apiKey = originalKey;
  });
});
