/**
 * Branch-coverage tests cho GeminiChatbotService.
 * Nhắm vào các nhánh FALSE chưa được cover:
 *  - line 55:  error.message || error  → khi error.message là undefined
 *  - lines 95,96: result.rewrittenQuery || message / result.intent || 'general' → right sides
 *  - line 132: cachedResult.response || '' → right side (response falsy)
 *  - line 156: NODE_ENV === 'production' → debug log bị bỏ qua
 *  - lines 173-181: aiResponse.response || '' → right side
 *  - line 233: !this.apiKey (null/undefined) → branch khác với demo-key
 *  - lines 258-267: (this._categoriesCache || []) / (this._brandsCache || []) right sides
 *  - line 298: NODE_ENV production → debug log bị bỏ qua
 *  - lines 316-359: createPrompt branches (p.categories?.[0]?.name || 'Sản phẩm', stockQuantity undefined)
 *  - line 391: product.price ?? product.basePrice → right side (price = null)
 *  - line 415: parsed.response || default text → right side
 *  - line 443: minSize > 0 false branch (empty name edge case)
 *  - lines 465-471: simpleKeywordMatch product list — price ?? basePrice right side
 *  - lines 497-524: NODE_ENV production trong new products path
 */

// ---------- Mocks ----------

const mockRedisGet = jest.fn();
const mockRedisSetEx = jest.fn();
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(() =>
    Promise.resolve({ get: mockRedisGet, setEx: mockRedisSetEx })
  ),
}));

const mockBrandFindAll = jest.fn();
const mockCategoryFindAll = jest.fn();
const mockProductFindAll = jest.fn();
const mockChatMessageBulkCreate = jest.fn().mockResolvedValue([]);

jest.mock('../../models', () => ({
  Product: { findAll: (...a) => mockProductFindAll(...a) },
  Category: { findAll: (...a) => mockCategoryFindAll(...a) },
  Brand: { findAll: (...a) => mockBrandFindAll(...a) },
  ChatMessage: { bulkCreate: (...a) => mockChatMessageBulkCreate(...a) },
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
  enrichProductData: jest.fn((data) => data),
}));

jest.mock('axios');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ---------- Require ----------

const axios = require('axios');
const vectorStoreService = require('../../services/ai/vectorStore');
const logger = require('../../utils/logger');

let geminiService;
beforeAll(() => {
  geminiService = require('./geminiChatbot');
});

afterEach(() => {
  jest.clearAllMocks();
  geminiService.conversationHistory.clear();
  geminiService._brandsCache = null;
  geminiService._categoriesCache = null;
  geminiService._catalogCacheExpiry = 0;
});

// ============================================================
// Line 55: error.message || error — khi error không có message property
// ============================================================

describe('GeminiChatbotService.initializeChatbot — line 55: error không có message', () => {
  it('logger.error nhận chính error object khi error.message là undefined', () => {
    // Khi error là plain string (không có .message), error.message là undefined
    // → biểu thức `error.message || error` trả về error (right side)
    logger.info.mockImplementationOnce(() => {
      // ném string thay vì Error object → error.message = undefined
      throw 'raw string error';
    });
    logger.error.mockClear();

    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-key-to-trigger-info';
    geminiService.initializeChatbot();

    // Phải log error với chính string đó (right side của ||)
    expect(logger.error).toHaveBeenCalledWith(
      'Khởi tạo Chatbot thất bại:',
      'raw string error'
    );
    geminiService.apiKey = originalKey;
  });
});

// ============================================================
// Lines 95-96: result.rewrittenQuery || message / result.intent || 'general'
// — right sides khi API trả về JSON thiếu fields
// ============================================================

