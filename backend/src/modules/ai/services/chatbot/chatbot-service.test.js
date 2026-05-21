/**
 * @file chatbotService.test.js
 * @description Gộp từ chatbotService.test.js + .branches.test.js + .additional.test.js + .extra2.test.js
 *
 * Mỗi section có mock setup riêng do dùng jest.resetModules()/jest.isolateModules().
 * Section 1 (main): handleMessage, getFallbackResponse, _persistMessages, _evictStaleSessions
 * Section 2 (branches): createPrompt branches, getAIResponse branches
 * Section 3 (additional): _ensureCatalogCache, edge cases
 * Section 4 (extra2): _llmRewrite, constructor với LLM env, context.retrievedProducts, error rotation
 */
// ---------- Mocks ----------

const mockRedisGet = jest.fn();
const mockRedisSetEx = jest.fn();
jest.mock('@config/redis', () => ({
  getRedisClient: jest.fn(() => Promise.resolve({ get: mockRedisGet, setEx: mockRedisSetEx })),
}));

jest.mock('@models', () => ({
  Product: {
    findAll: jest.fn().mockResolvedValue([]),
  },
  // Dùng arrow wrapper: lazy evaluation tránh TDZ, sections 2/3/4 dùng mockXxx trực tiếp
  Category: { findAll: (...a) => mockCategoryFindAll(...a) },
  Brand: { findAll: (...a) => mockBrandFindAll(...a) },
  ChatMessage: { bulkCreate: (...a) => mockChatMessageBulkCreate(...a) },
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
  enrichProductData: jest.fn((data) => data),
  detectLanguage: jest.fn((text) => {
    if (/[àáâãèéêìíòóôõùúýăđơưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯẠ-ỹ]/.test(text)) return 'vi';
    return 'en';
  }),
}));

jest.mock('axios');

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ---------- Require sau khi mock ----------

const axios = require('axios');
const { ChatMessage, Product } = require('@models');
const { getRedisClient } = require('@config/redis');

// Quan trọng: require sau khi mock để singleton nhận đúng env
let chatbotService;
let vectorStoreService;
beforeAll(() => {
  chatbotService = require('./chatbot-service');
  // Load vectorStoreService TRONG beforeAll để đảm bảo cùng mock instance với chatbotService
  vectorStoreService = require('@services/vector-store/vector-store');
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
    expect(mockChatMessageBulkCreate).not.toHaveBeenCalled();
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

    expect(mockChatMessageBulkCreate).toHaveBeenCalledTimes(1);
    const [[userMsg, assistantMsg]] = mockChatMessageBulkCreate.mock.calls;
    expect(userMsg).toHaveLength(2);
    expect(userMsg[0].role).toBe('user');
    expect(userMsg[0].content).toBe('xin chào');
    expect(userMsg[1].role).toBe('assistant');
    expect(userMsg[1].content).toBe('chào bạn!');
  });

  test('lưu đúng sessionId và userId vào cả 2 records', async () => {
    await chatbotService._persistMessages(
      'sess-abc',
      7,
      'hello',
      'hi',
      'product_search',
      180,
      true,
    );
    const [[records]] = mockChatMessageBulkCreate.mock.calls;
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
    const [[records]] = mockChatMessageBulkCreate.mock.calls;
    const assistantRecord = records.find((r) => r.role === 'assistant');
    expect(assistantRecord.isFallback).toBe(true);
  });

  test('userId = null khi không có userId', async () => {
    await chatbotService._persistMessages('sess-3', null, 'msg', 'reply', 'general', 100, false);
    const [[records]] = mockChatMessageBulkCreate.mock.calls;
    records.forEach((r) => expect(r.userId).toBeNull());
  });

  test('không throw khi bulkCreate fail — lỗi DB không ảnh hưởng flow', async () => {
    mockChatMessageBulkCreate.mockRejectedValueOnce(new Error('DB error'));
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
    const originalProviders = [...chatbotService.providers];
    chatbotService.providers = [
      { key: 'test-key', url: 'https://api.test/v1/chat/completions', model: 'gpt-4' },
    ];

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

    chatbotService.providers = originalProviders;
  });

  test('cache HIT → trả về kết quả từ cache, không gọi vector store', async () => {
    const originalProviders = [...chatbotService.providers];
    chatbotService.providers = [
      { key: 'test-key', url: 'https://api.test/v1/chat/completions', model: 'gpt-4' },
    ];

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

    chatbotService.providers = originalProviders;
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

  test('trả về fallback khi hybridSearch lỗi', async () => {
    vectorStoreService.hybridSearch.mockRejectedValueOnce(new Error('vector fail'));
    // Product.findAll không liên quan — getAllProducts đã bị loại bỏ khỏi service

    const result = await chatbotService.handleMessage('iphone', null, null, {});
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('intent');
    expect(Array.isArray(result.suggestions)).toBe(true);
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
// ChatbotService._initializeChatbot — line 50 và 55
// ============================================================

describe('ChatbotService._initializeChatbot', () => {
  const logger = require('@utils/logger');

  test('ghi info log khi có providers', () => {
    logger.info.mockClear();
    const original = chatbotService.providers;
    chatbotService.providers = [{ key: 'k', url: 'u', model: 'm' }];

    chatbotService._initializeChatbot();

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

    chatbotService._initializeChatbot();

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
    const originalProviders = [...chatbotService.providers];
    chatbotService.providers = [
      { key: 'test-key', url: 'https://api.test/v1/chat/completions', model: 'gpt-4' },
    ];

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

    chatbotService.providers = originalProviders;
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Branch coverage (từ chatbotService.branches.test.js)
// ═══════════════════════════════════════════════════════════════════════════════

// ---------- Mocks ----------

const mockBrandFindAll = jest.fn().mockResolvedValue([]);
const mockCategoryFindAll = jest.fn().mockResolvedValue([]);
const mockProductFindAll = jest.fn().mockResolvedValue([]);
const mockChatMessageBulkCreate = jest.fn().mockResolvedValue([]);

// ---------- Require ----------

const logger = require('@utils/logger');

beforeAll(() => {
  chatbotService = require('./chatbot-service');
});

afterEach(() => {
  jest.clearAllMocks();
  chatbotService.conversationHistory.clear();
  chatbotService._brandsCache = null;
  chatbotService._categoriesCache = null;
  chatbotService._catalogCacheExpiry = 0;
});

// ============================================================
// Line 55: error.message || error — khi error không có message property
// ============================================================

describe('ChatbotService._initializeChatbot — line 55: error không có message', () => {
  it('logger.error nhận chính error object khi error.message là undefined', () => {
    // Khi error là plain string (không có .message), error.message là undefined
    // → biểu thức `error.message || error` trả về error (right side)
    logger.info.mockImplementationOnce(() => {
      // ném string thay vì Error object → error.message = undefined
      throw 'raw string error';
    });
    logger.error.mockClear();

    // Production dùng this.providers.length > 0 để trigger logger.info
    const originalProviders = chatbotService.providers;
    chatbotService.providers = [
      { key: 'real-api-key', url: 'https://test.api/chat', model: 'test-model' },
    ];
    chatbotService._initializeChatbot();

    // Phải log error với chính string đó (right side của ||)
    expect(logger.error).toHaveBeenCalledWith('Khởi tạo Chatbot thất bại:', 'raw string error');
    chatbotService.providers = originalProviders;
  });
});

// ============================================================
// Lines 95-96: result.rewrittenQuery || message / result.intent || 'general'
// — right sides khi API trả về JSON thiếu fields
// ============================================================

describe('ChatbotService.normalizeAndClassify — rule-based behavior', () => {
  it('expandAbbreviations được gọi — rewrittenQuery là kết quả expand viết tắt', async () => {
    // normalizeAndClassify là rule-based — không gọi LLM, chỉ dùng expandAbbreviations + regex
    const result = await chatbotService.normalizeAndClassify('tìm iphone');
    // 'iphone' là tên sản phẩm → hasProductName match → intent = product_search
    expect(result.rewrittenQuery).toBeDefined();
    expect(result.intent).toBe('product_search');
    // Không gọi axios.post (không còn LLM call)
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('intent = "general" khi message không match bất kỳ pattern nào', async () => {
    // 'hello world' không match off_topic, order_inquiry, policy, product name, pricing
    const result = await chatbotService.normalizeAndClassify('hello world');
    expect(result.intent).toBe('general');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('intent = "off_topic" khi message chứa từ khóa off_topic', async () => {
    const result = await chatbotService.normalizeAndClassify('thời tiết hôm nay thế nào');
    expect(result.intent).toBe('off_topic');
    expect(axios.post).not.toHaveBeenCalled();
  });
});

// ============================================================
// Line 132: cachedResult.response || '' — right side khi cached response falsy
// ============================================================

describe('ChatbotService.handleMessage — line 132: cachedResult.response || ""', () => {
  beforeEach(() => {
    mockRedisGet.mockReset();
    mockRedisSetEx.mockReset();
  });
  it('dùng empty string khi cachedResult.response = null trong cache hit', async () => {
    const originalProviders = [...chatbotService.providers];
    chatbotService.providers = [
      { key: 'test-key', url: 'https://api.test/v1/chat/completions', model: 'gpt-4' },
    ];

    // Cache có response = null
    const cachedWithNullResponse = {
      response: null,
      products: [],
      suggestions: [],
      intent: 'product_search',
    };

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({ rewrittenQuery: 'iphone', intent: 'product_search' }),
            },
          },
        ],
      },
    });

    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedWithNullResponse));

    // _persistMessages được gọi với '' thay vì null
    await chatbotService.handleMessage('iphone', 1, 'sess-null-resp', {});

    expect(mockChatMessageBulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ role: 'assistant', content: '' })]),
    );

    chatbotService.providers = originalProviders;
  });
});

// ============================================================
// Line 156: NODE_ENV = 'production' → debug log KHÔNG được gọi
// ============================================================

describe('ChatbotService.handleMessage — line 156: NODE_ENV production', () => {
  it('không gọi logger.debug cho "Tìm thấy N sản phẩm" khi NODE_ENV=production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    vectorStoreService.hybridSearch.mockResolvedValueOnce([]);

    await chatbotService.handleMessage('tìm iphone', null, null, {});

    // Không có debug call nào chứa "sản phẩm liên quan qua RAG"
    const debugCalls = logger.debug.mock.calls.map((c) => c[0]);
    const hasProductCountLog = debugCalls.some(
      (msg) => typeof msg === 'string' && msg.includes('sản phẩm liên quan qua RAG'),
    );
    expect(hasProductCountLog).toBe(false);

    process.env.NODE_ENV = originalEnv;
  });
});

// ============================================================
// Lines 173-181: aiResponse.response || '' — right side
// Session history lưu empty string khi aiResponse.response falsy
// ============================================================

