/**
 * Unit test cho các pure function của chatbot pipeline.
 * Không gọi DB, không gọi API ngoài — tất cả phụ thuộc đều bị mock.
 *
 * Bao gồm:
 *  - GeminiChatbotService.simpleKeywordMatch  (price consistency: vector store vs DB)
 *  - GeminiChatbotService.parseAIResponse     (discount calculation, 3 trường hợp)
 *  - ChatbotService.extractSearchParams       (không extract số model thành giá)
 *  - VectorStoreService.cosineSimilarity      (NaN guard, edge cases)
 */

// ---------- Mocks (Jest hoist các lệnh này lên trước require) ----------

jest.mock('../../models', () => ({
  Product: {
    findAll: jest.fn().mockResolvedValue([]),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  Category: { findAll: jest.fn().mockResolvedValue([]) },
  Brand: { findAll: jest.fn().mockResolvedValue([]) },
  ChatMessage: {},
  Order: {},
  OrderItem: {},
  User: {},
  sequelize: {},
  Op: {},
}));

// Mock vectorStore để tránh đọc vectorDb.json khi load geminiChatbot.js
jest.mock('../../services/ai/vectorStore', () => ({
  items: [],
  loadPromise: Promise.resolve(),
  search: jest.fn().mockResolvedValue([]),
  addProduct: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  detectLanguage: jest.fn((text) => {
    if (/[àáâãèéêìíòóôõùúýăđơưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯẠ-ỹ]/.test(text)) return 'vi';
    return 'en';
  }),
}));

// Mock axios để tránh gọi OpenRouter API
jest.mock('axios');

// Mock embedding services — chỉ cần khi test cosineSimilarity qua jest.requireActual
jest.mock('../../services/ai/embedding', () => ({
  getEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0)),
  isAvailable: jest.fn().mockReturnValue(false),
}));

jest.mock('../../services/ai/viEmbedding', () => ({
  getEmbedding: jest.fn().mockResolvedValue(new Array(1024).fill(0)),
  isAvailable: jest.fn().mockReturnValue(false),
}));

// ---------- Require sau khi mock đã đăng ký ----------

const geminiService = require('../../services/ai/geminiChatbot');
const chatbotService = require('../../services/ai/ruleBasedChatbot');

// ============================================================
// GeminiChatbotService.simpleKeywordMatch
// ============================================================

describe('GeminiChatbotService.simpleKeywordMatch', () => {
  // Sản phẩm mẫu: giả lập dữ liệu từ vector store (có price, không có basePrice)
  const productFromVectorStore = {
    id: 1,
    name: 'iPhone 15 Pro',
    shortDescription: 'flagship apple',
    price: 29990000,
    basePrice: undefined,
    compareAtPrice: null,
    thumbnail: 'iphone.jpg',
    inStock: true,
    stockQuantity: 10,
    slug: 'iphone-15-pro',
  };

  const productFromDB = {
    id: 2,
    name: 'Samsung Galaxy S24',
    shortDescription: 'samsung flagship android',
    price: undefined,
    basePrice: 19990000,
    compareAtPrice: null,
    thumbnail: 'samsung.jpg',
    inStock: true,
    stockQuantity: 5,
    slug: 'samsung-galaxy-s24',
  };

  const productWithDiscount = {
    id: 3,
    name: 'MacBook Pro 14',
    shortDescription: 'apple laptop m3',
    price: 45000000,
    basePrice: undefined,
    compareAtPrice: 50000000,
    thumbnail: 'macbook.jpg',
    inStock: true,
    stockQuantity: 3,
    slug: 'macbook-pro-14',
  };

  test('dùng price (vector store) khi có field price', () => {
    const result = geminiService.simpleKeywordMatch('iphone', [productFromVectorStore]);
    expect(result.products).toHaveLength(1);
    // price phải là 29990000 (từ .price), không phải undefined
    expect(result.products[0].price).toBe(29990000);
  });

  test('dùng basePrice (DB fallback) khi price undefined', () => {
    const result = geminiService.simpleKeywordMatch('samsung', [productFromDB]);
    expect(result.products).toHaveLength(1);
    // price phải là 19990000 (fallback sang .basePrice)
    expect(result.products[0].price).toBe(19990000);
  });

  test('discount = 0 khi không có compareAtPrice', () => {
    const result = geminiService.simpleKeywordMatch('iphone', [productFromVectorStore]);
    expect(result.products[0].discount).toBe(0);
  });

  test('discount tính đúng khi compareAtPrice > price', () => {
    // (50M - 45M) / 50M * 100 = 10%
    const result = geminiService.simpleKeywordMatch('macbook', [productWithDiscount]);
    expect(result.products[0].discount).toBe(10);
  });

  test('trả về fallback response khi không có sản phẩm khớp', () => {
    const result = geminiService.simpleKeywordMatch('xyz không tồn tại abc', [productFromDB]);
    // Không có matchedProducts — rơi vào nhánh fallback
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('suggestions');
    expect(result).toHaveProperty('intent');
  });
});

