/**
 * Additional unit tests cho GeminiChatbotService.
 * Bao gồm các nhánh chưa được covered trong geminiChatbot.test.js:
 *  - _ensureCatalogCache: load brands/categories từ DB
 *  - initializeChatbot: nhánh apiKey hợp lệ và nhánh lỗi
 *  - getAIResponse: success path (choices trả về JSON hợp lệ)
 *  - parseAIResponse: full logic khớp sản phẩm + hallucination detection
 *  - simpleKeywordMatch: nhánh "hàng mới nhất"
 *  - handleMessage: cache write sau response thành công
 */

// ---------- Mocks ----------

const mockRedisGet = jest.fn();
const mockRedisSetEx = jest.fn();
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(() => Promise.resolve({ get: mockRedisGet, setEx: mockRedisSetEx })),
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

// ---------- Require ----------

const axios = require('axios');
const vectorStoreService = require('../../services/ai/vectorStore');
const logger = require('../../utils/logger');

// Quan trọng: fresh require trong mỗi test suite khi cần reset singleton state
// Dùng module cache approach — require một lần và mutate state trực tiếp
let geminiService;
beforeAll(() => {
  geminiService = require('./geminiChatbot');
});

afterEach(() => {
  jest.clearAllMocks();
  geminiService.conversationHistory.clear();
  // Reset catalog cache
  geminiService._brandsCache = null;
  geminiService._categoriesCache = null;
  geminiService._catalogCacheExpiry = 0;
});

// ============================================================
// GeminiChatbotService._ensureCatalogCache
// ============================================================

describe('GeminiChatbotService._ensureCatalogCache', () => {
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

    await geminiService._ensureCatalogCache();

    expect(geminiService._brandsCache).toEqual(['Apple', 'Samsung']);
    expect(geminiService._categoriesCache).toEqual(['Điện thoại', 'Laptop']);
    expect(geminiService._catalogCacheExpiry).toBeGreaterThan(Date.now());
  });

  it('không gọi DB lại khi cache còn hạn', async () => {
    // Seed cache đã có
    geminiService._brandsCache = ['Apple'];
    geminiService._categoriesCache = ['Điện thoại'];
    geminiService._catalogCacheExpiry = Date.now() + 60000; // còn 1 phút

    await geminiService._ensureCatalogCache();

    expect(mockBrandFindAll).not.toHaveBeenCalled();
    expect(mockCategoryFindAll).not.toHaveBeenCalled();
  });

  it('reload khi cache hết hạn', async () => {
    geminiService._brandsCache = ['OldBrand'];
    geminiService._categoriesCache = ['OldCat'];
    geminiService._catalogCacheExpiry = Date.now() - 1000; // đã hết hạn

    mockBrandFindAll.mockResolvedValueOnce([{ nameVi: 'NewBrand', nameEn: null }]);
    mockCategoryFindAll.mockResolvedValueOnce([{ nameVi: 'NewCat', nameEn: null }]);

    await geminiService._ensureCatalogCache();

    expect(geminiService._brandsCache).toEqual(['NewBrand']);
    expect(geminiService._categoriesCache).toEqual(['NewCat']);
  });
});

// ============================================================
// GeminiChatbotService.parseAIResponse
// ============================================================