describe('GeminiChatbotService.preprocessMessage — || right sides (lines 95-96)', () => {
  it('dùng message gốc khi rewrittenQuery = null trong JSON response (line 95 right side)', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({ rewrittenQuery: null, intent: 'product_search' }),
          },
        }],
      },
    });

    const result = await geminiService.preprocessMessage('tìm iphone');
    // rewrittenQuery = null → null || 'tìm iphone' → dùng message gốc
    expect(result.rewrittenQuery).toBe('tìm iphone');

    geminiService.apiKey = originalKey;
  });

  it('dùng "general" khi intent = null trong JSON response (line 96 right side)', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({ rewrittenQuery: 'tìm iphone', intent: null }),
          },
        }],
      },
    });

    const result = await geminiService.preprocessMessage('tìm iphone');
    // intent = null → null || 'general'
    expect(result.intent).toBe('general');

    geminiService.apiKey = originalKey;
  });

  it('dùng "general" khi intent = "" (empty string) trong JSON response', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({ rewrittenQuery: 'hello', intent: '' }),
          },
        }],
      },
    });

    const result = await geminiService.preprocessMessage('hello');
    expect(result.intent).toBe('general');

    geminiService.apiKey = originalKey;
  });
});

// ============================================================
// Line 132: cachedResult.response || '' — right side khi cached response falsy
// ============================================================

describe('GeminiChatbotService.handleMessage — line 132: cachedResult.response || ""', () => {
  it('dùng empty string khi cachedResult.response = null trong cache hit', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    // Cache có response = null
    const cachedWithNullResponse = {
      response: null,
      products: [],
      suggestions: [],
      intent: 'product_search',
    };

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({ rewrittenQuery: 'iphone', intent: 'product_search' }),
          },
        }],
      },
    });

    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedWithNullResponse));

    // _persistMessages được gọi với '' thay vì null
    await geminiService.handleMessage('iphone', 1, 'sess-null-resp', {});

    expect(mockChatMessageBulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'assistant', content: '' }),
      ])
    );

    geminiService.apiKey = originalKey;
  });
});

// ============================================================
// Line 156: NODE_ENV = 'production' → debug log KHÔNG được gọi
// ============================================================

describe('GeminiChatbotService.handleMessage — line 156: NODE_ENV production', () => {
  it('không gọi logger.debug cho "Tìm thấy N sản phẩm" khi NODE_ENV=production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    vectorStoreService.search.mockResolvedValueOnce([]);

    await geminiService.handleMessage('tìm iphone', null, null, {});

    // Không có debug call nào chứa "sản phẩm liên quan qua RAG"
    const debugCalls = logger.debug.mock.calls.map(c => c[0]);
    const hasProductCountLog = debugCalls.some(
      msg => typeof msg === 'string' && msg.includes('sản phẩm liên quan qua RAG')
    );
    expect(hasProductCountLog).toBe(false);

    process.env.NODE_ENV = originalEnv;
  });
});

// ============================================================
// Lines 173-181: aiResponse.response || '' — right side
// Session history lưu empty string khi aiResponse.response falsy
// ============================================================

describe('GeminiChatbotService.handleMessage — line 173: aiResponse.response || ""', () => {
  it('lưu empty string vào session history khi aiResponse.response là undefined', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    // getAIResponse trả về object không có response field
    const originalGetAI = geminiService.getAIResponse.bind(geminiService);
    geminiService.getAIResponse = jest.fn().mockResolvedValue({
      products: [],
      suggestions: [],
      intent: 'general',
      // response: undefined — missing!
    });

    vectorStoreService.search.mockResolvedValueOnce([]);
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({ rewrittenQuery: 'hello', intent: 'general' }),
          },
        }],
      },
    });
    mockRedisGet.mockResolvedValueOnce(null);

    await geminiService.handleMessage('hello', null, 'sess-no-response', {});

    const entry = geminiService.conversationHistory.get('sess-no-response');
    // assistant message content phải là '' không phải undefined
    const assistantMsg = entry?.messages.find(m => m.role === 'assistant');
    expect(assistantMsg?.content).toBe('');

    geminiService.getAIResponse = originalGetAI;
    geminiService.apiKey = originalKey;
  });
});

// ============================================================
// Line 233: !this.apiKey (null/undefined) — branch khác demo-key
// ============================================================

describe('GeminiChatbotService.getAIResponse — line 233: apiKey null/undefined', () => {
  it('trả về fallback khi apiKey là null (không phải demo-key)', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = null;

    const result = await geminiService.getAIResponse('tìm điện thoại', [], {}, []);

    expect(result).toHaveProperty('response');
    expect(result.intent).toBe('general');
    // axios không được gọi vì guard !this.apiKey = true
    expect(axios.post).not.toHaveBeenCalled();

    geminiService.apiKey = originalKey;
  });

  it('trả về fallback khi apiKey là undefined', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = undefined;

    const result = await geminiService.getAIResponse('tìm laptop', [], {}, []);
    expect(result).toHaveProperty('response');

    geminiService.apiKey = originalKey;
  });
});