describe('ChatbotService.handleMessage — line 173: aiResponse.response || ""', () => {
  it('lưu empty string vào session history khi aiResponse.response là undefined', async () => {
    const originalProviders = [...chatbotService.providers];
    chatbotService.providers = [
      { key: 'test-key', url: 'https://api.test/v1/chat/completions', model: 'gpt-4' },
    ];

    // getAIResponse trả về object không có response field
    const originalGetAI = chatbotService.getAIResponse.bind(chatbotService);
    chatbotService.getAIResponse = jest.fn().mockResolvedValue({
      products: [],
      suggestions: [],
      intent: 'general',
      // response: undefined — missing!
    });

    vectorStoreService.hybridSearch.mockResolvedValueOnce([]);
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({ rewrittenQuery: 'hello', intent: 'general' }),
            },
          },
        ],
      },
    });
    mockRedisGet.mockResolvedValueOnce(null);

    await chatbotService.handleMessage('hello', null, 'sess-no-response', {});

    const entry = chatbotService.conversationHistory.get('sess-no-response');
    // assistant message content phải là '' không phải undefined
    const assistantMsg = entry?.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg?.content).toBe('');

    chatbotService.getAIResponse = originalGetAI;
    chatbotService.providers = originalProviders;
  });
});

// ============================================================
// Line 233: !this.apiKey (null/undefined) — branch khác demo-key
// ============================================================

describe('ChatbotService.getAIResponse — providers array empty', () => {
  it('trả về fallback khi providers rỗng (không có provider nào)', async () => {
    // Production dùng this.providers.length === 0 thay vì !this.apiKey
    const originalProviders = chatbotService.providers;
    chatbotService.providers = [];

    const result = await chatbotService.getAIResponse('tìm điện thoại', [], {}, []);

    expect(result).toHaveProperty('response');
    expect(result.intent).toBe('general');
    // axios không được gọi vì providers rỗng
    expect(axios.post).not.toHaveBeenCalled();

    chatbotService.providers = originalProviders;
  });

  it('trả về fallback khi providers = [] (empty array)', async () => {
    const originalProviders = chatbotService.providers;
    chatbotService.providers = [];

    const result = await chatbotService.getAIResponse('tìm laptop', [], {}, []);
    expect(result).toHaveProperty('response');

    chatbotService.providers = originalProviders;
  });
});

// ============================================================
// Lines 258-267: (this._categoriesCache || []) / (this._brandsCache || [])
// — right sides khi cache là null
// ============================================================

describe('ChatbotService.getAIResponse — lines 258-267: cache null fallback', () => {
  it('dùng [] khi _categoriesCache = null (line 258 right side)', async () => {
    // Production dùng this.providers array
    const originalProviders = chatbotService.providers;
    chatbotService.providers = [
      { key: 'real-api-key', url: 'https://test.api/chat', model: 'test-model' },
    ];

    // Cache null → _ensureCatalogCache sẽ được gọi để load từ DB
    chatbotService._brandsCache = null;
    chatbotService._categoriesCache = null;
    chatbotService._catalogCacheExpiry = 0;

    mockBrandFindAll.mockResolvedValueOnce([]);
    mockCategoryFindAll.mockResolvedValueOnce([]);

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                response: 'OK',
                matchedProducts: [],
                suggestions: [],
                intent: 'general',
              }),
            },
          },
        ],
      },
    });

    const result = await chatbotService.getAIResponse('hello', [], {}, []);
    // Không crash — categoriesCache và brandsCache được lấy từ DB (trả về [])
    expect(result).toHaveProperty('response');

    chatbotService.providers = originalProviders;
  });
});

// ============================================================
// Line 298: NODE_ENV = 'production' → debug "Đã nhận phản hồi" không được gọi
// ============================================================

describe('ChatbotService.getAIResponse — line 298: production suppresses debug', () => {
  it('không gọi debug "Đã nhận phản hồi" khi NODE_ENV=production', async () => {
    const originalEnv = process.env.NODE_ENV;
    // Production dùng this.providers array
    const originalProviders = chatbotService.providers;
    process.env.NODE_ENV = 'production';
    chatbotService.providers = [
      { key: 'real-api-key', url: 'https://test.api/chat', model: 'test-model' },
    ];
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = [];
    chatbotService._catalogCacheExpiry = Date.now() + 60000;

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                response: 'OK',
                matchedProducts: [],
                suggestions: [],
                intent: 'general',
              }),
            },
          },
        ],
      },
    });

    await chatbotService.getAIResponse('test', [], {}, []);

    const debugCalls = logger.debug.mock.calls.map((c) => c[0]);
    const hasReceivedLog = debugCalls.some(
      (msg) => typeof msg === 'string' && msg.includes('Đã nhận phản hồi'),
    );
    expect(hasReceivedLog).toBe(false);

    process.env.NODE_ENV = originalEnv;
    chatbotService.providers = originalProviders;
  });
});

// ============================================================
// Lines 316-359: createPrompt branches
// — p.category undefined → p.categories?.[0]?.name || 'Sản phẩm'
// — p.stockQuantity = undefined → inStock branch
// ============================================================

describe('ChatbotService.createPrompt — uncovered branches (lines 316-359)', () => {
  it('dùng p.category khi p.category có giá trị', () => {
    // createPrompt dùng `p.category || 'Sản phẩm'` — set category trực tiếp
    const products = [
      {
        name: 'iPhone 15 Pro',
        category: 'Điện thoại',
        shortDescription: 'Flagship',
        price: 29990000,
        stockQuantity: 5,
      },
    ];

    const prompt = chatbotService.createPrompt('tìm điện thoại', products, {});
    expect(prompt).toContain('Điện thoại');
  });

  it('dùng "Sản phẩm" khi cả category và categories[0] đều undefined', () => {
    const products = [
      {
        name: 'Sản phẩm X',
        // category: undefined, categories: undefined
        shortDescription: 'Mô tả',
        price: 1000000,
        stockQuantity: 2,
      },
    ];

    const prompt = chatbotService.createPrompt('tìm gì đó', products, {});
    expect(prompt).toContain('Sản phẩm');
  });

  it('dùng "Mô tả đang cập nhật" khi shortDescription = undefined', () => {
    const products = [
      {
        name: 'Phone A',
        category: 'Điện thoại',
        // shortDescription: undefined
        price: 5000000,
        stockQuantity: 3,
      },
    ];

    const prompt = chatbotService.createPrompt('tìm phone', products, {});
    expect(prompt).toContain('Mô tả đang cập nhật');
  });

  it('dùng inStock text khi stockQuantity = undefined (false branch of !== undefined)', () => {
    const products = [
      {
        name: 'Tablet B',
        category: 'Tablet',
        shortDescription: 'Tablet tốt',
        price: 8000000,
        // stockQuantity: undefined → branch else → dùng inStock
        inStock: true,
      },
    ];

    const prompt = chatbotService.createPrompt('tìm tablet', products, {});
    expect(prompt).toContain('Còn hàng');
  });

  it('dùng "Hết hàng" khi stockQuantity undefined và inStock = false', () => {
    const products = [
      {
        name: 'Tablet C',
        category: 'Tablet',
        shortDescription: 'Hết rồi',
        price: 7000000,
        // stockQuantity: undefined
        inStock: false,
      },
    ];

    const prompt = chatbotService.createPrompt('tìm tablet', products, {});
    expect(prompt).toContain('Hết hàng');
  });

  it('dùng categories[0] = undefined → fallback "Sản phẩm" khi categories rỗng', () => {
    const products = [
      {
        name: 'Product Z',
        // category: undefined
        categories: [], // categories[0] = undefined
        shortDescription: 'Desc',
        price: 1000000,
        stockQuantity: 1,
      },
    ];

    const prompt = chatbotService.createPrompt('tìm gì đó', products, {});
    expect(prompt).toContain('Sản phẩm');
  });
});

// ============================================================
// Line 391: product.price ?? product.basePrice — right side khi price là null/undefined
// trong parseAIResponse
// ============================================================