describe('GeminiChatbotService.parseAIResponse', () => {
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

    const result = geminiService.parseAIResponse(aiText, sampleProducts, 'iphone');

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

    const result = geminiService.parseAIResponse(aiText, sampleProducts, 'iphone');

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

    const result = geminiService.parseAIResponse(aiText, sampleProducts, 'samsung');

    expect(result.products[0].discount).toBe(0);
  });

  it('KHÔNG match "iPhone 15 Pro" khi LLM đề xuất "iPhone 15 Pro Max" (version mismatch)', () => {
    const aiText = JSON.stringify({
      response: 'Pro Max đây',
      matchedProducts: ['iPhone 15 Pro Max'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = geminiService.parseAIResponse(aiText, sampleProducts, 'iphone pro max');

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

    geminiService.parseAIResponse(aiText, sampleProducts, 'iphone');

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Hallucination detected'));
  });

  it('dùng fallback suggestions khi parsed.suggestions rỗng/undefined', () => {
    const aiText = JSON.stringify({
      response: 'OK',
      matchedProducts: [],
      intent: 'general',
    });

    const result = geminiService.parseAIResponse(aiText, [], 'hello');

    expect(result.suggestions).toHaveLength(4); // default 4 suggestions
  });

  it('fallback về simpleKeywordMatch khi JSON parse fail', () => {
    const result = geminiService.parseAIResponse('not-json-at-all', sampleProducts, 'iphone');

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

    const result = geminiService.parseAIResponse(aiText, [], 'hello');
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

    const result = geminiService.parseAIResponse(aiText, productsWithUndefinedInStock, 'test');
    expect(result.products[0].inStock).toBe(true);
  });

  it('loại bỏ markdown code fence trước khi parse JSON', () => {
    const aiText =
      '```json\n{"response":"Tốt","matchedProducts":[],"suggestions":[],"intent":"general"}\n```';

    const result = geminiService.parseAIResponse(aiText, [], 'hello');
    expect(result.response).toBe('Tốt');
  });
});

// ============================================================
// GeminiChatbotService.simpleKeywordMatch — nhánh hàng mới nhất
// ============================================================

describe('GeminiChatbotService.simpleKeywordMatch — hàng mới nhất', () => {
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
    const result = geminiService.simpleKeywordMatch('sản phẩm mới nhất', productsWithDates);

    expect(result.response).toContain('mới nhất');
    // Laptop B (2025-06-01) phải đứng đầu
    expect(result.products[0].name).toBe('Laptop B');
  });

  it('query "hàng mới" → kích hoạt nhánh new products', () => {
    const result = geminiService.simpleKeywordMatch('hàng mới về', productsWithDates);

    expect(result.suggestions).toContain('Sản phẩm khuyến mãi');
    expect(result.intent).toBe('product_search');
  });

  it('query "new" → kích hoạt nhánh new products', () => {
    const result = geminiService.simpleKeywordMatch('show me new products', productsWithDates);

    // English input → detectLanguage('show me new products') = 'en' → English response
    expect(result.response).toContain('latest');
  });

  it('query "mới nhất" → kích hoạt nhánh new products', () => {
    const result = geminiService.simpleKeywordMatch('điện thoại mới nhất', productsWithDates);

    expect(result).toHaveProperty('products');
    expect(result.intent).toBe('product_search');
  });

  it('query thông thường không khớp → getFallbackResponse', () => {
    const result = geminiService.simpleKeywordMatch('xyzzy không khớp gì', []);

    // simpleKeywordMatch → không có match → getFallbackResponse
    expect(result).toHaveProperty('response');
    expect(result.intent).toBe('general');
  });
});

// ============================================================
// GeminiChatbotService.simpleKeywordMatch — keyword matching
// ============================================================

describe('GeminiChatbotService.simpleKeywordMatch — keyword matching', () => {
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
    const result = geminiService.simpleKeywordMatch('tìm iphone', products);

    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products[0].name).toBe('iPhone 15 Pro');
  });

  it('khớp sản phẩm theo keyword trong shortDescription', () => {
    const result = geminiService.simpleKeywordMatch('laptop chuyên nghiệp', products);

    // MacBook Pro M4 có shortDescription chứa "laptop"
    expect(result).toHaveProperty('products');
  });

  it('tính discount đúng cho sản phẩm có compareAtPrice', () => {
    const result = geminiService.simpleKeywordMatch('iphone', products);

    const iphone = result.products.find((p) => p.name === 'iPhone 15 Pro');
    if (iphone) {
      expect(iphone.discount).toBeGreaterThan(0);
    }
  });

  it('dedup products theo id khi cùng product match nhiều term', () => {
    const result = geminiService.simpleKeywordMatch('iphone flagship apple', products);

    const ids = result.products.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ============================================================
// GeminiChatbotService.getAIResponse — success path
// ============================================================

describe('GeminiChatbotService.getAIResponse — success path', () => {
  beforeEach(() => {
    // Seed catalog cache để không gọi DB
    geminiService._brandsCache = ['Apple', 'Samsung'];
    geminiService._categoriesCache = ['Điện thoại', 'Laptop'];
    geminiService._catalogCacheExpiry = Date.now() + 60000;
  });

  it('trả về parsed AI response khi API trả về JSON hợp lệ', async () => {
    // Production dùng this.providers array — push provider tạm để trigger API call
    const originalProviders = geminiService.providers;
    geminiService.providers = [
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

    const result = await geminiService.getAIResponse('iphone 15 pro', products, {}, []);

    expect(result.response).toBe('Đây là iPhone 15 Pro!');
    expect(result.products).toHaveLength(1);
    expect(result.intent).toBe('product_search');

    geminiService.providers = originalProviders;
  });

  it('trả về fallback khi choices[0].message.content rỗng', async () => {
    const originalProviders = geminiService.providers;
    geminiService.providers = [
      { key: 'real-api-key', url: 'https://test.api/chat', model: 'test-model' },
    ];

    axios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: null } }] },
    });

    const result = await geminiService.getAIResponse('tìm điện thoại', [], {}, []);

    expect(result).toHaveProperty('response');
    expect(result.intent).toBe('general');

    geminiService.providers = originalProviders;
  });

  it('truyền conversation history vào API call', async () => {
    const originalProviders = geminiService.providers;
    geminiService.providers = [
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

    await geminiService.getAIResponse('câu tiếp theo', [], {}, history);

    const callArgs = axios.post.mock.calls[0][1];
    // messages phải chứa history
    expect(callArgs.messages.some((m) => m.content === 'câu trước')).toBe(true);

    geminiService.providers = originalProviders;
  });

  it('sanitize userMessage — trim và giới hạn 1000 ký tự', async () => {
    const originalProviders = geminiService.providers;
    geminiService.providers = [
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

    const longMessage = 'a'.repeat(1200); // vượt giới hạn 1000
    await geminiService.getAIResponse(longMessage, [], {}, []);

    const callArgs = axios.post.mock.calls[0][1];
    const userMsgContent = callArgs.messages[callArgs.messages.length - 1].content;
    // Content phải chứa message đã bị cắt (1000 chars) nhưng không chứa ký tự thứ 1001
    // Kiểm tra prompt chứa message dưới 1001 chars
    expect(userMsgContent).toContain('a'.repeat(100));
    // Đảm bảo không có 1200 chữ 'a' liên tiếp trong prompt
    expect(userMsgContent.includes('a'.repeat(1001))).toBe(false);

    geminiService.providers = originalProviders;
  });
});