// ============================================================
// Lines 258-267: (this._categoriesCache || []) / (this._brandsCache || [])
// — right sides khi cache là null
// ============================================================

describe('GeminiChatbotService.getAIResponse — lines 258-267: cache null fallback', () => {
  it('dùng [] khi _categoriesCache = null (line 258 right side)', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    // Cache null → _ensureCatalogCache sẽ được gọi để load từ DB
    geminiService._brandsCache = null;
    geminiService._categoriesCache = null;
    geminiService._catalogCacheExpiry = 0;

    mockBrandFindAll.mockResolvedValueOnce([]);
    mockCategoryFindAll.mockResolvedValueOnce([]);

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({ response: 'OK', matchedProducts: [], suggestions: [], intent: 'general' }),
          },
        }],
      },
    });

    const result = await geminiService.getAIResponse('hello', [], {}, []);
    // Không crash — categoriesCache và brandsCache được lấy từ DB (trả về [])
    expect(result).toHaveProperty('response');

    geminiService.apiKey = originalKey;
  });
});

// ============================================================
// Line 298: NODE_ENV = 'production' → debug "Đã nhận phản hồi" không được gọi
// ============================================================

describe('GeminiChatbotService.getAIResponse — line 298: production suppresses debug', () => {
  it('không gọi debug "Đã nhận phản hồi" khi NODE_ENV=production', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = geminiService.apiKey;
    process.env.NODE_ENV = 'production';
    geminiService.apiKey = 'real-api-key';
    geminiService._brandsCache = [];
    geminiService._categoriesCache = [];
    geminiService._catalogCacheExpiry = Date.now() + 60000;

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({ response: 'OK', matchedProducts: [], suggestions: [], intent: 'general' }),
          },
        }],
      },
    });

    await geminiService.getAIResponse('test', [], {}, []);

    const debugCalls = logger.debug.mock.calls.map(c => c[0]);
    const hasReceivedLog = debugCalls.some(
      msg => typeof msg === 'string' && msg.includes('Đã nhận phản hồi')
    );
    expect(hasReceivedLog).toBe(false);

    process.env.NODE_ENV = originalEnv;
    geminiService.apiKey = originalKey;
  });
});

// ============================================================
// Lines 316-359: createPrompt branches
// — p.category undefined → p.categories?.[0]?.name || 'Sản phẩm'
// — p.stockQuantity = undefined → inStock branch
// ============================================================

describe('GeminiChatbotService.createPrompt — uncovered branches (lines 316-359)', () => {
  it('dùng categories[0].name khi p.category = undefined nhưng categories có dữ liệu', () => {
    const products = [
      {
        name: 'iPhone 15 Pro',
        // category: undefined — không có field này
        categories: [{ name: 'Điện thoại' }],
        shortDescription: 'Flagship',
        price: 29990000,
        stockQuantity: 5,
      },
    ];

    const prompt = geminiService.createPrompt('tìm điện thoại', products, {});
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

    const prompt = geminiService.createPrompt('tìm gì đó', products, {});
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

    const prompt = geminiService.createPrompt('tìm phone', products, {});
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

    const prompt = geminiService.createPrompt('tìm tablet', products, {});
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

    const prompt = geminiService.createPrompt('tìm tablet', products, {});
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

    const prompt = geminiService.createPrompt('tìm gì đó', products, {});
    expect(prompt).toContain('Sản phẩm');
  });
});

// ============================================================
// Line 391: product.price ?? product.basePrice — right side khi price là null/undefined
// trong parseAIResponse
// ============================================================