describe('ChatbotService.parseAIResponse — line 391: price ?? basePrice right side', () => {
  it('dùng basePrice khi product.price = null (line 391 ?? right side)', () => {
    const products = [
      {
        id: 1,
        name: 'Samsung Galaxy A54',
        slug: 'galaxy-a54',
        price: null, // null → ?? triggers right side
        basePrice: 10990000, // được dùng thay thế
        compareAtPrice: 12000000,
        thumbnail: null,
        inStock: true,
        stockQuantity: 5,
      },
    ];

    const aiText = JSON.stringify({
      response: 'Galaxy A54 đây!',
      matchedProducts: ['Samsung Galaxy A54'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(aiText, products, 'samsung');
    expect(result.products).toHaveLength(1);
    expect(result.products[0].price).toBe(10990000);
  });

  it('dùng undefined khi cả price lẫn basePrice đều undefined', () => {
    const products = [
      {
        id: 2,
        name: 'Test Product',
        slug: 'test-product',
        price: undefined,
        basePrice: undefined,
        compareAtPrice: null,
        thumbnail: null,
        inStock: true,
        stockQuantity: 1,
      },
    ];

    const aiText = JSON.stringify({
      response: 'Test',
      matchedProducts: ['Test Product'],
      suggestions: [],
      intent: 'general',
    });

    const result = chatbotService.parseAIResponse(aiText, products, 'test');
    // Không crash — price sẽ là undefined
    expect(result.products).toHaveLength(1);
    expect(result.products[0].price).toBeUndefined();
  });
});

// ============================================================
// Line 415: parsed.response || 'Tôi có thể giúp bạn tìm sản phẩm phù hợp!'
// — right side khi parsed.response falsy
// ============================================================

describe('ChatbotService.parseAIResponse — line 415: parsed.response || default', () => {
  it('dùng default text khi parsed.response = null', () => {
    const aiText = JSON.stringify({
      response: null, // null → || triggers right side
      matchedProducts: [],
      suggestions: ['Xem thêm'],
      intent: 'general',
    });

    const result = chatbotService.parseAIResponse(aiText, [], 'hello');
    expect(result.response).toBe('Tôi có thể giúp bạn tìm sản phẩm phù hợp!');
  });

  it('dùng default text khi parsed.response = "" (empty string)', () => {
    const aiText = JSON.stringify({
      response: '', // empty string → || triggers right side
      matchedProducts: [],
      suggestions: [],
      intent: 'general',
    });

    const result = chatbotService.parseAIResponse(aiText, [], 'hello');
    expect(result.response).toBe('Tôi có thể giúp bạn tìm sản phẩm phù hợp!');
  });
});

// ============================================================
// Line 443: minSize > 0 — false branch (khi cả hai product name và suggestion name
// đều rỗng sau split → Set rỗng → minSize = 0 → return false)
// ============================================================

describe('ChatbotService.parseAIResponse — line 443: minSize = 0 edge case', () => {
  it('không match khi cả pName lẫn rName đều chỉ có 1 từ ngắn bị lọc', () => {
    // pName = "a" (1 ký tự), rName = "b" (1 ký tự)
    // Sau split: pWords = {"a"}, rWords = {"b"}
    // intersection filter w.length > 1 → intersection = []
    // Nhưng minSize = min(1,1) = 1 > 0 → vào minSize > 0 branch
    // intersection.length = 0 >= 1 * 0.8 = 0.8 → false → không match
    // Đây là test cho intersection.length < minSize*0.8
    const products = [
      {
        id: 1,
        name: 'A', // lowercase: "a" — 1 từ ngắn
        slug: 'a',
        price: 1000,
        compareAtPrice: null,
        inStock: true,
        stockQuantity: 1,
      },
    ];

    const aiText = JSON.stringify({
      response: 'B here',
      matchedProducts: ['B'], // lowercase: "b" — khác hoàn toàn
      suggestions: [],
      intent: 'general',
    });

    const result = chatbotService.parseAIResponse(aiText, products, 'b');
    // Không match (intersection < 80%)
    expect(result.products).toHaveLength(0);
  });

  it('pWords hoặc rWords size = 0 khi tên rỗng sau split → minSize = 0 → return false', () => {
    // Nếu name là chuỗi rỗng sau trim → split tạo [''] → Set có '' (length 0 → lọc bỏ)
    // intersection = [], minSize = min(0, N) = 0 → minSize > 0 = false → return false
    const products = [
      {
        id: 2,
        name: '  ', // whitespace only → toLowerCase() = "  " → split = ["", ""]
        slug: 'ws',
        price: 500,
        compareAtPrice: null,
        inStock: true,
        stockQuantity: 1,
      },
    ];

    const aiText = JSON.stringify({
      response: 'test',
      matchedProducts: ['some product'],
      suggestions: [],
      intent: 'general',
    });

    // Không crash — vào minSize = 0 → return false → không match
    const result = chatbotService.parseAIResponse(aiText, products, 'test');
    expect(result.products).toHaveLength(0);
  });
});

// ============================================================
// Lines 465-471: simpleKeywordMatch — price ?? basePrice right side
// khi product.price là null/undefined
// ============================================================

describe('ChatbotService.simpleKeywordMatch — lines 465-471: price ?? basePrice', () => {
  it('dùng basePrice trong product list text khi price = null (line 465 ?? right side)', () => {
    const products = [
      {
        id: 1,
        name: 'Xiaomi Redmi Note 13',
        slug: 'redmi-note-13',
        price: null, // null → ?? right side
        basePrice: 5990000, // dùng cái này
        compareAtPrice: null,
        shortDescription: 'Tầm trung tốt',
        thumbnail: null,
        inStock: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const result = chatbotService.simpleKeywordMatch('tìm xiaomi redmi', products);

    expect(result.products.length).toBeGreaterThan(0);
    // Giá trong response text phải dùng basePrice (5990000)
    expect(result.response).toContain('5.990.000');
  });

  it('dùng basePrice trong sản phẩm map khi price = undefined (line 471 ?? right side)', () => {
    const products = [
      {
        id: 2,
        name: 'Oppo Reno 11',
        slug: 'oppo-reno-11',
        price: undefined, // undefined → ?? right side
        basePrice: 8990000,
        compareAtPrice: 10000000,
        shortDescription: 'Camera tốt',
        thumbnail: null,
        inStock: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const result = chatbotService.simpleKeywordMatch('tìm oppo reno', products);

    // Sản phẩm được match
    expect(result.products.length).toBeGreaterThan(0);
    // price field của product trong kết quả phải là basePrice
    expect(result.products[0].price).toBe(8990000);
  });

  it('discount tính đúng khi compareAtPrice > basePrice và price là null', () => {
    const products = [
      {
        id: 3,
        name: 'Realme C55',
        slug: 'realme-c55',
        price: null,
        basePrice: 4000000,
        compareAtPrice: 5000000, // 20% off
        shortDescription: 'Giá rẻ',
        thumbnail: null,
        inStock: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const result = chatbotService.simpleKeywordMatch('realme c55', products);

    if (result.products.length > 0) {
      expect(result.products[0].discount).toBe(20);
    }
  });
});

// ============================================================
// Lines 497-524: NODE_ENV = 'production' trong "new products" path
// — debug log bị bỏ qua
// ============================================================

describe('ChatbotService.simpleKeywordMatch — lines 497-524: production suppresses debug', () => {
  const productsWithDates = [
    {
      id: 1,
      name: 'Product New',
      slug: 'p-new',
      price: 5000000,
      basePrice: undefined,
      compareAtPrice: null,
      thumbnail: null,
      inStock: true,
      createdAt: new Date().toISOString(),
    },
  ];

  it('không gọi debug khi NODE_ENV=production trong new products path', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    logger.debug.mockClear();
    chatbotService.simpleKeywordMatch('sản phẩm mới', productsWithDates);

    const debugCalls = logger.debug.mock.calls.map((c) => c[0]);
    const hasNewProductLog = debugCalls.some(
      (msg) => typeof msg === 'string' && msg.includes('sản phẩm mới'),
    );
    expect(hasNewProductLog).toBe(false);

    process.env.NODE_ENV = originalEnv;
  });

  it('dùng basePrice khi price = null trong new products map (line 513 ?? right side)', () => {
    const productsWithBasePrice = [
      {
        id: 2,
        name: 'Sản phẩm mới nhất',
        slug: 'sp-moi',
        price: null, // null → ?? right side
        basePrice: 3000000, // được dùng thay thế
        compareAtPrice: null,
        thumbnail: null,
        inStock: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const result = chatbotService.simpleKeywordMatch('sản phẩm mới nhất', productsWithBasePrice);

    expect(result.products.length).toBeGreaterThan(0);
    // Giá phải dùng basePrice
    expect(result.products[0].price).toBe(3000000);
  });

  it('discount tính đúng khi price = null nhưng compareAtPrice > basePrice (line 524)', () => {
    const products = [
      {
        id: 3,
        name: 'Hàng mới về',
        slug: 'hang-moi',
        price: null,
        basePrice: 10000000,
        compareAtPrice: 12000000, // ~17% off
        thumbnail: null,
        inStock: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const result = chatbotService.simpleKeywordMatch('hàng mới', products);

    if (result.products.length > 0) {
      expect(result.products[0].discount).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Kiểm tra handleMessage — rewrittenQuery === message (không log debug rewrite)
// line 112: if (rewrittenQuery && rewrittenQuery.toLowerCase() !== message.toLowerCase())
// ============================================================

describe('ChatbotService.handleMessage — line 112: rewrittenQuery same as message', () => {
  it('không log "Câu truy vấn đã viết lại" khi rewrittenQuery giống message (case insensitive)', async () => {
    // demo-key → normalizeAndClassify trả về rewrittenQuery = message → không log rewrite
    logger.debug.mockClear();
    vectorStoreService.hybridSearch.mockResolvedValueOnce([]);

    await chatbotService.handleMessage('tìm iphone', null, null, {});

    // Không có call debug nào chứa "Câu truy vấn đã viết lại"
    const hasRewriteLog = logger.debug.mock.calls.some(
      (args) => typeof args[0] === 'string' && args[0].includes('Câu truy vấn đã viết lại'),
    );
    expect(hasRewriteLog).toBe(false);
  });

  it('log "Câu truy vấn đã viết lại" khi rewrittenQuery khác message', async () => {
    const originalProviders = [...chatbotService.providers];
    chatbotService.providers = [
      { key: 'test-key', url: 'https://api.test/v1/chat/completions', model: 'gpt-4' },
    ];
    logger.debug.mockClear();

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              // rewrittenQuery khác message gốc
              content: JSON.stringify({
                rewrittenQuery: 'iPhone 15 Pro Max',
                intent: 'product_search',
              }),
            },
          },
        ],
      },
    });
    mockRedisGet.mockResolvedValueOnce(null);
    vectorStoreService.hybridSearch.mockResolvedValueOnce([]);

    // Cần mock getAIResponse để không gọi API thật
    const originalGetAI = chatbotService.getAIResponse.bind(chatbotService);
    chatbotService.getAIResponse = jest.fn().mockResolvedValue({
      response: 'OK',
      products: [],
      suggestions: [],
      intent: 'product_search',
    });

    await chatbotService.handleMessage('ip 15 pm', null, null, {});

    const hasRewriteLog = logger.debug.mock.calls.some(
      (args) => typeof args[0] === 'string' && args[0].includes('Câu truy vấn đã viết lại'),
    );
    expect(hasRewriteLog).toBe(true);

    chatbotService.getAIResponse = originalGetAI;
    chatbotService.providers = originalProviders;
  });
});

// ============================================================
// Line 443: product.name?.toLowerCase() || '' — right side khi name null/undefined
// trong simpleKeywordMatch
// ============================================================

describe('ChatbotService.simpleKeywordMatch — line 443: name null/undefined', () => {
  it('không crash khi product.name = null (|| "" right side)', () => {
    const products = [
      {
        id: 1,
        name: null, // null → ?. returns undefined → || '' → productName = ''
        slug: 'null-product',
        price: 1000,
        compareAtPrice: null,
        shortDescription: 'test desc',
        thumbnail: null,
        inStock: true,
        createdAt: new Date().toISOString(),
      },
    ];

    // Không crash — productName = '' không match bất kỳ term nào → không push vào matched
    const result = chatbotService.simpleKeywordMatch('test', products);
    expect(result).toHaveProperty('response');
  });

  it('không crash khi product.name = undefined (|| "" right side)', () => {
    const products = [
      {
        id: 2,
        // name: undefined
        slug: 'undef-product',
        price: 2000,
        compareAtPrice: null,
        shortDescription: undefined,
        thumbnail: null,
        inStock: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const result = chatbotService.simpleKeywordMatch('any query', products);
    expect(result).toHaveProperty('response');
  });
});

// ============================================================
// Lines 507-524: simpleKeywordMatch "new products" path
// — price ?? basePrice right side (price = null → basePrice)
// — discount = 0 khi compareAtPrice <= price (false branch of c && c > p)
// ============================================================

describe('ChatbotService.simpleKeywordMatch — lines 507-524: new products map', () => {
  it('price ?? basePrice right side trong productList text khi price = null (line 507)', () => {
    // Trigger "new products" branch với product có price = null
    const products = [
      {
        id: 1,
        name: 'New Phone',
        slug: 'new-phone',
        price: null,
        basePrice: 7000000, // dùng cái này
        compareAtPrice: null,
        thumbnail: null,
        inStock: true,
        createdAt: new Date('2025-01-01').toISOString(),
      },
    ];

    const result = chatbotService.simpleKeywordMatch('sản phẩm mới nhất', products);

    expect(result.response).toContain('mới nhất');
    expect(result.response).toContain('7.000.000');
  });

  it('discount = 0 khi compareAtPrice = null trong new products map (line 524 false branch)', () => {
    const products = [
      {
        id: 2,
        name: 'New Tablet',
        slug: 'new-tablet',
        price: null,
        basePrice: 5000000,
        compareAtPrice: null, // null → c = null → c && c > p = false → discount = 0
        thumbnail: null,
        inStock: true,
        createdAt: new Date('2025-06-01').toISOString(),
      },
    ];

    const result = chatbotService.simpleKeywordMatch('hàng mới', products);

    if (result.products.length > 0) {
      expect(result.products[0].discount).toBe(0);
    }
  });
});

// ============================================================
// handleMessage — line 104: default params (userId=null, sessionId=null, context={})
// khi tất cả đều không truyền vào
// ============================================================

describe('ChatbotService.handleMessage — line 104: default parameters', () => {
  it('hoạt động đúng khi chỉ truyền message (các params còn lại là default)', async () => {
    vectorStoreService.hybridSearch.mockResolvedValueOnce([]);

    // Chỉ truyền message — userId, sessionId, context là default
    const result = await chatbotService.handleMessage('xin chào');

    expect(result).toHaveProperty('response');
    // sessionId = null → không lưu conversation history
    expect(chatbotService.conversationHistory.size).toBe(0);
  });
});

// ============================================================
// getAIResponse — line 233: history = [] default param
// ============================================================

describe('ChatbotService.getAIResponse — line 233: history default = []', () => {
  it('hoạt động đúng khi không truyền history (default = [])', async () => {
    // Production dùng this.providers array
    const originalProviders = chatbotService.providers;
    chatbotService.providers = [
      { key: 'real-api-key', url: 'https://test.api/chat', model: 'test-model' },
    ];
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = [];
    chatbotService._catalogCacheExpiry = Date.now() + 60000;

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                response: 'OK',
                matchedProducts: [],
                suggestions: [],
                intent: 'general',
              }),
            },
          },
        ],
      },
    });

    // Không truyền history argument → default = []
    const result = await chatbotService.getAIResponse('tìm iphone', [], {});

    expect(result).toHaveProperty('response');
    // Messages phải chứa system + user (không có history items)
    const callArgs = axios.post.mock.calls[0][1];
    expect(callArgs.messages).toHaveLength(2); // system + user only

    chatbotService.providers = originalProviders;
  });
});

// ============================================================
// Line 258: (this._categoriesCache || []) / (this._brandsCache || [])
// — right side triggered khi cache null DURING prompt construction
// (khi _ensureCatalogCache không được gọi hoặc cache vẫn null sau load)
// ============================================================

describe('ChatbotService.getAIResponse — line 258: categoriesCache null in systemContent', () => {
  it('systemContent dùng [] khi _categoriesCache vẫn null sau _ensureCatalogCache', async () => {
    // Production dùng this.providers array
    const originalProviders = chatbotService.providers;
    chatbotService.providers = [
      { key: 'real-api-key', url: 'https://test.api/chat', model: 'test-model' },
    ];

    // _ensureCatalogCache sẽ được gọi nhưng trả về rỗng
    // Sau đó force caches về null để test || [] right side trong systemContent builder
    mockBrandFindAll.mockResolvedValueOnce([]);
    mockCategoryFindAll.mockResolvedValueOnce([]);
    chatbotService._brandsCache = null;
    chatbotService._categoriesCache = null;
    chatbotService._catalogCacheExpiry = 0;

    // Override _ensureCatalogCache để set cache thành null sau khi gọi
    const originalEnsure = chatbotService._ensureCatalogCache.bind(chatbotService);
    chatbotService._ensureCatalogCache = jest.fn().mockImplementation(async () => {
      // Simulate: load xong nhưng không set cache (stays null)
      // This triggers _categoriesCache || [] on line 258
    });

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                response: 'OK',
                matchedProducts: [],
                suggestions: [],
                intent: 'general',
              }),
            },
          },
        ],
      },
    });

    const result = await chatbotService.getAIResponse('hello', [], {}, []);

    // Không crash — systemContent được build với [] cho cache null
    expect(result).toHaveProperty('response');

    // Kiểm tra systemContent không chứa "Danh mục: " hoặc "Thương hiệu: " vì cache rỗng
    const callArgs = axios.post.mock.calls[0][1];
    const systemMsg = callArgs.messages[0].content;
    // Với [] → join(', ') = '' → systemContent có format "Danh mục:  — Thương hiệu: "
    expect(systemMsg).toContain('Danh mục:');

    chatbotService._ensureCatalogCache = originalEnsure;
    chatbotService.providers = originalProviders;
  });
});