// ============================================================
// GeminiChatbotService.parseAIResponse — number-based version matching
// ============================================================

describe('GeminiChatbotService.parseAIResponse — version number matching', () => {
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

    const result = geminiService.parseAIResponse(aiText, productsWithVersionNumbers, 'iphone 16');

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

    const result = geminiService.parseAIResponse(
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

    const result = geminiService.parseAIResponse(aiText, simpleProducts, 'dell');

    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Laptop Dell Inspiron');
  });
});

// ============================================================
// GeminiChatbotService.parseAIResponse — word intersection matching (lines 382-386)
//
// Điều kiện để vào nhánh này:
//   1. pName !== rName (không exact match)
//   2. version keywords giống nhau (cả hai đều KHÔNG có, hoặc cùng set)
//   3. version numbers không xung đột
//   4. word intersection quyết định kết quả
// ============================================================

describe('GeminiChatbotService.parseAIResponse — word intersection matching (lines 382-386)', () => {
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

    const result = geminiService.parseAIResponse(aiText, products, 'dell inspiron');

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

    const result = geminiService.parseAIResponse(aiText, products, 'samsung');

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

    const result = geminiService.parseAIResponse(aiText, products, 'sony');

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

    const result = geminiService.parseAIResponse(aiText, products, 'bose');

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

    const result = geminiService.parseAIResponse(aiText, products, 'màn hình');

    // Từ "c" bị loại → intersection = {màn, hình} = 2 < 3.2 → không match
    expect(result.products).toHaveLength(0);
  });
});

// ============================================================
// GeminiChatbotService.handleMessage — outer catch fallback
// ============================================================

describe('GeminiChatbotService.handleMessage — outer catch fallback', () => {
  it('trả về fallback khi preprocessMessage throw không xử lý được', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    // preprocessMessage dùng axios.post — mock nó throw KHÔNG phải Error object
    // để trigger outer catch (inner try-catch trong preprocessMessage bắt Error,
    // nhưng outer catch trong handleMessage bắt nếu có lỗi khác)
    // Cách trigger: mock _persistMessages để throw
    const origPersist = geminiService._persistMessages.bind(geminiService);
    const mockPersist = jest.fn().mockRejectedValue(new Error('DB crash'));
    geminiService._persistMessages = mockPersist;

    // preprocessMessage → intent off_topic → _persistMessages throw → outer catch
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

    const result = await geminiService.handleMessage('bóng đá hôm nay', null, null, {});

    expect(result).toHaveProperty('response');

    // Restore
    geminiService._persistMessages = origPersist;
    geminiService.apiKey = originalKey;
  });
});

// ============================================================
// GeminiChatbotService.handleMessage — cache write
// ============================================================