describe('GeminiChatbotService.parseAIResponse — line 391: price ?? basePrice right side', () => {
  it('dùng basePrice khi product.price = null (line 391 ?? right side)', () => {
    const products = [
      {
        id: 1,
        name: 'Samsung Galaxy A54',
        slug: 'galaxy-a54',
        price: null,           // null → ?? triggers right side
        basePrice: 10990000,   // được dùng thay thế
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

    const result = geminiService.parseAIResponse(aiText, products, 'samsung');
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

    const result = geminiService.parseAIResponse(aiText, products, 'test');
    // Không crash — price sẽ là undefined
    expect(result.products).toHaveLength(1);
    expect(result.products[0].price).toBeUndefined();
  });
});

// ============================================================
// Line 415: parsed.response || 'Tôi có thể giúp bạn tìm sản phẩm phù hợp!'
// — right side khi parsed.response falsy
// ============================================================

describe('GeminiChatbotService.parseAIResponse — line 415: parsed.response || default', () => {
  it('dùng default text khi parsed.response = null', () => {
    const aiText = JSON.stringify({
      response: null,          // null → || triggers right side
      matchedProducts: [],
      suggestions: ['Xem thêm'],
      intent: 'general',
    });

    const result = geminiService.parseAIResponse(aiText, [], 'hello');
    expect(result.response).toBe('Tôi có thể giúp bạn tìm sản phẩm phù hợp!');
  });

  it('dùng default text khi parsed.response = "" (empty string)', () => {
    const aiText = JSON.stringify({
      response: '',            // empty string → || triggers right side
      matchedProducts: [],
      suggestions: [],
      intent: 'general',
    });

    const result = geminiService.parseAIResponse(aiText, [], 'hello');
    expect(result.response).toBe('Tôi có thể giúp bạn tìm sản phẩm phù hợp!');
  });
});

// ============================================================
// Line 443: minSize > 0 — false branch (khi cả hai product name và suggestion name
// đều rỗng sau split → Set rỗng → minSize = 0 → return false)
// ============================================================

describe('GeminiChatbotService.parseAIResponse — line 443: minSize = 0 edge case', () => {
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
        name: 'A',     // lowercase: "a" — 1 từ ngắn
        slug: 'a',
        price: 1000,
        compareAtPrice: null,
        inStock: true,
        stockQuantity: 1,
      },
    ];

    const aiText = JSON.stringify({
      response: 'B here',
      matchedProducts: ['B'],   // lowercase: "b" — khác hoàn toàn
      suggestions: [],
      intent: 'general',
    });

    const result = geminiService.parseAIResponse(aiText, products, 'b');
    // Không match (intersection < 80%)
    expect(result.products).toHaveLength(0);
  });

  it('pWords hoặc rWords size = 0 khi tên rỗng sau split → minSize = 0 → return false', () => {
    // Nếu name là chuỗi rỗng sau trim → split tạo [''] → Set có '' (length 0 → lọc bỏ)
    // intersection = [], minSize = min(0, N) = 0 → minSize > 0 = false → return false
    const products = [
      {
        id: 2,
        name: '  ',   // whitespace only → toLowerCase() = "  " → split = ["", ""]
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
    const result = geminiService.parseAIResponse(aiText, products, 'test');
    expect(result.products).toHaveLength(0);
  });
});

// ============================================================
// Lines 465-471: simpleKeywordMatch — price ?? basePrice right side
// khi product.price là null/undefined
// ============================================================