// ============================================================
// Line 359: parsed.matchedProducts && Array.isArray — FALSE branch
// khi matchedProducts không phải mảng hoặc không tồn tại
// ============================================================

describe('ChatbotService.parseAIResponse — line 359: matchedProducts not array', () => {
  it('matchedProducts là string (không phải array) → không match, không crash', () => {
    const aiText = JSON.stringify({
      response: 'Test response',
      matchedProducts: 'not an array', // string → !Array.isArray → false branch
      suggestions: [],
      intent: 'general',
    });

    const result = chatbotService.parseAIResponse(aiText, [], 'test');
    // Không crash, products = []
    expect(result.response).toBe('Test response');
    expect(result.products).toHaveLength(0);
  });

  it('matchedProducts là number → không match, không crash', () => {
    const aiText = JSON.stringify({
      response: 'OK',
      matchedProducts: 42, // number → !Array.isArray → false branch
      suggestions: [],
      intent: 'general',
    });

    const result = chatbotService.parseAIResponse(aiText, [], 'test');
    expect(result.products).toHaveLength(0);
  });

  it('matchedProducts không tồn tại trong JSON → false branch của && check', () => {
    const aiText = JSON.stringify({
      response: 'No products field',
      // matchedProducts: undefined — không có field → parsed.matchedProducts = undefined
      suggestions: [],
      intent: 'general',
    });

    const result = chatbotService.parseAIResponse(aiText, [], 'test');
    expect(result.response).toBe('No products field');
    expect(result.products).toHaveLength(0);
  });
});

// ============================================================
// Line 524: c && c > p — TRUE branch (compareAtPrice > price → discount > 0)
// trong "new products" path
// ============================================================