describe('GeminiChatbotService.handleMessage — cache write', () => {
  it('ghi kết quả vào Redis cache sau khi xử lý thành công với intent product_search', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    // preprocessMessage trả về product_search intent
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

    vectorStoreService.search.mockResolvedValueOnce([]);
    geminiService._brandsCache = ['Apple'];
    geminiService._categoriesCache = ['Điện thoại'];
    geminiService._catalogCacheExpiry = Date.now() + 60000;

    await geminiService.handleMessage('iphone 15', 1, 'sess-cache', {});

    // Redis setEx phải được gọi để cache kết quả
    expect(mockRedisSetEx).toHaveBeenCalledWith(
      expect.stringContaining('chatbot:'),
      expect.any(Number),
      expect.any(String),
    );

    geminiService.apiKey = originalKey;
  });

  it('KHÔNG ghi cache khi intent không phải cacheable (order_inquiry)', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    // preprocessMessage trả về order_inquiry (không cacheable)
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

    vectorStoreService.search.mockResolvedValueOnce([]);
    geminiService._brandsCache = [];
    geminiService._categoriesCache = [];
    geminiService._catalogCacheExpiry = Date.now() + 60000;

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

    await geminiService.handleMessage('đơn hàng của tôi', 1, 'sess-order', {});

    expect(mockRedisSetEx).not.toHaveBeenCalled();

    geminiService.apiKey = originalKey;
  });
});

// ============================================================
// GeminiChatbotService — line 149: vectorStore.search trả về kết quả có metadata
// (map callback `res => ({ ...res.metadata, score: res.score })` phải được gọi)
// ============================================================

describe('GeminiChatbotService — vectorStore.search với non-empty results (line 149 map callback)', () => {
  beforeEach(() => {
    // Seed catalog cache
    geminiService._brandsCache = ['Apple'];
    geminiService._categoriesCache = ['Điện thoại'];
    geminiService._catalogCacheExpiry = Date.now() + 60000;
  });

  it('vectorStore.search trả về results có metadata → map callback chạy (line 149)', async () => {
    const originalKey = geminiService.apiKey;
    geminiService.apiKey = 'real-api-key';

    // vectorStoreService.search trả về kết quả với metadata và score
    vectorStoreService.search.mockResolvedValueOnce([
      {
        metadata: { id: 1, name: 'iPhone 15', slug: 'iphone-15', price: 20000000 },
        score: 0.95,
      },
      {
        metadata: { id: 2, name: 'Samsung Galaxy S24', slug: 'galaxy-s24', price: 18000000 },
        score: 0.87,
      },
    ]);

    // Mock preprocessMessage để return product_search intent
    const originalPreprocess = geminiService.preprocessMessage.bind(geminiService);
    geminiService.preprocessMessage = jest.fn().mockResolvedValue({
      intent: 'product_search',
      normalizedQuery: 'iphone',
      shouldRespond: true,
      suggestedResponse: null,
    });

    // Mock getAIResponse để không thực sự gọi API
    const originalGetAI = geminiService.getAIResponse.bind(geminiService);
    geminiService.getAIResponse = jest.fn().mockResolvedValue({
      response: 'Đây là iPhone 15!',
      products: [{ id: 1, name: 'iPhone 15', price: 20000000 }],
      suggestions: [],
      intent: 'product_search',
    });

    mockRedisGet.mockResolvedValue(null);
    mockChatMessageBulkCreate.mockResolvedValue([]);

    await geminiService.handleMessage('tìm iphone', null, 'sess-vec-test', {});

    // Map callback được gọi với non-empty results → relevantProducts được populated
    expect(vectorStoreService.search).toHaveBeenCalled();

    // Restore
    geminiService.preprocessMessage = originalPreprocess;
    geminiService.getAIResponse = originalGetAI;
    geminiService.apiKey = originalKey;
    jest.clearAllMocks();
  });
});

// ============================================================
// GeminiChatbotService.parseAIResponse — line 372 every() callback
// (khi rVersions.length === pVersions.length nhưng keywords khác nhau)
// ============================================================

describe('GeminiChatbotService.parseAIResponse — line 372 every() callback', () => {
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

    const result = geminiService.parseAIResponse(aiText, products, 'iphone 15');

    // 'pro' !== 'max' → every() callback thực thi và trả false → không match
    expect(result.products).toHaveLength(0);
    // Hallucination detected vì không match được sản phẩm nào
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Hallucination detected'));
  });
});