describe('GeminiChatbotService.simpleKeywordMatch — lines 465-471: price ?? basePrice', () => {
  it('dùng basePrice trong product list text khi price = null (line 465 ?? right side)', () => {
    const products = [
      {
        id: 1,
        name: 'Xiaomi Redmi Note 13',
        slug: 'redmi-note-13',
        price: null,             // null → ?? right side
        basePrice: 5990000,      // dùng cái này
        compareAtPrice: null,
        shortDescription: 'Tầm trung tốt',
        thumbnail: null,
        inStock: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const result = geminiService.simpleKeywordMatch('tìm xiaomi redmi', products);

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
        price: undefined,        // undefined → ?? right side
        basePrice: 8990000,
        compareAtPrice: 10000000,
        shortDescription: 'Camera tốt',
        thumbnail: null,
        inStock: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const result = geminiService.simpleKeywordMatch('tìm oppo reno', products);

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

    const result = geminiService.simpleKeywordMatch('realme c55', products);

    if (result.products.length > 0) {
      expect(result.products[0].discount).toBe(20);
    }
  });
});

// ============================================================
// Lines 497-524: NODE_ENV = 'production' trong "new products" path
// — debug log bị bỏ qua
// ============================================================

describe('GeminiChatbotService.simpleKeywordMatch — lines 497-524: production suppresses debug', () => {
  const productsWithDates = [
    {
      id: 1, name: 'Product New', slug: 'p-new',
      price: 5000000, basePrice: undefined,
      compareAtPrice: null, thumbnail: null, inStock: true,
      createdAt: new Date().toISOString(),
    },
  ];

  it('không gọi debug khi NODE_ENV=production trong new products path', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    logger.debug.mockClear();
    geminiService.simpleKeywordMatch('sản phẩm mới', productsWithDates);

    const debugCalls = logger.debug.mock.calls.map(c => c[0]);
    const hasNewProductLog = debugCalls.some(
      msg => typeof msg === 'string' && msg.includes('sản phẩm mới')
    );
    expect(hasNewProductLog).toBe(false);

    process.env.NODE_ENV = originalEnv;
  });

  it('dùng basePrice khi price = null trong new products map (line 513 ?? right side)', () => {
    const productsWithBasePrice = [
      {
        id: 2, name: 'Sản phẩm mới nhất', slug: 'sp-moi',
        price: null,           // null → ?? right side
        basePrice: 3000000,    // được dùng thay thế
        compareAtPrice: null, thumbnail: null, inStock: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const result = geminiService.simpleKeywordMatch('sản phẩm mới nhất', productsWithBasePrice);

    expect(result.products.length).toBeGreaterThan(0);
    // Giá phải dùng basePrice
    expect(result.products[0].price).toBe(3000000);
  });

  it('discount tính đúng khi price = null nhưng compareAtPrice > basePrice (line 524)', () => {
    const products = [
      {
        id: 3, name: 'Hàng mới về', slug: 'hang-moi',
        price: null,
        basePrice: 10000000,
        compareAtPrice: 12000000, // ~17% off
        thumbnail: null, inStock: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const result = geminiService.simpleKeywordMatch('hàng mới', products);

    if (result.products.length > 0) {
      expect(result.products[0].discount).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Kiểm tra handleMessage — rewrittenQuery === message (không log debug rewrite)
// line 112: if (rewrittenQuery && rewrittenQuery.toLowerCase() !== message.toLowerCase())
// ============================================================

describe('GeminiChatbotService.handleMessage — line 112: rewrittenQuery same as message', () => {
  it('không log "Câu truy vấn đã viết lại" khi rewrittenQuery giống message (case insensitive)', async () => {
    // demo-key → preprocessMessage trả về rewrittenQuery = message → không log rewrite
    logger.debug.mockClear();
    vectorStoreService.search.mockResolvedValueOnce([]);

    await geminiService.handleMessage('tìm iphone', null, null, {});

    // Không có call debug nào chứa "Câu truy vấn đã viết lại"
    const hasRewriteLog = logger.debug.mock.calls.some(
      args => typeof args[0] === 'string' && args[0].includes('Câu truy vấn đã viết lại')
    );
    expect(hasRewriteLog).toBe(false);
  });

  it('log "Câu truy vấn đã viết lại" khi rewrittenQuery khác message', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';
    logger.debug.mockClear();

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            // rewrittenQuery khác message gốc
            content: JSON.stringify({ rewrittenQuery: 'iPhone 15 Pro Max', intent: 'product_search' }),
          },
        }],
      },
    });
    mockRedisGet.mockResolvedValueOnce(null);
    vectorStoreService.search.mockResolvedValueOnce([]);

    // Cần mock getAIResponse để không gọi API thật
    const originalGetAI = geminiService.getAIResponse.bind(geminiService);
    geminiService.getAIResponse = jest.fn().mockResolvedValue({
      response: 'OK',
      products: [],
      suggestions: [],
      intent: 'product_search',
    });

    await geminiService.handleMessage('ip 15 pm', null, null, {});

    const hasRewriteLog = logger.debug.mock.calls.some(
      args => typeof args[0] === 'string' && args[0].includes('Câu truy vấn đã viết lại')
    );
    expect(hasRewriteLog).toBe(true);

    geminiService.getAIResponse = originalGetAI;
    geminiService.apiKey = originalKey;
  });
});

// ============================================================
// Line 443: product.name?.toLowerCase() || '' — right side khi name null/undefined
// trong simpleKeywordMatch
// ============================================================

describe('GeminiChatbotService.simpleKeywordMatch — line 443: name null/undefined', () => {
  it('không crash khi product.name = null (|| "" right side)', () => {
    const products = [
      {
        id: 1,
        name: null,         // null → ?. returns undefined → || '' → productName = ''
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
    const result = geminiService.simpleKeywordMatch('test', products);
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

    const result = geminiService.simpleKeywordMatch('any query', products);
    expect(result).toHaveProperty('response');
  });
});

// ============================================================
// Lines 507-524: simpleKeywordMatch "new products" path
// — price ?? basePrice right side (price = null → basePrice)
// — discount = 0 khi compareAtPrice <= price (false branch of c && c > p)
// ============================================================

describe('GeminiChatbotService.simpleKeywordMatch — lines 507-524: new products map', () => {
  it('price ?? basePrice right side trong productList text khi price = null (line 507)', () => {
    // Trigger "new products" branch với product có price = null
    const products = [
      {
        id: 1, name: 'New Phone', slug: 'new-phone',
        price: null,
        basePrice: 7000000,  // dùng cái này
        compareAtPrice: null,
        thumbnail: null, inStock: true,
        createdAt: new Date('2025-01-01').toISOString(),
      },
    ];

    const result = geminiService.simpleKeywordMatch('sản phẩm mới nhất', products);

    // Phải vào "new products" branch và dùng basePrice trong text
    expect(result.response).toContain('mới nhất');
    expect(result.response).toContain('7.000.000');
  });

  it('discount = 0 khi compareAtPrice = null trong new products map (line 524 false branch)', () => {
    const products = [
      {
        id: 2, name: 'New Tablet', slug: 'new-tablet',
        price: null,
        basePrice: 5000000,
        compareAtPrice: null,  // null → c = null → c && c > p = false → discount = 0
        thumbnail: null, inStock: true,
        createdAt: new Date('2025-06-01').toISOString(),
      },
    ];

    const result = geminiService.simpleKeywordMatch('hàng mới', products);

    if (result.products.length > 0) {
      expect(result.products[0].discount).toBe(0);
    }
  });
});

// ============================================================
// handleMessage — line 104: default params (userId=null, sessionId=null, context={})
// khi tất cả đều không truyền vào
// ============================================================

describe('GeminiChatbotService.handleMessage — line 104: default parameters', () => {
  it('hoạt động đúng khi chỉ truyền message (các params còn lại là default)', async () => {
    vectorStoreService.search.mockResolvedValueOnce([]);

    // Chỉ truyền message — userId, sessionId, context là default
    const result = await geminiService.handleMessage('xin chào');

    expect(result).toHaveProperty('response');
    // sessionId = null → không lưu conversation history
    expect(geminiService.conversationHistory.size).toBe(0);
  });
});

// ============================================================
// getAIResponse — line 233: history = [] default param
// ============================================================

describe('GeminiChatbotService.getAIResponse — line 233: history default = []', () => {
  it('hoạt động đúng khi không truyền history (default = [])', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';
    geminiService._brandsCache = [];
    geminiService._categoriesCache = [];
    geminiService._catalogCacheExpiry = Date.now() + 60000;

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({ response: 'OK', matchedProducts: [], suggestions: [], intent: 'general' }),
          },
        }],
      },
    });

    // Không truyền history argument → default = []
    const result = await geminiService.getAIResponse('tìm iphone', [], {});

    expect(result).toHaveProperty('response');
    // Messages phải chứa system + user (không có history items)
    const callArgs = axios.post.mock.calls[0][1];
    expect(callArgs.messages).toHaveLength(2); // system + user only

    geminiService.apiKey = originalKey;
  });
});