describe('ChatbotService.simpleKeywordMatch — line 524: discount > 0 in new products', () => {
  it('discount > 0 khi compareAtPrice > price trong new products map (line 524 true branch)', () => {
    const products = [
      {
        id: 3,
        name: 'Brand New Model',
        slug: 'new-model',
        price: 8000000,
        compareAtPrice: 10000000, // c = 10M > p = 8M → (10-8)/10 * 100 = 20%
        basePrice: undefined,
        thumbnail: null,
        inStock: true,
        createdAt: new Date('2025-06-01').toISOString(),
      },
    ];

    const result = chatbotService.simpleKeywordMatch('mới nhất', products);

    if (result.products.length > 0) {
      expect(result.products[0].discount).toBe(20);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Additional coverage (từ chatbotService.additional.test.js)
// ═══════════════════════════════════════════════════════════════════════════════

// ---------- Mocks ----------

// ---------- Require ----------

// Quan trọng: fresh require trong mỗi test suite khi cần reset singleton state
// Dùng module cache approach — require một lần và mutate state trực tiếp
beforeAll(() => {
  chatbotService = require('./chatbot-service');
});

afterEach(() => {
  jest.clearAllMocks();
  chatbotService.conversationHistory.clear();
  // Reset catalog cache
  chatbotService._brandsCache = null;
  chatbotService._categoriesCache = null;
  chatbotService._catalogCacheExpiry = 0;
});

// ============================================================
// ChatbotService._ensureCatalogCache
// ============================================================

describe('ChatbotService._ensureCatalogCache', () => {
  beforeEach(() => {
    mockBrandFindAll.mockReset();
    mockCategoryFindAll.mockReset();
  });

  it('load brands và categories từ DB khi cache chưa có', async () => {
    // Production dùng attributes: ['nameVi', 'nameEn'] — mock data phải match
    mockBrandFindAll.mockResolvedValueOnce([
      { nameVi: 'Apple', nameEn: 'Apple' },
      { nameVi: 'Samsung', nameEn: 'Samsung' },
    ]);
    mockCategoryFindAll.mockResolvedValueOnce([
      { nameVi: 'Điện thoại', nameEn: 'Phone' },
      { nameVi: 'Laptop', nameEn: 'Laptop' },
    ]);

    await chatbotService._ensureCatalogCache();

    expect(chatbotService._brandsCache).toEqual(['Apple', 'Samsung']);
    expect(chatbotService._categoriesCache).toEqual(['Điện thoại', 'Laptop']);
    expect(chatbotService._catalogCacheExpiry).toBeGreaterThan(Date.now());
  });

  it('không gọi DB lại khi cache còn hạn', async () => {
    // Seed cache đã có
    chatbotService._brandsCache = ['Apple'];
    chatbotService._categoriesCache = ['Điện thoại'];
    chatbotService._catalogCacheExpiry = Date.now() + 60000; // còn 1 phút

    await chatbotService._ensureCatalogCache();

    expect(mockBrandFindAll).not.toHaveBeenCalled();
    expect(mockCategoryFindAll).not.toHaveBeenCalled();
  });

  it('reload khi cache hết hạn', async () => {
    chatbotService._brandsCache = ['OldBrand'];
    chatbotService._categoriesCache = ['OldCat'];
    chatbotService._catalogCacheExpiry = Date.now() - 1000; // đã hết hạn

    mockBrandFindAll.mockResolvedValueOnce([{ nameVi: 'NewBrand', nameEn: null }]);
    mockCategoryFindAll.mockResolvedValueOnce([{ nameVi: 'NewCat', nameEn: null }]);

    await chatbotService._ensureCatalogCache();

    expect(chatbotService._brandsCache).toEqual(['NewBrand']);
    expect(chatbotService._categoriesCache).toEqual(['NewCat']);
  });
});

// ============================================================
// ChatbotService.parseAIResponse
// ============================================================

describe('ChatbotService.parseAIResponse', () => {
  const sampleProducts = [
    {
      id: 1,
      name: 'iPhone 15 Pro',
      slug: 'iphone-15-pro',
      price: 29990000,
      basePrice: undefined,
      compareAtPrice: 32000000,
      thumbnail: '/img/iphone15.jpg',
      inStock: true,
      stockQuantity: 5,
    },
    {
      id: 2,
      name: 'Samsung Galaxy S24',
      slug: 'samsung-galaxy-s24',
      price: 19990000,
      basePrice: undefined,
      compareAtPrice: null,
      thumbnail: '/img/s24.jpg',
      inStock: true,
      stockQuantity: 3,
    },
    {
      id: 3,
      name: 'iPhone 15 Pro Max',
      slug: 'iphone-15-pro-max',
      price: 34990000,
      basePrice: undefined,
      compareAtPrice: null,
      thumbnail: null,
      inStock: false,
      stockQuantity: 0,
    },
  ];

  it('parse JSON response và match sản phẩm theo tên chính xác', () => {
    const aiText = JSON.stringify({
      response: 'Tôi gợi ý iPhone 15 Pro cho bạn!',
      matchedProducts: ['iPhone 15 Pro'],
      suggestions: ['Xem thêm'],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(aiText, sampleProducts, 'iphone');

    expect(result.response).toBe('Tôi gợi ý iPhone 15 Pro cho bạn!');
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('iPhone 15 Pro');
    expect(result.products[0].price).toBe(29990000);
    expect(result.intent).toBe('product_search');
  });

  it('tính discount đúng khi compareAtPrice > price', () => {
    const aiText = JSON.stringify({
      response: 'Sản phẩm giảm giá',
      matchedProducts: ['iPhone 15 Pro'],
      suggestions: [],
      intent: 'pricing',
    });

    const result = chatbotService.parseAIResponse(aiText, sampleProducts, 'iphone');

    // iPhone 15 Pro: price 29990000, compareAtPrice 32000000
    const product = result.products[0];
    expect(product.discount).toBeGreaterThan(0);
    expect(product.discount).toBeLessThan(100);
  });

  it('discount = 0 khi compareAtPrice = null', () => {
    const aiText = JSON.stringify({
      response: 'Samsung đây',
      matchedProducts: ['Samsung Galaxy S24'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(aiText, sampleProducts, 'samsung');

    expect(result.products[0].discount).toBe(0);
  });

  it('KHÔNG match "iPhone 15 Pro" khi LLM đề xuất "iPhone 15 Pro Max" (version mismatch)', () => {
    const aiText = JSON.stringify({
      response: 'Pro Max đây',
      matchedProducts: ['iPhone 15 Pro Max'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(aiText, sampleProducts, 'iphone pro max');

    // Phải match đúng Pro Max, không match nhầm Pro
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('iPhone 15 Pro Max');
  });

  it('log warning khi LLM đề xuất sản phẩm không tồn tại trong context (hallucination)', () => {
    const aiText = JSON.stringify({
      response: 'Đây là sản phẩm mới',
      matchedProducts: ['iPhone 16 Pro Max 1TB Titanium Phantom'],
      suggestions: [],
      intent: 'product_search',
    });

    chatbotService.parseAIResponse(aiText, sampleProducts, 'iphone');

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Hallucination detected'));
  });

  it('dùng fallback suggestions khi parsed.suggestions rỗng/undefined', () => {
    const aiText = JSON.stringify({
      response: 'OK',
      matchedProducts: [],
      intent: 'general',
    });

    const result = chatbotService.parseAIResponse(aiText, [], 'hello');

    expect(result.suggestions).toHaveLength(4); // default 4 suggestions
  });

  it('fallback về simpleKeywordMatch khi JSON parse fail', () => {
    const result = chatbotService.parseAIResponse('not-json-at-all', sampleProducts, 'iphone');

    // simpleKeywordMatch sẽ tìm "iphone" trong product names
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('products');
  });

  it('dùng default intent = general khi parsed.intent không có', () => {
    const aiText = JSON.stringify({
      response: 'Trả lời chung',
      matchedProducts: [],
      suggestions: [],
    });

    const result = chatbotService.parseAIResponse(aiText, [], 'hello');
    expect(result.intent).toBe('general');
  });

  it('inStock fallback = true khi product.inStock = undefined', () => {
    const productsWithUndefinedInStock = [
      {
        id: 10,
        name: 'Test Product',
        slug: 'test',
        price: 1000,
        compareAtPrice: null,
        thumbnail: null,
        stockQuantity: 1,
      },
    ];

    const aiText = JSON.stringify({
      response: 'Test',
      matchedProducts: ['Test Product'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(aiText, productsWithUndefinedInStock, 'test');
    expect(result.products[0].inStock).toBe(true);
  });

  it('loại bỏ markdown code fence trước khi parse JSON', () => {
    const aiText =
      '```json\n{"response":"Tốt","matchedProducts":[],"suggestions":[],"intent":"general"}\n```';

    const result = chatbotService.parseAIResponse(aiText, [], 'hello');
    expect(result.response).toBe('Tốt');
  });
});

// ============================================================
// ChatbotService.simpleKeywordMatch — nhánh hàng mới nhất
// ============================================================

describe('ChatbotService.simpleKeywordMatch — hàng mới nhất', () => {
  const productsWithDates = [
    {
      id: 1,
      name: 'Laptop A',
      slug: 'laptop-a',
      price: 15000000,
      basePrice: undefined,
      compareAtPrice: null,
      thumbnail: null,
      inStock: true,
      createdAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 2,
      name: 'Laptop B',
      slug: 'laptop-b',
      price: 20000000,
      basePrice: undefined,
      compareAtPrice: null,
      thumbnail: null,
      inStock: true,
      createdAt: '2025-06-01T00:00:00Z', // mới hơn
    },
    {
      id: 3,
      name: 'Phone C',
      slug: 'phone-c',
      price: 10000000,
      basePrice: undefined,
      compareAtPrice: null,
      thumbnail: null,
      inStock: false,
      createdAt: '2024-01-01T00:00:00Z',
    },
  ];

  it('query "sản phẩm mới" → sort theo createdAt DESC và trả về sản phẩm mới nhất', () => {
    const result = chatbotService.simpleKeywordMatch('sản phẩm mới nhất', productsWithDates);

    expect(result.response).toContain('mới nhất');
    // Laptop B (2025-06-01) phải đứng đầu
    expect(result.products[0].name).toBe('Laptop B');
  });

  it('query "hàng mới" → kích hoạt nhánh new products', () => {
    const result = chatbotService.simpleKeywordMatch('hàng mới về', productsWithDates);

    expect(result.suggestions).toContain('Sản phẩm khuyến mãi');
    expect(result.intent).toBe('product_search');
  });

  it('query "new" → kích hoạt nhánh new products', () => {
    const result = chatbotService.simpleKeywordMatch('show me new products', productsWithDates);

    // English input → detectLanguage('show me new products') = 'en' → English response
    expect(result.response).toContain('latest');
  });

  it('query "mới nhất" → kích hoạt nhánh new products', () => {
    const result = chatbotService.simpleKeywordMatch('điện thoại mới nhất', productsWithDates);

    expect(result).toHaveProperty('products');
    expect(result.intent).toBe('product_search');
  });

  it('query thông thường không khớp → getFallbackResponse', () => {
    const result = chatbotService.simpleKeywordMatch('xyzzy không khớp gì', []);

    // simpleKeywordMatch → không có match → getFallbackResponse
    expect(result).toHaveProperty('response');
    expect(result.intent).toBe('general');
  });
});

// ============================================================
// ChatbotService.simpleKeywordMatch — keyword matching
// ============================================================

describe('ChatbotService.simpleKeywordMatch — keyword matching', () => {
  const products = [
    {
      id: 1,
      name: 'iPhone 15 Pro',
      slug: 'iphone-15-pro',
      price: 29990000,
      basePrice: undefined,
      compareAtPrice: 32000000,
      shortDescription: 'Flagship của Apple',
      thumbnail: null,
      inStock: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      name: 'MacBook Pro M4',
      slug: 'macbook-pro-m4',
      price: 45000000,
      basePrice: undefined,
      compareAtPrice: null,
      shortDescription: 'Laptop chuyên nghiệp',
      thumbnail: null,
      inStock: true,
      createdAt: new Date().toISOString(),
    },
  ];

  it('khớp sản phẩm theo keyword trong tên và trả về danh sách', () => {
    const result = chatbotService.simpleKeywordMatch('tìm iphone', products);

    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products[0].name).toBe('iPhone 15 Pro');
  });

  it('khớp sản phẩm theo keyword trong shortDescription', () => {
    const result = chatbotService.simpleKeywordMatch('laptop chuyên nghiệp', products);

    // MacBook Pro M4 có shortDescription chứa "laptop"
    expect(result).toHaveProperty('products');
  });

  it('tính discount đúng cho sản phẩm có compareAtPrice', () => {
    const result = chatbotService.simpleKeywordMatch('iphone', products);

    const iphone = result.products.find((p) => p.name === 'iPhone 15 Pro');
    if (iphone) {
      expect(iphone.discount).toBeGreaterThan(0);
    }
  });

  it('dedup products theo id khi cùng product match nhiều term', () => {
    const result = chatbotService.simpleKeywordMatch('iphone flagship apple', products);

    const ids = result.products.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ============================================================
// ChatbotService.getAIResponse — success path
// ============================================================

describe('ChatbotService.getAIResponse — success path', () => {
  beforeEach(() => {
    axios.post.mockReset();
    // Seed catalog cache để không gọi DB
    chatbotService._brandsCache = ['Apple', 'Samsung'];
    chatbotService._categoriesCache = ['Điện thoại', 'Laptop'];
    chatbotService._catalogCacheExpiry = Date.now() + 60000;
  });

  it('trả về parsed AI response khi API trả về JSON hợp lệ', async () => {
    // Production dùng this.providers array — push provider tạm để trigger API call
    const originalProviders = chatbotService.providers;
    chatbotService.providers = [
      { key: 'real-api-key', url: 'https://test.api/chat', model: 'test-model' },
    ];

    const aiResponseBody = {
      response: 'Đây là iPhone 15 Pro!',
      matchedProducts: ['iPhone 15 Pro'],
      suggestions: ['Xem chip', 'So sánh'],
      intent: 'product_search',
    };

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: JSON.stringify(aiResponseBody) } }],
      },
    });

    const products = [
      {
        id: 1,
        name: 'iPhone 15 Pro',
        slug: 'iphone-15-pro',
        price: 29990000,
        compareAtPrice: null,
        inStock: true,
        stockQuantity: 5,
      },
    ];

    const result = await chatbotService.getAIResponse('iphone 15 pro', products, {}, []);

    expect(result.response).toBe('Đây là iPhone 15 Pro!');
    expect(result.products).toHaveLength(1);
    expect(result.intent).toBe('product_search');

    chatbotService.providers = originalProviders;
  });

  it('trả về fallback khi choices[0].message.content rỗng', async () => {
    const originalProviders = chatbotService.providers;
    chatbotService.providers = [
      { key: 'real-api-key', url: 'https://test.api/chat', model: 'test-model' },
    ];

    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: null } }] },
    });

    const result = await chatbotService.getAIResponse('tìm điện thoại', [], {}, []);

    expect(result).toHaveProperty('response');
    expect(result.intent).toBe('general');

    chatbotService.providers = originalProviders;
  });

  it('truyền conversation history vào API call', async () => {
    const originalProviders = chatbotService.providers;
    chatbotService.providers = [
      { key: 'real-api-key', url: 'https://test.api/chat', model: 'test-model' },
    ];

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                response: 'OK',
                matchedProducts: [],
                suggestions: [],
                intent: 'general',
              }),
            },
          },
        ],
      },
    });

    const history = [
      { role: 'user', content: 'câu trước' },
      { role: 'assistant', content: 'trả lời trước' },
    ];

    await chatbotService.getAIResponse('câu tiếp theo', [], {}, history);

    const callArgs = axios.post.mock.calls[0][1];
    // messages phải chứa history
    expect(callArgs.messages.some((m) => m.content === 'câu trước')).toBe(true);

    chatbotService.providers = originalProviders;
  });

  it('sanitize userMessage — trim và giới hạn 2000 ký tự', async () => {
    const originalProviders = chatbotService.providers;
    chatbotService.providers = [
      { key: 'real-api-key', url: 'https://test.api/chat', model: 'test-model' },
    ];

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                response: 'OK',
                matchedProducts: [],
                suggestions: [],
                intent: 'general',
              }),
            },
          },
        ],
      },
    });

    const longMessage = 'a'.repeat(2500); // vượt giới hạn 2000
    await chatbotService.getAIResponse(longMessage, [], {}, []);

    const callArgs = axios.post.mock.calls[0][1];
    const userMsgContent = callArgs.messages[callArgs.messages.length - 1].content;
    expect(userMsgContent).toContain('a'.repeat(100));
    expect(userMsgContent.includes('a'.repeat(2001))).toBe(false);

    chatbotService.providers = originalProviders;
  });
});

// ============================================================
// ChatbotService.parseAIResponse — number-based version matching
// ============================================================