// ============================================================
// GeminiChatbotService.parseAIResponse
// ============================================================

describe('GeminiChatbotService.parseAIResponse', () => {
  const makeAiText = (matchedProducts = ['iPhone 15 Pro']) =>
    JSON.stringify({
      response: 'Đây là sản phẩm phù hợp cho bạn!',
      matchedProducts,
      suggestions: ['Xem thêm'],
      intent: 'product_search',
    });

  test('discount = N% khi compareAtPrice > price', () => {
    const products = [
      {
        id: 1,
        name: 'iPhone 15 Pro',
        slug: 'iphone-15-pro',
        price: 29990000,
        basePrice: undefined,
        compareAtPrice: 33000000,
        thumbnail: 'a.jpg',
        inStock: true,
        stockQuantity: 5,
      },
    ];
    // (33M - 29.99M) / 33M * 100 ≈ 9.12 → Math.round → 9
    const result = geminiService.parseAIResponse(makeAiText(), products, 'iphone 15 pro');
    expect(result.products[0].discount).toBe(9);
  });

  test('discount = 0 khi compareAtPrice <= price', () => {
    const products = [
      {
        id: 1,
        name: 'iPhone 15 Pro',
        slug: 'iphone-15-pro',
        price: 29990000,
        compareAtPrice: 20000000, // nhỏ hơn price — không hợp lệ
        thumbnail: 'a.jpg',
        inStock: true,
        stockQuantity: 5,
      },
    ];
    const result = geminiService.parseAIResponse(makeAiText(), products, 'iphone 15 pro');
    expect(result.products[0].discount).toBe(0);
  });

  test('discount = 0 khi compareAtPrice = null', () => {
    const products = [
      {
        id: 1,
        name: 'iPhone 15 Pro',
        slug: 'iphone-15-pro',
        price: 29990000,
        compareAtPrice: null,
        thumbnail: 'a.jpg',
        inStock: true,
        stockQuantity: 5,
      },
    ];
    const result = geminiService.parseAIResponse(makeAiText(), products, 'iphone 15 pro');
    expect(result.products[0].discount).toBe(0);
  });

  test('dùng basePrice fallback khi price undefined (nguồn DB)', () => {
    const products = [
      {
        id: 1,
        name: 'iPhone 15 Pro',
        slug: 'iphone-15-pro',
        price: undefined,
        basePrice: 28000000,
        compareAtPrice: 31000000,
        thumbnail: 'a.jpg',
        inStock: true,
        stockQuantity: 5,
      },
    ];
    // (31M - 28M) / 31M * 100 ≈ 9.67 → Math.round → 10
    const result = geminiService.parseAIResponse(makeAiText(), products, 'iphone 15 pro');
    expect(result.products[0].price).toBe(28000000);
    expect(result.products[0].discount).toBe(10);
  });

  test('trả về simpleKeywordMatch fallback khi AI text không phải JSON hợp lệ', () => {
    const products = [
      {
        id: 1,
        name: 'iPhone 15 Pro',
        slug: 'iphone-15-pro',
        shortDescription: 'flagship',
        price: 29990000,
        compareAtPrice: null,
        thumbnail: 'a.jpg',
        inStock: true,
        stockQuantity: 5,
      },
    ];
    // Chuỗi không phải JSON → JSON.parse throw → rơi vào simpleKeywordMatch
    const result = geminiService.parseAIResponse('bố cục bị lỗi', products, 'iphone 15 pro');
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('suggestions');
  });
});