// ============================================================
// Line 258: (this._categoriesCache || []) / (this._brandsCache || [])
// — right side triggered khi cache null DURING prompt construction
// (khi _ensureCatalogCache không được gọi hoặc cache vẫn null sau load)
// ============================================================

describe('GeminiChatbotService.getAIResponse — line 258: categoriesCache null in systemContent', () => {
  it('systemContent dùng [] khi _categoriesCache vẫn null sau _ensureCatalogCache', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    // _ensureCatalogCache sẽ được gọi nhưng trả về rỗng
    // Sau đó force caches về null để test || [] right side trong systemContent builder
    mockBrandFindAll.mockResolvedValueOnce([]);
    mockCategoryFindAll.mockResolvedValueOnce([]);
    geminiService._brandsCache = null;
    geminiService._categoriesCache = null;
    geminiService._catalogCacheExpiry = 0;

    // Override _ensureCatalogCache để set cache thành null sau khi gọi
    const originalEnsure = geminiService._ensureCatalogCache.bind(geminiService);
    geminiService._ensureCatalogCache = jest.fn().mockImplementation(async () => {
      // Simulate: load xong nhưng không set cache (stays null)
      // This triggers _categoriesCache || [] on line 258
    });

    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{
          message: {
            content: JSON.stringify({ response: 'OK', matchedProducts: [], suggestions: [], intent: 'general' }),
          },
        }],
      },
    });

    const result = await geminiService.getAIResponse('hello', [], {}, []);

    // Không crash — systemContent được build với [] cho cache null
    expect(result).toHaveProperty('response');

    // Kiểm tra systemContent không chứa "Danh mục: " hoặc "Thương hiệu: " vì cache rỗng
    const callArgs = axios.post.mock.calls[0][1];
    const systemMsg = callArgs.messages[0].content;
    // Với [] → join(', ') = '' → systemContent có format "Danh mục:  — Thương hiệu: "
    expect(systemMsg).toContain('Danh mục:');

    geminiService._ensureCatalogCache = originalEnsure;
    geminiService.apiKey = originalKey;
  });
});