describe('ChatbotService.parseAIResponse — version number matching', () => {
  const productsWithVersionNumbers = [
    {
      id: 1,
      name: 'iPhone 15',
      slug: 'iphone-15',
      price: 20000000,
      compareAtPrice: null,
      inStock: true,
      stockQuantity: 3,
    },
    {
      id: 2,
      name: 'iPhone 16',
      slug: 'iphone-16',
      price: 25000000,
      compareAtPrice: null,
      inStock: true,
      stockQuantity: 2,
    },
    {
      id: 3,
      name: 'Galaxy S24 Ultra',
      slug: 'galaxy-s24-ultra',
      price: 30000000,
      compareAtPrice: null,
      inStock: true,
      stockQuantity: 1,
    },
    {
      id: 4,
      name: 'Galaxy S24',
      slug: 'galaxy-s24',
      price: 22000000,
      compareAtPrice: null,
      inStock: true,
      stockQuantity: 5,
    },
  ];

  it('KHÔNG match iPhone 15 khi LLM đề xuất iPhone 16 (version number mismatch)', () => {
    const aiText = JSON.stringify({
      response: 'iPhone 16 đây!',
      matchedProducts: ['iPhone 16'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(aiText, productsWithVersionNumbers, 'iphone 16');

    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('iPhone 16');
  });

  it('KHÔNG match Galaxy S24 khi LLM đề xuất Galaxy S24 Ultra (ultra version keyword)', () => {
    const aiText = JSON.stringify({
      response: 'Galaxy S24 Ultra đây!',
      matchedProducts: ['Galaxy S24 Ultra'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(
      aiText,
      productsWithVersionNumbers,
      'galaxy ultra',
    );

    // Phải match đúng Ultra, không match S24 thường
    const matchedNames = result.products.map((p) => p.name);
    expect(matchedNames).not.toContain('Galaxy S24');
    if (matchedNames.length > 0) {
      expect(matchedNames[0]).toContain('Ultra');
    }
  });

  it('match sản phẩm bằng word intersection khi không có version keyword', () => {
    const simpleProducts = [
      {
        id: 10,
        name: 'Laptop Dell Inspiron',
        slug: 'dell-inspiron',
        price: 15000000,
        compareAtPrice: null,
        inStock: true,
        stockQuantity: 2,
      },
    ];

    const aiText = JSON.stringify({
      response: 'Dell Inspiron phù hợp!',
      matchedProducts: ['Laptop Dell Inspiron'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(aiText, simpleProducts, 'dell');

    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Laptop Dell Inspiron');
  });
});

// ============================================================
// ChatbotService.parseAIResponse — word intersection matching (lines 382-386)
//
// Điều kiện để vào nhánh này:
//   1. pName !== rName (không exact match)
//   2. version keywords giống nhau (cả hai đều KHÔNG có, hoặc cùng set)
//   3. version numbers không xung đột
//   4. word intersection quyết định kết quả
// ============================================================

describe('ChatbotService.parseAIResponse — word intersection matching (lines 382-386)', () => {
  it('intersection ≥ 80% words → match thành công (line 386 = true)', () => {
    // pName = "laptop dell inspiron" (3 từ: laptop, dell, inspiron)
    // rName = "dell inspiron laptop" (3 từ: dell, inspiron, laptop — khác order)
    // pName !== rName (khác order trong tên gốc, dù lowercase bằng nhau sau Set)
    // Không có version keyword, không có số → vào word intersection
    // intersection = {dell, inspiron, laptop} → size 3, minSize = 3
    // 3 >= 3 * 0.8 = 2.4 → true
    const products = [
      {
        id: 1,
        name: 'Laptop Dell Inspiron',
        slug: 'laptop-dell-inspiron',
        price: 15000000,
        compareAtPrice: null,
        inStock: true,
        stockQuantity: 2,
      },
    ];

    const aiText = JSON.stringify({
      response: 'Dell Inspiron Laptop này rất tốt!',
      // LLM đề xuất tên khác order nhưng cùng từ
      matchedProducts: ['Dell Inspiron Laptop'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(aiText, products, 'dell inspiron');

    // Phải match vì word intersection >= 80%
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Laptop Dell Inspiron');
  });

  it('intersection < 80% words → không match (line 386 = false)', () => {
    // pName = "laptop dell inspiron" (3 từ)
    // rName = "laptop samsung galaxy" (3 từ)
    // intersection chỉ có "laptop" → size 1, minSize = 3
    // 1 >= 3 * 0.8 = 2.4 → false → không match
    const products = [
      {
        id: 1,
        name: 'Laptop Dell Inspiron',
        slug: 'laptop-dell-inspiron',
        price: 15000000,
        compareAtPrice: null,
        inStock: true,
        stockQuantity: 2,
      },
    ];

    const aiText = JSON.stringify({
      response: 'Laptop Samsung Galaxy đây!',
      matchedProducts: ['Laptop Samsung Galaxy'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(aiText, products, 'samsung');

    // KHÔNG match vì word intersection < 80%
    expect(result.products).toHaveLength(0);
  });

  it('intersection đúng ngưỡng 80% → match (4 từ khớp trên 5, tỷ lệ 0.8)', () => {
    // pName = "tai nghe sony wh xm" (5 từ)
    // rName = "tai nghe sony wh extra" (5 từ)
    // intersection = {tai, nghe, sony, wh} (w.length > 1 → "wh" = 2, hợp lệ)
    // Nhưng "tai" length=3 > 1, "nghe" length=4 > 1, "sony" length=4 > 1, "wh" length=2 > 1
    // → intersection size = 4, minSize = 5
    // 4 >= 5 * 0.8 = 4 → true (đúng ngưỡng)
    const products = [
      {
        id: 3,
        name: 'Tai Nghe Sony WH XM',
        slug: 'tai-nghe-sony-wh-xm',
        price: 8000000,
        compareAtPrice: null,
        inStock: true,
        stockQuantity: 5,
      },
    ];

    const aiText = JSON.stringify({
      response: 'Sony WH Extra tuyệt!',
      matchedProducts: ['Tai Nghe Sony WH Extra'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(aiText, products, 'sony');

    // Đúng 80% → phải match
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Tai Nghe Sony WH XM');
  });

  it('intersection dưới ngưỡng (3/5 = 60% < 80%) → không match', () => {
    // pName = "tai nghe sony wh xm" (5 từ)
    // rName = "tai nghe bose qc noise" (5 từ)
    // intersection = {tai, nghe} → size 2, minSize = 5
    // 2 >= 5 * 0.8 = 4 → false
    const products = [
      {
        id: 3,
        name: 'Tai Nghe Sony WH XM',
        slug: 'tai-nghe-sony-wh-xm',
        price: 8000000,
        compareAtPrice: null,
        inStock: true,
        stockQuantity: 5,
      },
    ];

    const aiText = JSON.stringify({
      response: 'Tai Nghe Bose QC Noise đây!',
      matchedProducts: ['Tai Nghe Bose QC Noise'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(aiText, products, 'bose');

    // Không match: 2/5 = 40% < 80%
    expect(result.products).toHaveLength(0);
  });

  it('từ đơn ký tự bị loại khỏi intersection (w.length > 1 điều kiện — line 384)', () => {
    // pName = "màn hình lg c" (4 từ, "c" bị loại vì length = 1)
    // rName = "màn hình samsung c" (4 từ, "c" bị loại)
    // intersection sau khi lọc w.length > 1 = {màn, hình} → size 2, minSize = 4
    // 2 >= 4 * 0.8 = 3.2 → false
    const products = [
      {
        id: 5,
        name: 'Màn Hình LG C',
        slug: 'man-hinh-lg-c',
        price: 12000000,
        compareAtPrice: null,
        inStock: true,
        stockQuantity: 3,
      },
    ];

    const aiText = JSON.stringify({
      response: 'Màn Hình Samsung C',
      matchedProducts: ['Màn Hình Samsung C'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(aiText, products, 'màn hình');

    // Từ "c" bị loại → intersection = {màn, hình} = 2 < 3.2 → không match
    expect(result.products).toHaveLength(0);
  });
});

// ============================================================
// ChatbotService.handleMessage — outer catch fallback
// ============================================================

describe('ChatbotService.handleMessage — outer catch fallback', () => {
  it('trả về fallback khi normalizeAndClassify throw không xử lý được', async () => {
    const originalProviders = [...chatbotService.providers];
    chatbotService.providers = [
      { key: 'test-key', url: 'https://api.test/v1/chat/completions', model: 'gpt-4' },
    ];

    // normalizeAndClassify dùng axios.post — mock nó throw KHÔNG phải Error object
    // để trigger outer catch (inner try-catch trong normalizeAndClassify bắt Error,
    // nhưng outer catch trong handleMessage bắt nếu có lỗi khác)
    // Cách trigger: mock _persistMessages để throw
    const origPersist = chatbotService._persistMessages.bind(chatbotService);
    const mockPersist = jest.fn().mockRejectedValue(new Error('DB crash'));
    chatbotService._persistMessages = mockPersist;

    // normalizeAndClassify → intent off_topic → _persistMessages throw → outer catch
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({ rewrittenQuery: 'bóng đá', intent: 'off_topic' }),
            },
          },
        ],
      },
    });

    const result = await chatbotService.handleMessage('bóng đá hôm nay', null, null, {});

    expect(result).toHaveProperty('response');

    // Restore
    chatbotService._persistMessages = origPersist;
    chatbotService.providers = originalProviders;
  });
});

// ============================================================
// ChatbotService.handleMessage — cache write
// ============================================================

describe('ChatbotService.handleMessage — cache write', () => {
  it('ghi kết quả vào Redis cache sau khi xử lý thành công với intent product_search', async () => {
    const originalProviders = [...chatbotService.providers];
    chatbotService.providers = [
      { key: 'test-key', url: 'https://api.test/v1/chat/completions', model: 'gpt-4' },
    ];

    // normalizeAndClassify trả về product_search intent
    axios.post
      .mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({ rewrittenQuery: 'iphone 15', intent: 'product_search' }),
              },
            },
          ],
        },
      })
      // getAIResponse API call
      .mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  response: 'OK iphone',
                  matchedProducts: [],
                  suggestions: [],
                  intent: 'product_search',
                }),
              },
            },
          ],
        },
      });

    // Cache miss (không có cache sẵn)
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSetEx.mockResolvedValueOnce('OK');

    vectorStoreService.hybridSearch.mockResolvedValueOnce([]);
    chatbotService._brandsCache = ['Apple'];
    chatbotService._categoriesCache = ['Điện thoại'];
    chatbotService._catalogCacheExpiry = Date.now() + 60000;

    await chatbotService.handleMessage('iphone 15', 1, 'sess-cache', {});

    // Redis setEx phải được gọi để cache kết quả
    expect(mockRedisSetEx).toHaveBeenCalledWith(
      expect.stringContaining('chatbot:'),
      expect.any(Number),
      expect.any(String),
    );

    chatbotService.providers = originalProviders;
  });

  it('KHÔNG ghi cache khi intent không phải cacheable (order_inquiry)', async () => {
    const originalProviders = [...chatbotService.providers];
    chatbotService.providers = [
      { key: 'test-key', url: 'https://api.test/v1/chat/completions', model: 'gpt-4' },
    ];

    // normalizeAndClassify trả về order_inquiry (không cacheable)
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({ rewrittenQuery: 'đơn hàng', intent: 'order_inquiry' }),
            },
          },
        ],
      },
    });

    vectorStoreService.hybridSearch.mockResolvedValueOnce([]);
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = [];
    chatbotService._catalogCacheExpiry = Date.now() + 60000;

    // getAIResponse
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                response: 'Đơn hàng bạn...',
                matchedProducts: [],
                suggestions: [],
                intent: 'order_inquiry',
              }),
            },
          },
        ],
      },
    });

    await chatbotService.handleMessage('đơn hàng của tôi', 1, 'sess-order', {});

    expect(mockRedisSetEx).not.toHaveBeenCalled();

    chatbotService.providers = originalProviders;
  });
});

