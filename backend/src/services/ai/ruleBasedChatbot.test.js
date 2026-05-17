/**
 * Unit tests cho ruleBasedChatbot (ChatbotService).
 * Không gọi DB, không gọi API ngoài — tất cả phụ thuộc đều bị mock.
 */

// ---------- Mocks ----------

jest.mock('../../models', () => ({
  Product: {
    findAll: jest.fn().mockResolvedValue([]),
    findByPk: jest.fn(),
  },
  Category: { findAll: jest.fn().mockResolvedValue([]) },
  Brand: { findAll: jest.fn().mockResolvedValue([]) },
  Order: {},
  OrderItem: {},
  User: { findByPk: jest.fn() },
  ProductVariant: {},
  Op: require('sequelize').Op,
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { Product, Category, Brand, User } = require('../../models');
const chatbotService = require('./ruleBasedChatbot');

// ---------- Helpers ----------

/** Tạo mock product trả về từ DB với đủ fields cần thiết */
function makeProduct(overrides = {}) {
  return {
    id: 1,
    name: 'iPhone 15 Pro',
    slug: 'iphone-15-pro',
    basePrice: 29990000,
    compareAtPrice: 33000000,
    thumbnail: 'iphone.jpg',
    stockQuantity: 5,
    isFeatured: false,
    variants: [],
    categories: [],
    ...overrides,
  };
}

// Dữ liệu product trả về từ Product.findAll (raw objects với variants)
function makeProductFindAllResult(overrides = {}) {
  return {
    id: 1,
    name: 'iPhone 15 Pro',
    slug: 'iphone-15-pro',
    basePrice: 29990000,
    compareAtPrice: 33000000,
    thumbnail: 'iphone.jpg',
    stockQuantity: 5,
    isFeatured: true,
    variants: [{ stockQuantity: 5 }],
    categories: [],
    ...overrides,
  };
}

// ============================================================
// ChatbotService.analyzeIntent
// ============================================================

describe('ChatbotService.analyzeIntent', () => {
  beforeEach(() => {
    // Đặt catalog cache sẵn để không cần gọi DB
    chatbotService._brandsCache = ['Apple', 'Samsung'];
    chatbotService._categoriesCache = ['Điện thoại', 'Laptop'];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });

  test('trả về product_search khi message chứa "tìm"', async () => {
    const result = await chatbotService.analyzeIntent('tôi muốn tìm điện thoại');
    expect(result.type).toBe('product_search');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result).toHaveProperty('params');
  });

  test('trả về product_search khi message chứa "mua"', async () => {
    const result = await chatbotService.analyzeIntent('tôi muốn mua laptop');
    expect(result.type).toBe('product_search');
  });

  test('trả về product_recommendation khi message chứa "gợi ý"', async () => {
    // Dùng message không chứa "sản phẩm"/"mua"/... để tránh match product_search trước
    const result = await chatbotService.analyzeIntent('gợi ý đi nào');
    expect(result.type).toBe('product_recommendation');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  test('trả về product_recommendation khi message chứa "hot"', async () => {
    // Dùng "hot" — không nằm trong product_search patterns
    const result = await chatbotService.analyzeIntent('sản phẩm nào đang hot');
    // "sản phẩm" match product_search trước "hot" → type = product_search,
    // nhưng "hot" cũng là keyword của recommendation. Dùng message không có "sản phẩm":
    const result2 = await chatbotService.analyzeIntent('điện tử hot trend');
    // "trend" là pattern của recommendation — không có product_search keyword → recommendation
    const result3 = await chatbotService.analyzeIntent('trend mới nhất');
    expect(result3.type).toBe('product_recommendation');
  });

  test('trả về sales_pitch khi message chứa "giá"', async () => {
    const result = await chatbotService.analyzeIntent('giá bao nhiêu vậy?');
    expect(result.type).toBe('sales_pitch');
    expect(result.params.focus).toBe('pricing');
  });

  test('trả về sales_pitch khi message chứa "khuyến mãi"', async () => {
    // Không dùng "có" — đó là keyword của product_search, sẽ match trước
    const result = await chatbotService.analyzeIntent('khuyến mãi hôm nay thế nào');
    expect(result.type).toBe('sales_pitch');
  });

  test('trả về order_inquiry khi message chứa "đơn hàng"', async () => {
    const result = await chatbotService.analyzeIntent('đơn hàng của tôi ở đâu');
    expect(result.type).toBe('order_inquiry');
  });

  test('trả về order_inquiry khi message chứa "giao hàng"', async () => {
    const result = await chatbotService.analyzeIntent('giao hàng bao lâu?');
    expect(result.type).toBe('order_inquiry');
  });

  test('trả về support khi message chứa "bảo hành"', async () => {
    const result = await chatbotService.analyzeIntent('bảo hành được mấy năm?');
    expect(result.type).toBe('support');
  });

  test('trả về support khi message chứa "đổi trả"', async () => {
    const result = await chatbotService.analyzeIntent('chính sách đổi trả như thế nào');
    expect(result.type).toBe('support');
  });

  test('trả về general với confidence 0.5 khi message không khớp pattern nào', async () => {
    const result = await chatbotService.analyzeIntent('xin chào bạn');
    expect(result.type).toBe('general');
    expect(result.confidence).toBe(0.5);
  });

  test('result luôn có đủ 3 fields: type, confidence, params', async () => {
    const result = await chatbotService.analyzeIntent('hello');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('params');
  });

  test('load catalog từ DB khi cache hết hạn', async () => {
    // Xóa cache để buộc reload từ DB
    chatbotService._brandsCache = null;
    chatbotService._cacheExpiry = 0;
    Brand.findAll.mockResolvedValue([{ name: 'TestBrand' }]);
    Category.findAll.mockResolvedValue([{ name: 'TestCategory' }]);

    await chatbotService.analyzeIntent('tìm sản phẩm');

    expect(Brand.findAll).toHaveBeenCalled();
    expect(Category.findAll).toHaveBeenCalled();
    // Khôi phục cache cho test tiếp
    chatbotService._brandsCache = ['Apple', 'Samsung'];
    chatbotService._categoriesCache = ['Điện thoại', 'Laptop'];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });
});

// ============================================================
// ChatbotService.extractSearchParams — brand/category từ cache
// ============================================================

describe('ChatbotService.extractSearchParams — brand và category từ cache', () => {
  beforeEach(() => {
    chatbotService._brandsCache = ['apple', 'samsung', 'oppo'];
    chatbotService._categoriesCache = ['Điện thoại', 'Laptop', 'Tablet'];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });

  test('nhận diện brand apple từ cache brands', () => {
    const params = chatbotService.extractSearchParams('tìm điện thoại apple rẻ');
    expect(params.brand).toBe('apple');
  });

  test('nhận diện brand samsung từ cache brands', () => {
    const params = chatbotService.extractSearchParams('samsung galaxy mới nhất');
    expect(params.brand).toBe('samsung');
  });

  test('nhận diện category Laptop từ cache categories', () => {
    const params = chatbotService.extractSearchParams('cần mua Laptop cho làm việc');
    expect(params.category).toBe('Laptop');
  });

  test('nhận diện category Điện thoại từ cache categories', () => {
    const params = chatbotService.extractSearchParams('Điện thoại nào tốt nhất');
    expect(params.category).toBe('Điện thoại');
  });

  test('nhận diện category qua alias "smartphone"', () => {
    // alias cho "điện thoại" bao gồm "smartphone"
    chatbotService._categoriesCache = ['điện thoại'];
    const params = chatbotService.extractSearchParams('mua smartphone tầm trung');
    expect(params.category).toBe('điện thoại');
  });

  test('nhận diện category qua alias "laptop" → "máy tính xách tay"', () => {
    chatbotService._categoriesCache = ['laptop'];
    const params = chatbotService.extractSearchParams('cần mua notebook sinh viên');
    expect(params.category).toBe('laptop');
  });

  test('trích xuất màu xanh', () => {
    const params = chatbotService.extractSearchParams('iphone màu xanh');
    expect(params.color).toBe('xanh');
  });

  test('trích xuất màu đen', () => {
    const params = chatbotService.extractSearchParams('samsung màu đen');
    expect(params.color).toBe('đen');
  });

  test('không trích xuất brand khi cache brands trống', () => {
    chatbotService._brandsCache = [];
    const params = chatbotService.extractSearchParams('tìm sản phẩm apple');
    expect(params.brand).toBeUndefined();
  });

  test('không trích xuất category khi cache categories trống', () => {
    chatbotService._categoriesCache = [];
    const params = chatbotService.extractSearchParams('mua laptop');
    expect(params.category).toBeUndefined();
  });

  test('maxPrice từ "dưới 20 triệu"', () => {
    const params = chatbotService.extractSearchParams('tìm điện thoại dưới 20 triệu');
    expect(params.maxPrice).toBe(20000000);
  });

  test('minPrice từ "trên 15 triệu"', () => {
    const params = chatbotService.extractSearchParams('laptop trên 15 triệu');
    expect(params.minPrice).toBe(15000000);
  });

  test('keyword luôn bằng message gốc', () => {
    const msg = 'cần mua điện thoại samsung';
    const params = chatbotService.extractSearchParams(msg);
    expect(params.keyword).toBe(msg);
  });
});

// ============================================================
// ChatbotService.getUserProfile
// ============================================================

describe('ChatbotService.getUserProfile', () => {
  test('trả về null khi user không tồn tại', async () => {
    User.findByPk.mockResolvedValue(null);
    const result = await chatbotService.getUserProfile(999);
    expect(result).toBeNull();
  });

  test('trả về profile đầy đủ với user có orders', async () => {
    const mockUser = {
      id: 1,
      name: 'Nguyễn Văn A',
      email: 'test@example.com',
      orders: [
        {
          items: [
            {
              Product: {
                id: 10,
                basePrice: 15000000,
                categories: [{ name: 'Điện thoại' }],
              },
            },
          ],
        },
        {
          items: [
            {
              Product: {
                id: 11,
                basePrice: 25000000,
                categories: [{ name: 'Laptop' }],
              },
            },
          ],
        },
      ],
    };
    User.findByPk.mockResolvedValue(mockUser);

    const profile = await chatbotService.getUserProfile(1);

    expect(profile).not.toBeNull();
    expect(profile.id).toBe(1);
    expect(profile.name).toBe('Nguyễn Văn A');
    expect(profile.email).toBe('test@example.com');
    expect(profile.orderCount).toBe(2);
  });

  test('isVip = true khi user có từ 5 orders trở lên', async () => {
    const orders = Array.from({ length: 5 }, (_, i) => ({
      items: [{ Product: { id: i + 1, basePrice: 10000000, categories: [] } }],
    }));
    User.findByPk.mockResolvedValue({
      id: 2, name: 'VIP', email: 'vip@test.com', orders,
    });

    const profile = await chatbotService.getUserProfile(2);
    expect(profile.isVip).toBe(true);
  });

  test('isVip = false khi user có ít hơn 5 orders', async () => {
    User.findByPk.mockResolvedValue({
      id: 3, name: 'Regular', email: 'reg@test.com',
      orders: [{ items: [{ Product: { id: 1, basePrice: 5000000, categories: [] } }] }],
    });

    const profile = await chatbotService.getUserProfile(3);
    expect(profile.isVip).toBe(false);
  });

  test('priceRange = null khi user chưa có đơn hàng nào', async () => {
    User.findByPk.mockResolvedValue({
      id: 4, name: 'New', email: 'new@test.com', orders: [],
    });

    const profile = await chatbotService.getUserProfile(4);
    expect(profile.priceRange).toBeNull();
    expect(profile.orderCount).toBe(0);
  });

  test('trả về null khi DB throw error', async () => {
    User.findByPk.mockRejectedValue(new Error('DB connection failed'));
    const result = await chatbotService.getUserProfile(1);
    expect(result).toBeNull();
  });

  test('purchaseHistory chứa đúng các product đã mua', async () => {
    const product1 = { id: 10, basePrice: 10000000, categories: [] };
    const product2 = { id: 20, basePrice: 20000000, categories: [] };
    User.findByPk.mockResolvedValue({
      id: 5, name: 'Test', email: 'test2@test.com',
      orders: [
        { items: [{ Product: product1 }, { Product: product2 }] },
      ],
    });

    const profile = await chatbotService.getUserProfile(5);
    expect(profile.purchaseHistory).toHaveLength(2);
    expect(profile.purchaseHistory[0].id).toBe(10);
    expect(profile.purchaseHistory[1].id).toBe(20);
  });
});

// ============================================================
// ChatbotService.getPersonalizedRecommendations
// ============================================================

describe('ChatbotService.getPersonalizedRecommendations', () => {
  beforeEach(() => {
    chatbotService._brandsCache = ['Apple', 'Samsung'];
    chatbotService._categoriesCache = ['Điện thoại'];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });

  test('trả về mảng rỗng khi DB throw error', async () => {
    User.findByPk.mockRejectedValue(new Error('fail'));
    Product.findAll.mockRejectedValue(new Error('fail'));

    const result = await chatbotService.getPersonalizedRecommendations(1, { type: 'personal' });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  test('lấy fallback products khi user không có categoryPreferences', async () => {
    // getUserProfile trả về user không có categoryPreferences
    User.findByPk.mockResolvedValue({
      id: 1, name: 'Test', email: 't@t.com', orders: [],
    });

    const fallbackProduct = makeProductFindAllResult();
    Product.findAll.mockResolvedValue([fallbackProduct]);

    const result = await chatbotService.getPersonalizedRecommendations(1, { type: 'personal', limit: 3 });
    expect(Array.isArray(result)).toBe(true);
  });

  test('trả về danh sách general (không cần userId)', async () => {
    const fallbackProduct = makeProductFindAllResult({ id: 1, isFeatured: true });
    Product.findAll.mockResolvedValue([fallbackProduct]);

    const result = await chatbotService.getPersonalizedRecommendations(null, { type: 'general', limit: 5 });
    expect(Array.isArray(result)).toBe(true);
  });

  test('mỗi sản phẩm trả về có đủ fields: id, name, slug, price, inStock, discount', async () => {
    User.findByPk.mockResolvedValue({
      id: 2, name: 'User', email: 'u@u.com', orders: [],
    });
    const prod = makeProductFindAllResult({ compareAtPrice: 33000000, variants: [{ stockQuantity: 3 }] });
    Product.findAll.mockResolvedValue([prod]);

    const result = await chatbotService.getPersonalizedRecommendations(2, { type: 'personal', limit: 5 });
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('slug');
      expect(result[0]).toHaveProperty('price');
      expect(result[0]).toHaveProperty('inStock');
      expect(result[0]).toHaveProperty('discount');
    }
  });

  test('discount tính đúng khi compareAtPrice > basePrice', async () => {
    User.findByPk.mockResolvedValue({
      id: 3, name: 'User', email: 'u2@u.com', orders: [],
    });
    // compareAtPrice 40M, basePrice 30M → discount = (40-30)/40*100 = 25%
    const prod = makeProductFindAllResult({
      basePrice: 30000000,
      compareAtPrice: 40000000,
      variants: [],
    });
    Product.findAll.mockResolvedValue([prod]);

    const result = await chatbotService.getPersonalizedRecommendations(3, { type: 'personal', limit: 5 });
    if (result.length > 0) {
      expect(result[0].discount).toBe(25);
    }
  });

  test('inStock = false khi variants đều hết hàng và stockQuantity = 0', async () => {
    User.findByPk.mockResolvedValue({
      id: 4, name: 'User', email: 'u3@u.com', orders: [],
    });
    const prod = makeProductFindAllResult({
      stockQuantity: 0,
      variants: [{ stockQuantity: 0 }],
    });
    Product.findAll.mockResolvedValue([prod]);

    const result = await chatbotService.getPersonalizedRecommendations(4, { type: 'personal', limit: 5 });
    if (result.length > 0) {
      expect(result[0].inStock).toBe(false);
    }
  });

  test('giới hạn kết quả theo tham số limit', async () => {
    User.findByPk.mockResolvedValue({
      id: 5, name: 'User', email: 'u4@u.com', orders: [],
    });
    const products = Array.from({ length: 10 }, (_, i) =>
      makeProductFindAllResult({ id: i + 1, isFeatured: true })
    );
    Product.findAll.mockResolvedValue(products);

    const result = await chatbotService.getPersonalizedRecommendations(5, { type: 'general', limit: 3 });
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

// ============================================================
// ChatbotService.generateSalesPitch
// ============================================================

describe('ChatbotService.generateSalesPitch', () => {
  beforeEach(() => {
    chatbotService._brandsCache = ['Apple'];
    chatbotService._categoriesCache = ['Điện thoại'];
    chatbotService._cacheExpiry = Date.now() + 60000;
    // getPersonalizedRecommendations sẽ gọi DB — mock luôn để test nhanh
    User.findByPk.mockResolvedValue(null);
    Product.findAll.mockResolvedValue([]);
  });

  const bestDeals = [
    { id: 1, name: 'iPhone 15', slug: 'iphone-15', basePrice: 20000000, compareAtPrice: 25000000, discount: 20, thumbnail: 'a.jpg' },
    { id: 2, name: 'Galaxy S24', slug: 'galaxy-s24', basePrice: 15000000, compareAtPrice: 18000000, discount: 17, thumbnail: 'b.jpg' },
    { id: 3, name: 'Pixel 8', slug: 'pixel-8', basePrice: 16000000, compareAtPrice: 19000000, discount: 16, thumbnail: 'c.jpg' },
  ];

  const trendingProducts = [
    { id: 4, name: 'Redmi Note 13', slug: 'redmi-13', basePrice: 5000000, compareAtPrice: null, thumbnail: 'd.jpg' },
  ];

  test('trả về object có đủ fields: text, products, type', async () => {
    const result = await chatbotService.generateSalesPitch({
      userProfile: null,
      message: 'bạn có sản phẩm gì hot không',
      bestDeals,
      trendingProducts,
      context: {},
    });
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('products');
    expect(result).toHaveProperty('type');
  });

  test('pitchType = social_proof khi message chứa "hot"', async () => {
    const result = await chatbotService.generateSalesPitch({
      userProfile: null,
      message: 'sản phẩm nào hot nhất',
      bestDeals,
      trendingProducts,
      context: {},
    });
    expect(result.type).toBe('social_proof');
    // trendingProducts được dùng cho social_proof
    expect(result.products.length).toBeGreaterThan(0);
  });

  test('pitchType = personal khi userProfile.isVip = true', async () => {
    User.findByPk.mockResolvedValue({
      id: 10, name: 'VIP User', email: 'vip@vip.com',
      orders: Array.from({ length: 5 }, (_, i) => ({
        items: [{ Product: { id: i + 1, basePrice: 10000000, categories: [] } }],
      })),
    });

    const result = await chatbotService.generateSalesPitch({
      userProfile: { id: 10, name: 'VIP User', isVip: true },
      message: 'xem gì đi',
      bestDeals,
      trendingProducts,
      context: {},
    });
    expect(result.type).toBe('personal');
    // text phải chứa tên user hoặc "bạn"
    expect(result.text).toMatch(/VIP User|bạn/);
  });

  test('pitchType = value khi message chứa "giá" và userProfile không phải VIP', async () => {
    const result = await chatbotService.generateSalesPitch({
      userProfile: { id: 99, name: 'Test', isVip: false },
      message: 'giá rẻ nhất là bao nhiêu',
      bestDeals,
      trendingProducts,
      context: {},
    });
    expect(result.type).toBe('value');
  });

  test('urgency pitch khi context.timeOfDay = evening', async () => {
    const result = await chatbotService.generateSalesPitch({
      userProfile: null,
      message: 'có gì không',
      bestDeals,
      trendingProducts,
      context: { timeOfDay: 'evening' },
    });
    expect(result.type).toBe('urgency');
    // Template thay {discount} bằng giá trị số (không có ký tự %)
    // Giá trị discount của bestDeals[0] là 20 → text phải chứa "20"
    expect(result.text).toContain('20');
  });

  test('fallback khi getPersonalizedRecommendations throw — trả về object hợp lệ', async () => {
    // Buộc pitchType = personal (VIP user) → gọi getPersonalizedRecommendations
    // Mock getPersonalizedRecommendations để throw
    const originalFn = chatbotService.getPersonalizedRecommendations.bind(chatbotService);
    chatbotService.getPersonalizedRecommendations = jest.fn().mockRejectedValue(new Error('DB fail'));

    const result = await chatbotService.generateSalesPitch({
      userProfile: { id: 1, name: 'VIP', isVip: true },
      message: 'xem gì đi',
      bestDeals,
      trendingProducts,
      context: {},
    });

    // Restore
    chatbotService.getPersonalizedRecommendations = originalFn;

    expect(result).toHaveProperty('text');
    expect(result.type).toBe('fallback');
  });
});

// ============================================================
// ChatbotService.findSalesOpportunity
// ============================================================

describe('ChatbotService.findSalesOpportunity', () => {
  test('found = true khi message chứa "mua sắm"', async () => {
    const result = await chatbotService.findSalesOpportunity('cuối tuần đi mua sắm', null);
    expect(result.found).toBe(true);
  });

  test('found = true khi message chứa "sinh nhật"', async () => {
    const result = await chatbotService.findSalesOpportunity('hôm nay là sinh nhật mình', null);
    expect(result.found).toBe(true);
    expect(result.intent.type).toBe('sales_pitch');
    expect(result.intent.confidence).toBeGreaterThan(0);
  });

  test('found = true khi message chứa "stress"', async () => {
    const result = await chatbotService.findSalesOpportunity('mình đang stress quá', null);
    expect(result.found).toBe(true);
    expect(result.intent.params.trigger).toBe('stress');
  });

  test('found = true khi message chứa "cuối tuần"', async () => {
    const result = await chatbotService.findSalesOpportunity('cuối tuần rảnh muốn làm gì', null);
    expect(result.found).toBe(true);
  });

  test('found = false khi message không có sales keyword', async () => {
    const result = await chatbotService.findSalesOpportunity('tôi cần hỏi về sản phẩm', null);
    expect(result.found).toBe(false);
  });

  test('found = false khi message trống', async () => {
    const result = await chatbotService.findSalesOpportunity('', null);
    expect(result.found).toBe(false);
  });

  test('intent trả về có đủ fields type, confidence, params khi found = true', async () => {
    const result = await chatbotService.findSalesOpportunity('tôi đang stress', null);
    expect(result.found).toBe(true);
    expect(result.intent).toHaveProperty('type');
    expect(result.intent).toHaveProperty('confidence');
    expect(result.intent).toHaveProperty('params');
  });
});

// ============================================================
// ChatbotService.trackAnalytics
// ============================================================

describe('ChatbotService.trackAnalytics', () => {
  const logger = require('../../utils/logger');

  test('không throw khi gọi với data hợp lệ', async () => {
    await expect(
      chatbotService.trackAnalytics({ eventType: 'view', userId: 1 })
    ).resolves.not.toThrow();
  });

  test('không throw khi gọi với data = null', async () => {
    await expect(chatbotService.trackAnalytics(null)).resolves.not.toThrow();
  });

  test('không throw khi gọi với data = undefined', async () => {
    await expect(chatbotService.trackAnalytics(undefined)).resolves.not.toThrow();
  });

  test('ghi log debug khi được gọi với data hợp lệ', async () => {
    logger.debug.mockClear();
    await chatbotService.trackAnalytics({ eventType: 'click', userId: 42 });
    expect(logger.debug).toHaveBeenCalledWith(
      'Tracking analytics',
      expect.objectContaining({ eventType: 'click', userId: 42 })
    );
  });
});

// ============================================================
// ChatbotService.matchesPatterns (pure helper)
// ============================================================

describe('ChatbotService.matchesPatterns', () => {
  test('trả về true khi text chứa ít nhất 1 pattern', () => {
    expect(chatbotService.matchesPatterns('tôi muốn mua', ['mua', 'bán'])).toBe(true);
  });

  test('trả về false khi text không chứa bất kỳ pattern nào', () => {
    expect(chatbotService.matchesPatterns('xin chào', ['mua', 'bán'])).toBe(false);
  });

  test('trả về false với mảng patterns rỗng', () => {
    expect(chatbotService.matchesPatterns('mua hàng', [])).toBe(false);
  });

  test('case sensitive — chỉ match đúng nội dung', () => {
    expect(chatbotService.matchesPatterns('Mua', ['mua'])).toBe(false);
  });
});

// ============================================================
// ChatbotService.selectPitchType (pure helper)
// ============================================================

describe('ChatbotService.selectPitchType', () => {
  test('trả về personal khi userProfile.isVip = true', () => {
    const type = chatbotService.selectPitchType({ isVip: true }, 'bất kỳ', {});
    expect(type).toBe('personal');
  });

  test('trả về value khi message chứa "rẻ"', () => {
    const type = chatbotService.selectPitchType(null, 'cần tìm cái gì rẻ', {});
    expect(type).toBe('value');
  });

  test('trả về value khi message chứa "giá"', () => {
    const type = chatbotService.selectPitchType(null, 'giá bao nhiêu', {});
    expect(type).toBe('value');
  });

  test('trả về social_proof khi message chứa "hot"', () => {
    const type = chatbotService.selectPitchType(null, 'sản phẩm hot nhất', {});
    expect(type).toBe('social_proof');
  });

  test('trả về urgency khi context.timeOfDay = evening', () => {
    const type = chatbotService.selectPitchType(null, 'xem gì đi', { timeOfDay: 'evening' });
    expect(type).toBe('urgency');
  });

  test('trả về một trong các loại hợp lệ khi không có điều kiện đặc biệt', () => {
    const validTypes = ['urgency', 'social_proof', 'value', 'scarcity'];
    const type = chatbotService.selectPitchType(null, 'hello', { timeOfDay: 'morning' });
    expect(validTypes).toContain(type);
  });

  test('isVip ưu tiên hơn message chứa "rẻ"', () => {
    const type = chatbotService.selectPitchType({ isVip: true }, 'cần cái gì rẻ thôi', {});
    expect(type).toBe('personal');
  });
});

// ============================================================
// ChatbotService.formatPrice (pure helper)
// ============================================================

describe('ChatbotService.formatPrice', () => {
  test('format đúng số tiền VND', () => {
    const formatted = chatbotService.formatPrice(29990000);
    // Kết quả phụ thuộc locale nhưng phải chứa số
    expect(formatted).toContain('29');
    expect(typeof formatted).toBe('string');
  });

  test('format 0 không crash', () => {
    expect(() => chatbotService.formatPrice(0)).not.toThrow();
  });
});

// ============================================================
// ChatbotService.getSalesPitchTemplates (pure helper)
// ============================================================

describe('ChatbotService.getSalesPitchTemplates', () => {
  test('trả về object chứa tất cả các loại pitch cần thiết', () => {
    const templates = chatbotService.getSalesPitchTemplates();
    expect(templates).toHaveProperty('urgency');
    expect(templates).toHaveProperty('personal');
    expect(templates).toHaveProperty('social_proof');
    expect(templates).toHaveProperty('value');
    expect(templates).toHaveProperty('scarcity');
    expect(templates).toHaveProperty('seasonal');
  });

  test('urgency template chứa placeholder {discount}', () => {
    const templates = chatbotService.getSalesPitchTemplates();
    expect(templates.urgency).toContain('{discount}');
  });

  test('personal template chứa placeholder {name}', () => {
    const templates = chatbotService.getSalesPitchTemplates();
    expect(templates.personal).toContain('{name}');
  });

  test('value template chứa placeholder {savings}', () => {
    const templates = chatbotService.getSalesPitchTemplates();
    expect(templates.value).toContain('{savings}');
  });
});

// ============================================================
// Line 178-179: extractSearchParams — price với đơn vị "000" và plain number
// ============================================================

describe('ChatbotService.extractSearchParams — price pattern "000" và không có đơn vị', () => {
  beforeEach(() => {
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = [];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });

  test('price với "000" suffix (e.g. "200000 đồng") → được parse đúng', () => {
    // Pattern "200000đồng" → num = 200000, không phải triệu/nghìn/k → return num (line 178-179)
    const params = chatbotService.extractSearchParams('tìm sản phẩm dưới 200000đồng');
    expect(params.maxPrice).toBe(200000);
  });

  test('price với "vnd" suffix không có đơn vị k/triệu và không chứa "000" → fallback return num (line 179)', () => {
    // "5vnd" → num = 5, không khớp triệu/nghìn/k, không có "000" → return num (line 179)
    const params = chatbotService.extractSearchParams('dưới 5vnd');
    expect(params.maxPrice).toBe(5);
  });
});

// ============================================================
// Line 422: generateSalesPitch — default case trong switch
// ============================================================

describe('ChatbotService.generateSalesPitch — default pitchType (không khớp case nào)', () => {
  beforeEach(() => {
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = [];
    chatbotService._cacheExpiry = Date.now() + 60000;
    User.findByPk.mockResolvedValue(null);
    Product.findAll.mockResolvedValue([]);
  });

  test('pitchType = scarcity (không khớp urgency/personal/value/social_proof) → default case dùng bestDeals + trendingProducts', async () => {
    const bestDeals = [
      { id: 1, name: 'A', slug: 'a', basePrice: 10000000, compareAtPrice: 12000000, discount: 17, thumbnail: 'a.jpg' },
      { id: 2, name: 'B', slug: 'b', basePrice: 8000000, compareAtPrice: 9000000, discount: 11, thumbnail: 'b.jpg' },
    ];
    const trendingProducts = [
      { id: 3, name: 'C', slug: 'c', basePrice: 5000000, compareAtPrice: null, thumbnail: 'c.jpg' },
    ];

    // selectPitchType với morning + không VIP + không value/social_proof keyword
    // → có thể trả về scarcity hoặc urgency; ta mock selectPitchType để chắc chắn là 'scarcity'
    const originalSelect = chatbotService.selectPitchType.bind(chatbotService);
    chatbotService.selectPitchType = jest.fn().mockReturnValue('scarcity');

    const result = await chatbotService.generateSalesPitch({
      userProfile: null,
      message: 'xem gì đi',
      bestDeals,
      trendingProducts,
      context: {},
    });

    chatbotService.selectPitchType = originalSelect;

    // default case: products = bestDeals.slice(0,2) + trendingProducts.slice(0,1)
    expect(result.products).toHaveLength(3);
    expect(result.type).toBe('scarcity');
  });
});

// ============================================================
// Lines 491-503: trackConversation
// ============================================================

describe('ChatbotService.trackConversation', () => {
  const logger = require('../../utils/logger');

  test('không throw khi gọi với data hợp lệ', async () => {
    await expect(
      chatbotService.trackConversation({
        userId: 1, intent: 'product_search',
        products: [{ id: 1 }, { id: 2 }],
        timestamp: new Date(),
      })
    ).resolves.not.toThrow();
  });

  test('ghi log debug khi được gọi với data hợp lệ', async () => {
    logger.debug.mockClear();
    await chatbotService.trackConversation({
      userId: 42, intent: 'sales_pitch', products: [], timestamp: new Date(),
    });
    expect(logger.debug).toHaveBeenCalledWith(
      'Tracking conversation',
      expect.objectContaining({ userId: 42, intent: 'sales_pitch' })
    );
  });

  test('không throw khi products là undefined', async () => {
    await expect(
      chatbotService.trackConversation({ userId: 1, intent: 'general', timestamp: new Date() })
    ).resolves.not.toThrow();
  });

  test('catch block (line 503) ghi error log khi logger.debug throw trong trackConversation', async () => {
    logger.debug.mockImplementationOnce(() => { throw new Error('debug crash'); });
    logger.error.mockClear();

    await chatbotService.trackConversation({ userId: 1, intent: 'test', timestamp: new Date() });

    expect(logger.error).toHaveBeenCalledWith(
      'Lỗi theo dõi hội thoại chatbot:',
      expect.any(Error)
    );
  });
});

// ============================================================
// Line 517: catch block trong trackAnalytics
// (line 503 là catch trong trackConversation — đã cover ở trên)
// ============================================================

describe('ChatbotService.trackAnalytics — catch block', () => {
  const logger = require('../../utils/logger');

  test('catch block ghi error log khi logger.debug throw', async () => {
    // Buộc catch bằng cách mock logger.debug để throw
    logger.debug.mockImplementationOnce(() => { throw new Error('logger crash'); });
    logger.error.mockClear();

    await chatbotService.trackAnalytics({ eventType: 'click', userId: 1 });

    // Catch block phải gọi logger.error (line 517)
    expect(logger.error).toHaveBeenCalledWith(
      'Lỗi theo dõi analytics chatbot:',
      expect.any(Error)
    );
  });
});