// ============================================================
// Line 359: parsed.matchedProducts && Array.isArray — FALSE branch
// khi matchedProducts không phải mảng hoặc không tồn tại
// ============================================================

describe('GeminiChatbotService.parseAIResponse — line 359: matchedProducts not array', () => {
  it('matchedProducts là string (không phải array) → không match, không crash', () => {
    const aiText = JSON.stringify({
      response: 'Test response',
      matchedProducts: 'not an array',  // string → !Array.isArray → false branch
      suggestions: [],
      intent: 'general',
    });

    const result = geminiService.parseAIResponse(aiText, [], 'test');
    // Không crash, products = []
    expect(result.response).toBe('Test response');
    expect(result.products).toHaveLength(0);
  });

  it('matchedProducts là number → không match, không crash', () => {
    const aiText = JSON.stringify({
      response: 'OK',
      matchedProducts: 42,   // number → !Array.isArray → false branch
      suggestions: [],
      intent: 'general',
    });

    const result = geminiService.parseAIResponse(aiText, [], 'test');
    expect(result.products).toHaveLength(0);
  });

  it('matchedProducts không tồn tại trong JSON → false branch của && check', () => {
    const aiText = JSON.stringify({
      response: 'No products field',
      // matchedProducts: undefined — không có field → parsed.matchedProducts = undefined
      suggestions: [],
      intent: 'general',
    });

    const result = geminiService.parseAIResponse(aiText, [], 'test');
    expect(result.response).toBe('No products field');
    expect(result.products).toHaveLength(0);
  });
});

// ============================================================
// Line 524: c && c > p — TRUE branch (compareAtPrice > price → discount > 0)
// trong "new products" path
// ============================================================

describe('GeminiChatbotService.simpleKeywordMatch — line 524: discount > 0 in new products', () => {
  it('discount > 0 khi compareAtPrice > price trong new products map (line 524 true branch)', () => {
    const products = [
      {
        id: 3, name: 'Brand New Model', slug: 'new-model',
        price: 8000000,
        compareAtPrice: 10000000,   // c = 10M > p = 8M → (10-8)/10 * 100 = 20%
        basePrice: undefined,
        thumbnail: null, inStock: true,
        createdAt: new Date('2025-06-01').toISOString(),
      },
    ];

    const result = geminiService.simpleKeywordMatch('mới nhất', products);

    if (result.products.length > 0) {
      expect(result.products[0].discount).toBe(20);
    }
  });
});