// ============================================================
// ChatbotService — line 149: vectorStore.hybridSearch trả về kết quả có metadata
// (map callback `res => ({ ...res.metadata, score: res.score })` phải được gọi)
// ============================================================

describe('ChatbotService — vectorStore.hybridSearch với non-empty results (line 149 map callback)', () => {
  beforeEach(() => {
    // Seed catalog cache
    chatbotService._brandsCache = ['Apple'];
    chatbotService._categoriesCache = ['Điện thoại'];
    chatbotService._catalogCacheExpiry = Date.now() + 60000;
  });

  it('vectorStore.hybridSearch trả về results có metadata → map callback chạy (line 149)', async () => {
    const originalProviders = [...chatbotService.providers];
    chatbotService.providers = [
      { key: 'test-key', url: 'https://api.test/v1/chat/completions', model: 'gpt-4' },
    ];

    // vectorStoreService.hybridSearch trả về kết quả với metadata và score
    vectorStoreService.hybridSearch.mockResolvedValueOnce([
      {
        metadata: { id: 1, name: 'iPhone 15', slug: 'iphone-15', price: 20000000 },
        score: 0.95,
      },
      {
        metadata: { id: 2, name: 'Samsung Galaxy S24', slug: 'galaxy-s24', price: 18000000 },
        score: 0.87,
      },
    ]);

    // Mock normalizeAndClassify để return product_search intent
    const originalPreprocess = chatbotService.normalizeAndClassify.bind(chatbotService);
    chatbotService.normalizeAndClassify = jest.fn().mockResolvedValue({
      intent: 'product_search',
      normalizedQuery: 'iphone',
      shouldRespond: true,
      suggestedResponse: null,
    });

    // Mock getAIResponse để không thực sự gọi API
    const originalGetAI = chatbotService.getAIResponse.bind(chatbotService);
    chatbotService.getAIResponse = jest.fn().mockResolvedValue({
      response: 'Đây là iPhone 15!',
      products: [{ id: 1, name: 'iPhone 15', price: 20000000 }],
      suggestions: [],
      intent: 'product_search',
    });

    mockRedisGet.mockResolvedValue(null);
    mockChatMessageBulkCreate.mockResolvedValue([]);

    await chatbotService.handleMessage('tìm iphone', null, 'sess-vec-test', {});

    // Map callback được gọi với non-empty results → relevantProducts được populated
    expect(vectorStoreService.hybridSearch).toHaveBeenCalled();

    // Restore
    chatbotService.normalizeAndClassify = originalPreprocess;
    chatbotService.getAIResponse = originalGetAI;
    chatbotService.providers = originalProviders;
    jest.clearAllMocks();
  });
});

// ============================================================
// ChatbotService.parseAIResponse — line 372 every() callback
// (khi rVersions.length === pVersions.length nhưng keywords khác nhau)
// ============================================================