// ============================================================
// ChatbotService.extractSearchParams
// ============================================================

describe('ChatbotService.extractSearchParams', () => {
  // Đảm bảo cache trống — không phụ thuộc DB trong unit test
  beforeEach(() => {
    chatbotService._categoriesCache = [];
    chatbotService._brandsCache = [];
  });

  test('trích xuất maxPrice từ "dưới 30 triệu" — không extract "15" trong "iphone 15" thành giá', () => {
    const params = chatbotService.extractSearchParams('iphone 15 dưới 30 triệu');
    expect(params.maxPrice).toBe(30000000);
    expect(params.minPrice).toBeUndefined();
    // Số "15" không có đơn vị tiền tệ → không được extract thành giá
  });

  test('không extract số model "s24" thành giá khi không có đơn vị', () => {
    const params = chatbotService.extractSearchParams('samsung galaxy s24');
    expect(params.maxPrice).toBeUndefined();
    expect(params.minPrice).toBeUndefined();
  });

  test('trích xuất maxPrice từ "dưới 20tr"', () => {
    const params = chatbotService.extractSearchParams('laptop dưới 20tr');
    expect(params.maxPrice).toBe(20000000);
  });

  test('trích xuất minPrice từ "trên 10 triệu"', () => {
    const params = chatbotService.extractSearchParams('điện thoại trên 10 triệu');
    expect(params.minPrice).toBe(10000000);
    expect(params.maxPrice).toBeUndefined();
  });

  test('keyword luôn được gán bằng message gốc', () => {
    const msg = 'tai nghe bluetooth gaming';
    const params = chatbotService.extractSearchParams(msg);
    expect(params.keyword).toBe(msg);
  });
});

// ============================================================
// VectorStoreService.cosineSimilarity
// ============================================================

describe('VectorStoreService.cosineSimilarity', () => {
  // Dùng jest.requireActual để test hàm thực tế, không phải mock
  // load() của vectorStore chạy async và không ảnh hưởng đến test này
  let vs;

  beforeAll(() => {
    vs = jest.requireActual('../../services/ai/vectorStore');
  });

  afterAll(async () => {
    // Đợi load() hoàn thành để tránh warning "Cannot log after tests are done"
    if (vs && vs.loadPromise) await vs.loadPromise;
  });

  test('null v1 → trả 0 (không crash)', () => {
    expect(vs.cosineSimilarity(null, [1, 2, 3])).toBe(0);
  });

  test('null v2 → trả 0 (không crash)', () => {
    expect(vs.cosineSimilarity([1, 2, 3], null)).toBe(0);
  });

  test('độ dài hai vector khác nhau → trả 0', () => {
    expect(vs.cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  test('zero vector → trả 0, không trả NaN', () => {
    const result = vs.cosineSimilarity([0, 0, 0], [1, 2, 3]);
    expect(result).toBe(0);
    // Quan trọng: magnitude = 0 → phép chia → phải guard, không để NaN ra ngoài
    expect(Number.isFinite(result)).toBe(true);
  });

  test('vector giống nhau → cosine similarity = 1', () => {
    const v = [1, 2, 3];
    const result = vs.cosineSimilarity(v, v);
    expect(result).toBeCloseTo(1.0, 5);
  });

  test('vector vuông góc → cosine similarity = 0', () => {
    // [1, 0] và [0, 1] vuông góc với nhau
    const result = vs.cosineSimilarity([1, 0], [0, 1]);
    expect(result).toBeCloseTo(0, 5);
  });

  test('vector có NaN element → kết quả vẫn là số hữu hạn, không NaN', () => {
    // Phòng trường hợp embedding API trả về NaN trong vector
    const result = vs.cosineSimilarity([NaN, 1, 2], [1, 2, 3]);
    expect(Number.isFinite(result)).toBe(true);
  });
});