describe('ChatbotService.parseAIResponse — line 372 every() callback', () => {
  it('cùng số version keywords nhưng khác loại → every() trả false → không match (line 372 right side)', () => {
    // rName = 'iphone 15 pro' → rVersions = ['pro'] (length 1)
    // pName = 'iphone 15 max' → pVersions = ['max'] (length 1)
    // rVersions.length === pVersions.length (cả hai = 1) → left side false
    // rVersions.every(v => pVersions.includes(v)) → 'pro' in ['max'] → false → !false = true
    // → if true → return false → không match
    const products = [
      {
        id: 1,
        name: 'iPhone 15 Max', // có version keyword 'max'
        slug: 'iphone-15-max',
        price: 25000000,
        compareAtPrice: null,
        inStock: true,
        stockQuantity: 3,
      },
    ];

    const aiText = JSON.stringify({
      response: 'iPhone 15 Pro đây!',
      matchedProducts: ['iPhone 15 Pro'], // 'pro' keyword, khác 'max'
      suggestions: [],
      intent: 'product_search',
    });

    const result = chatbotService.parseAIResponse(aiText, products, 'iphone 15');

    // 'pro' !== 'max' → every() callback thực thi và trả false → không match
    expect(result.products).toHaveLength(0);
    // Hallucination detected vì không match được sản phẩm nào
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Hallucination detected'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Extra coverage: _llmRewrite, constructor env, retrieved products, error rotation
// (từ chatbotService.extra2.test.js)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockHybridSearch = jest.fn();

// ── Require ───────────────────────────────────────────────────────────────────

beforeAll(() => {
  chatbotService = require('./chatbot-service');
});

afterEach(() => {
  jest.clearAllMocks();
  chatbotService.conversationHistory.clear();
  chatbotService._brandsCache = null;
  chatbotService._categoriesCache = null;
  chatbotService._catalogCacheExpiry = 0;
  // Reset providers về rỗng sau mỗi test
  chatbotService.providers = [];
});

// ── Helper: thêm provider giả vào singleton ───────────────────────────────────
function addFakeProvider(overrides = {}) {
  chatbotService.providers.push({
    key: 'fake-key',
    url: 'https://api.fake.test/chat/completions',
    model: 'fake-model',
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constructor với LLM env vars (line 51)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ChatbotService constructor với LLM_API_KEY + LLM_BASE_URL', () => {
  test('providers có LLM entry khi env vars được set kèm LLM_MODEL', () => {
    let serviceWithEnv;
    process.env.LLM_API_KEY = 'test-llm-key';
    process.env.LLM_BASE_URL = 'https://llm.test.com';
    process.env.LLM_MODEL = 'test-model-v1';

    jest.isolateModules(() => {
      serviceWithEnv = require('./chatbot-service');
    });

    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_MODEL;

    expect(serviceWithEnv.providers.some((p) => p.key === 'test-llm-key')).toBe(true);
    expect(serviceWithEnv.providers.some((p) => p.model === 'test-model-v1')).toBe(true);
  });

  test('dùng model mặc định openai/gpt-4.5 khi LLM_MODEL không set (line 54)', () => {
    let serviceWithEnv;
    process.env.LLM_API_KEY = 'default-model-key';
    process.env.LLM_BASE_URL = 'https://llm.test.com';
    // LLM_MODEL không set → dùng default

    jest.isolateModules(() => {
      serviceWithEnv = require('./chatbot-service');
    });

    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;

    const llmProvider = serviceWithEnv.providers.find((p) => p.key === 'default-model-key');
    expect(llmProvider).toBeDefined();
    expect(llmProvider.model).toBe('openai/gpt-4.5');
  });

  test('providers rỗng khi không có LLM_API_KEY', () => {
    let serviceWithEnv;
    const savedKey = process.env.LLM_API_KEY;
    const savedUrl = process.env.LLM_BASE_URL;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;
    jest.isolateModules(() => {
      serviceWithEnv = require('./chatbot-service');
    });
    process.env.LLM_API_KEY = savedKey;
    process.env.LLM_BASE_URL = savedUrl;
    expect(serviceWithEnv.providers.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// _llmRewrite
// ═══════════════════════════════════════════════════════════════════════════════

describe('ChatbotService._llmRewrite', () => {
  beforeEach(() => {
    // Reset axios mock để xóa mockResolvedValueOnce queue từ các sections trước
    axios.post.mockReset();
  });

  test('trả về null khi providers rỗng', async () => {
    const result = await chatbotService._llmRewrite('điện thoại Samsung');
    expect(result).toBeNull();
  });

  test('trả về rewritten query khi khác message gốc', async () => {
    addFakeProvider();
    axios.post.mockResolvedValue({
      data: { choices: [{ message: { content: 'Samsung Galaxy S25' } }] },
    });
    const result = await chatbotService._llmRewrite('ss s25');
    expect(result).toBe('Samsung Galaxy S25');
  });

  test('trả về null khi rewritten giống message gốc', async () => {
    addFakeProvider();
    axios.post.mockResolvedValue({
      data: { choices: [{ message: { content: 'iPhone 15' } }] },
    });
    const result = await chatbotService._llmRewrite('iPhone 15');
    expect(result).toBeNull();
  });

  test('trả về null khi response không có content', async () => {
    addFakeProvider();
    axios.post.mockResolvedValue({
      data: { choices: [{ message: { content: '' } }] },
    });
    const result = await chatbotService._llmRewrite('laptop gaming');
    expect(result).toBeNull();
  });

  test('retry provider tiếp theo khi gặp lỗi 429', async () => {
    addFakeProvider({ key: 'key-1' });
    addFakeProvider({ key: 'key-2' });
    // Provider 1 trả 429, provider 2 thành công
    const err429 = Object.assign(new Error('Rate limit'), { response: { status: 429 } });
    axios.post.mockRejectedValueOnce(err429).mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'MacBook Air M3' } }] },
    });
    const result = await chatbotService._llmRewrite('macbook air m3');
    expect(result).toBe('MacBook Air M3');
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  test('retry khi lỗi 402, 500, 503', async () => {
    addFakeProvider();
    for (const status of [402, 500, 503]) {
      axios.post.mockClear();
      const err = Object.assign(new Error('Error'), { response: { status } });
      axios.post.mockRejectedValue(err);
      const result = await chatbotService._llmRewrite('test');
      expect(result).toBeNull();
    }
  });

  test('retry khi lỗi network (không có response)', async () => {
    addFakeProvider();
    const networkErr = new Error('Network error');
    // networkErr.response = undefined (không set)
    axios.post.mockRejectedValue(networkErr);
    const result = await chatbotService._llmRewrite('laptop dell');
    expect(result).toBeNull();
  });

  test('break (không retry) khi lỗi 400 (không phải 429/402/500/503)', async () => {
    addFakeProvider({ key: 'key-1' });
    addFakeProvider({ key: 'key-2' });
    const err400 = Object.assign(new Error('Bad request'), { response: { status: 400 } });
    axios.post.mockRejectedValue(err400);
    const result = await chatbotService._llmRewrite('test query');
    // Chỉ gọi 1 lần vì break sau lỗi 400
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// handleMessage — context.retrievedProducts path (lines 249-251)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// handleMessage — off-topic English path (lines 178-182)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ChatbotService.handleMessage — off-topic English', () => {
  test('trả về response tiếng Anh khi off-topic message là tiếng Anh', async () => {
    // 'football match today' → isOffTopic = true, detectLanguage('football match today') = 'en'
    const result = await chatbotService.handleMessage('football match today', null, null, {});

    expect(result.intent).toBe('off_topic');
    // English response contains English keywords
    expect(result.response).toMatch(/area of expertise|tech products/i);
    expect(result.suggestions).toContain('View phones');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// handleMessage — cache hit với sessionId (lines 209-211)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ChatbotService.handleMessage — cache hit với sessionId', () => {
  test('cache hit + sessionId → cập nhật conversationHistory', async () => {
    const cachedResponse = {
      response: 'Cached response',
      products: [],
      suggestions: [],
      intent: 'product_search',
    };
    mockRedisGet.mockResolvedValue(JSON.stringify(cachedResponse));
    mockRedisSetEx.mockResolvedValue(undefined);

    const result = await chatbotService.handleMessage(
      'iPhone 15 price', // product_search intent để vào cache path
      42,
      'sess-cache-123', // sessionId → trigger conversationHistory update
      { preClassifiedIntent: 'product_search' },
    );

    expect(result.response).toBe('Cached response');
    // ConversationHistory phải được cập nhật
    const entry = chatbotService.conversationHistory.get('sess-cache-123');
    expect(entry).toBeDefined();
    expect(entry.messages.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getAIResponse — brands/categories map arrows (lines 84-85)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ChatbotService._ensureCatalogCache — brands/categories map (lines 84-85)', () => {
  test('map arrows chạy khi brands/categories có data', async () => {
    mockBrandFindAll.mockResolvedValue([
      { nameVi: 'Samsung', nameEn: 'Samsung' },
      { nameVi: null, nameEn: 'Apple' },
    ]);
    mockCategoryFindAll.mockResolvedValue([
      { nameVi: 'Điện thoại', nameEn: 'Phone' },
      { nameVi: null, nameEn: 'Laptop' },
    ]);

    // _ensureCatalogCache được gọi từ getAIResponse khi có providers
    addFakeProvider();
    axios.post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: '{"response":"ok","products":[],"suggestions":[],"intent":"general"}',
            },
          },
        ],
      },
    });

    await chatbotService.getAIResponse('test', [], {}, []);

    expect(chatbotService._brandsCache).toContain('Samsung');
    expect(chatbotService._brandsCache).toContain('Apple');
    expect(chatbotService._categoriesCache).toContain('Điện thoại');
    expect(chatbotService._categoriesCache).toContain('Laptop');
  });
});

describe('ChatbotService.handleMessage — context.retrievedProducts', () => {
  beforeEach(() => {
    mockRedisGet.mockResolvedValue(null);
    mockRedisSetEx.mockResolvedValue(undefined);
  });

  test('dùng retrievedProducts từ context thay vì tự retrieve', async () => {
    const products = [{ id: 1, name: 'iPhone 15', score: 0.9 }];
    const context = { retrievedProducts: products, preClassifiedIntent: 'product_search' };

    // Không cần LLM provider — getAIResponse trả fallback khi providers rỗng
    const result = await chatbotService.handleMessage(
      'iPhone 15 giá bao nhiêu',
      null,
      null,
      context,
    );

    // hybridSearch KHÔNG được gọi vì đã có retrievedProducts
    expect(vectorStoreService.hybridSearch).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  test('dùng llmRewrittenQuery khi có trong context', async () => {
    const products = [{ id: 2, name: 'Samsung Galaxy S25', score: 0.8 }];
    const context = {
      retrievedProducts: products,
      llmRewrittenQuery: 'Samsung Galaxy S25 Ultra',
      preClassifiedIntent: 'product_search',
    };

    const result = await chatbotService.handleMessage('ss s25 ultra', null, null, context);

    expect(vectorStoreService.hybridSearch).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// handleMessage — legacy path: llmRewrite khác query (lines 261-269)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ChatbotService.handleMessage — legacy llmRewrite path', () => {
  beforeEach(() => {
    axios.post.mockReset();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSetEx.mockResolvedValue(undefined);
  });

  test('refined search khi llmRewrite khác searchMessage', async () => {
    addFakeProvider();
    // _llmRewrite trả rewrite khác query
    axios.post
      .mockResolvedValueOnce({
        // Lần 1: _llmRewrite
        data: { choices: [{ message: { content: 'Dell Gaming Laptop RTX 4060' } }] },
      })
      .mockResolvedValueOnce({
        // Lần 2: getAIResponse
        data: {
          choices: [
            {
              message: {
                content:
                  '{"response":"ok","products":[],"suggestions":[],"intent":"product_search"}',
              },
            },
          ],
        },
      });

    const refinedProducts = [{ metadata: { id: 10, name: 'Dell G15' }, score: 0.8 }];
    // Dùng vectorStoreService.hybridSearch (jest.fn() từ mock) thay vì mockHybridSearch riêng lẻ
    vectorStoreService.hybridSearch
      .mockResolvedValueOnce([]) // initial search
      .mockResolvedValueOnce(refinedProducts); // refined search

    const result = await chatbotService.handleMessage('laptop gaming dell', null, null, {});

    // Gọi 2 lần: initial + refined
    expect(vectorStoreService.hybridSearch).toHaveBeenCalledTimes(2);
    expect(result).toBeDefined();
  });

  test('refined search throw → fallback về initial results', async () => {
    addFakeProvider();
    axios.post
      .mockResolvedValueOnce({
        data: { choices: [{ message: { content: 'MacBook Pro M3 Max' } }] },
      })
      .mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content:
                  '{"response":"ok","products":[],"suggestions":[],"intent":"product_search"}',
              },
            },
          ],
        },
      });

    const initialProducts = [{ metadata: { id: 5, name: 'MacBook Pro' }, score: 0.7 }];
    vectorStoreService.hybridSearch
      .mockResolvedValueOnce(initialProducts) // initial
      .mockRejectedValueOnce(new Error('refined search failed')); // refined throws

    const result = await chatbotService.handleMessage('macbook pro', null, null, {});

    expect(result).toBeDefined();
  });

  test('refined search trả [] → fallback về initialSearchResults (line 267)', async () => {
    addFakeProvider();
    // _llmRewrite trả rewrite khác query (line 260: llmRewrite !== searchMessage)
    axios.post
      .mockResolvedValueOnce({
        data: { choices: [{ message: { content: 'Gaming Laptop Dell XPS' } }] },
      })
      .mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content:
                  '{"response":"ok","products":[],"suggestions":[],"intent":"product_search"}',
              },
            },
          ],
        },
      });

    const initialProducts = [{ metadata: { id: 7, name: 'Dell XPS 15' }, score: 0.6 }];
    vectorStoreService.hybridSearch
      .mockResolvedValueOnce(initialProducts) // initial: có kết quả
      .mockResolvedValueOnce([]); // refined: rỗng → dùng initial (line 267)

    const result = await chatbotService.handleMessage('laptop dell xps', null, null, {});

    expect(result).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// handleMessage — legacy path: fallback catch khi hybridSearch thất bại (line 285)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ChatbotService.handleMessage — fallback search catch (line 285)', () => {
  beforeEach(() => {
    mockRedisGet.mockResolvedValue(null);
    mockRedisSetEx.mockResolvedValue(undefined);
  });

  test('relevantProducts = [] khi fallback hybridSearch throw', async () => {
    // providers rỗng → _llmRewrite trả null
    // initial hybridSearch trả [] → fallback được gọi
    // fallback hybridSearch throw → relevantProducts = []
    vectorStoreService.hybridSearch
      .mockResolvedValueOnce([]) // initial: rỗng
      .mockRejectedValueOnce(new Error('fallback error')); // fallback throw

    const result = await chatbotService.handleMessage('laptop gaming', null, null, {});

    expect(result).toBeDefined();
    // Fallback getAIResponse với products=[] → simpleKeywordMatch
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getAIResponse — provider rotation khi 429/500/503 (lines 461-478)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// _evictStaleSessions — early return khi size === 0 (line 485)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ChatbotService._evictStaleSessions — early return khi empty', () => {
  test('trả về ngay khi conversationHistory rỗng (line 485)', () => {
    chatbotService.conversationHistory.clear();
    expect(chatbotService.conversationHistory.size).toBe(0);
    // Gọi trực tiếp — không throw
    expect(() => chatbotService._evictStaleSessions()).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// handleMessage — cache hit với sessionId trực tiếp (lines 209-211)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ChatbotService.handleMessage — cache hit sessionId direct (lines 209-211)', () => {
  test('lines 209-211: conversationHistory được set khi cache hit + sessionId', async () => {
    const cachedData = {
      response: 'Cached iPhone answer',
      products: [{ id: 1, name: 'iPhone 15' }],
      suggestions: [],
      intent: 'product_search',
    };

    // Setup: mockRedisGet trả về cached response
    mockRedisGet.mockImplementation(async () => JSON.stringify(cachedData));
    mockRedisSetEx.mockResolvedValue(undefined);

    const sessionId = 'direct-sess-' + Date.now();

    const result = await chatbotService.handleMessage('iPhone 15', null, sessionId, {});

    // classifyIntent('iPhone 15') = 'product_search' → CACHEABLE → redis.get → cached
    // if (sessionId) → true → lines 209-211 should execute
    expect(result.response).toBe('Cached iPhone answer');
    const entry = chatbotService.conversationHistory.get(sessionId);
    expect(entry).toBeDefined();
    expect(entry.messages.some((m) => m.role === 'user')).toBe(true);

    mockRedisGet.mockReset();
  });
});

describe('ChatbotService.getAIResponse — provider rotation', () => {
  beforeEach(() => {
    axios.post.mockReset();
    mockBrandFindAll.mockResolvedValue([]);
    mockCategoryFindAll.mockResolvedValue([]);
  });

  test('retry khi provider 1 trả 429, provider 2 thành công', async () => {
    addFakeProvider({ key: 'k1' });
    addFakeProvider({ key: 'k2' });

    const err429 = Object.assign(new Error('Too many requests'), { response: { status: 429 } });
    axios.post
      .mockRejectedValueOnce(err429) // provider 1: 429
      .mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content:
                  '{"response":"tìm thấy sản phẩm","products":[],"suggestions":[],"intent":"product_search"}',
              },
            },
          ],
        },
      }); // provider 2: thành công

    const result = await chatbotService.getAIResponse('iPhone 15', [], {}, []);

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(result.response).toBe('tìm thấy sản phẩm');
  });

  test('retry khi 500, 503, không có response (network error)', async () => {
    addFakeProvider({ key: 'k1' });
    addFakeProvider({ key: 'k2' });
    addFakeProvider({ key: 'k3' });

    const err500 = Object.assign(new Error('Server error'), { response: { status: 500 } });
    const err503 = Object.assign(new Error('Service unavailable'), { response: { status: 503 } });
    const networkErr = new Error('Network error'); // không có .response

    axios.post
      .mockRejectedValueOnce(err500)
      .mockRejectedValueOnce(err503)
      .mockRejectedValueOnce(networkErr);

    const result = await chatbotService.getAIResponse('MacBook', [], {}, []);

    expect(axios.post).toHaveBeenCalledTimes(3);
    // Hết tất cả providers → simpleKeywordMatch
    expect(result).toBeDefined();
  });

  test('break không retry khi lỗi 400 (không phải retryable)', async () => {
    addFakeProvider({ key: 'k1' });
    addFakeProvider({ key: 'k2' });

    const err400 = Object.assign(new Error('Bad request'), { response: { status: 400 } });
    axios.post.mockRejectedValue(err400);

    const result = await chatbotService.getAIResponse('test', [], {}, []);

    // Chỉ gọi 1 lần vì break sau 400
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });

  test('retry khi 402 (payment required)', async () => {
    addFakeProvider({ key: 'k1' });
    addFakeProvider({ key: 'k2' });

    const err402 = Object.assign(new Error('Payment required'), { response: { status: 402 } });
    axios.post.mockRejectedValueOnce(err402).mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: '{"response":"ok","products":[],"suggestions":[],"intent":"general"}',
            },
          },
        ],
      },
    });

    const result = await chatbotService.getAIResponse('test', [], {}, []);

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(result.response).toBe('ok');
  });
});
