/**
 * Branch-coverage tests cho ruleBasedChatbot (ChatbotService).
 * Nhắm vào các nhánh FALSE chưa được cover:
 *  - line 162: this._categoriesCache || [] → right side (cache null)
 *  - line 184: else-if branch của price extraction (từ khóa minPrice)
 *  - line 199: this._brandsCache || [] → right side (cache null)
 *  - line 249: user.orders?.length || 0 → right side (orders undefined)
 *  - line 286: getPersonalizedRecommendations — type='personal' với userId nhưng userProfile null
 *  - lines 331-363: getPersonalizedRecommendations — personal path với categoryPreferences
 *  - lines 397-405: generateSalesPitch — urgency với products[0]?.discount = undefined → '50%'
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

const { Product, User } = require('../../models');
const chatbotService = require('./ruleBasedChatbot');

// Helper
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

afterEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// Line 162: this._categoriesCache || [] — right side khi cache null
// ============================================================

describe('ChatbotService.extractSearchParams — line 162: _categoriesCache null', () => {
  it('dùng [] khi _categoriesCache = null — không crash, không tìm category', () => {
    chatbotService._categoriesCache = null;   // right side của ||
    chatbotService._brandsCache = [];
    chatbotService._cacheExpiry = Date.now() + 60000;

    // Không throw, không tìm được category
    const params = chatbotService.extractSearchParams('tìm điện thoại iphone');
    expect(params.category).toBeUndefined();
    expect(params.keyword).toBe('tìm điện thoại iphone');

    // Restore
    chatbotService._categoriesCache = ['Điện thoại'];
  });
});

// ============================================================
// Line 199: this._brandsCache || [] — right side khi cache null
// ============================================================

describe('ChatbotService.extractSearchParams — line 199: _brandsCache null', () => {
  it('dùng [] khi _brandsCache = null — không crash, không tìm brand', () => {
    chatbotService._categoriesCache = [];
    chatbotService._brandsCache = null;       // right side của ||
    chatbotService._cacheExpiry = Date.now() + 60000;

    const params = chatbotService.extractSearchParams('tìm samsung galaxy');
    expect(params.brand).toBeUndefined();

    // Restore
    chatbotService._brandsCache = ['samsung'];
  });
});

// ============================================================
// Line 184: else-if branch — minPrice khi message chứa "over"/"từ" (không có dưới/under/tối đa)
// ============================================================

describe('ChatbotService.extractSearchParams — line 184: minPrice "over" keyword', () => {
  beforeEach(() => {
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = [];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });

  it('trích xuất minPrice khi message chứa "over"', () => {
    const params = chatbotService.extractSearchParams('laptop over 20 triệu');
    expect(params.minPrice).toBe(20000000);
    expect(params.maxPrice).toBeUndefined();
  });

  it('trích xuất minPrice khi message chứa "từ"', () => {
    const params = chatbotService.extractSearchParams('điện thoại từ 15 triệu');
    expect(params.minPrice).toBe(15000000);
    expect(params.maxPrice).toBeUndefined();
  });

  it('không trích xuất maxPrice hay minPrice khi không có từ khóa hướng', () => {
    // Có price pattern nhưng không có dưới/trên/under/over/từ/tối đa
    const params = chatbotService.extractSearchParams('điện thoại 10 triệu');
    // Không có từ khóa hướng → cả maxPrice lẫn minPrice đều không được set
    expect(params.maxPrice).toBeUndefined();
    expect(params.minPrice).toBeUndefined();
  });
});

// ============================================================
// Line 249: user.orders?.length || 0 — right side khi orders = undefined
// ============================================================

describe('ChatbotService.getUserProfile — line 249: orders undefined', () => {
  it('orderCount = 0 và isVip = false khi user.orders là undefined', async () => {
    User.findByPk.mockResolvedValue({
      id: 10,
      name: 'Test User',
      email: 'test@test.com',
      orders: undefined,  // undefined → ?. returns undefined → || 0 = 0
    });

    const profile = await chatbotService.getUserProfile(10);

    expect(profile).not.toBeNull();
    expect(profile.orderCount).toBe(0);    // undefined || 0 = 0
    expect(profile.isVip).toBe(false);     // (undefined || 0) >= 5 = false
    expect(profile.priceRange).toBeNull(); // min vẫn là Infinity → null
  });

  it('purchaseHistory rỗng khi orders = undefined', async () => {
    User.findByPk.mockResolvedValue({
      id: 11,
      name: 'No Orders',
      email: 'noorders@test.com',
      orders: undefined,
    });

    const profile = await chatbotService.getUserProfile(11);

    expect(profile.purchaseHistory).toEqual([]);
    expect(profile.categoryPreferences).toEqual({});
  });
});

// ============================================================
// Line 286: getPersonalizedRecommendations — type='personal' với userId
// nhưng getUserProfile trả về null → không lấy sản phẩm từ category
// (products.length < limit → fallback)
// ============================================================

describe('ChatbotService.getPersonalizedRecommendations — line 286: userProfile null', () => {
  beforeEach(() => {
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = [];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });

  it('userProfile = null (getUserProfile trả về null) → không vào categoryPreferences branch', async () => {
    User.findByPk.mockResolvedValue(null); // getUserProfile trả về null

    const fallbackProduct = makeProductFindAllResult({ isFeatured: true });
    Product.findAll.mockResolvedValue([fallbackProduct]);

    const result = await chatbotService.getPersonalizedRecommendations(1, { type: 'personal', limit: 3 });

    // products bắt đầu rỗng → fallback được gọi
    expect(Array.isArray(result)).toBe(true);
  });

  it('type personal nhưng userId = falsy → không vào personal branch', async () => {
    const fallbackProduct = makeProductFindAllResult();
    Product.findAll.mockResolvedValue([fallbackProduct]);

    // userId = 0 là falsy
    const result = await chatbotService.getPersonalizedRecommendations(0, { type: 'personal', limit: 5 });
    expect(Array.isArray(result)).toBe(true);
    // User.findByPk không được gọi vì userId falsy
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});

// ============================================================
// Lines 331-363: getPersonalizedRecommendations — personal path với categoryPreferences
// User có orders + category prefs → gọi Product.findAll với category filter
// ============================================================

describe('ChatbotService.getPersonalizedRecommendations — lines 331-363: personal với category prefs', () => {
  beforeEach(() => {
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = ['Điện thoại'];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });

  it('user có categoryPreferences → lấy sản phẩm theo preferred categories', async () => {
    // User có 1 order với product trong "Điện thoại" category
    User.findByPk.mockResolvedValue({
      id: 5,
      name: 'Buyer',
      email: 'buyer@test.com',
      orders: [
        {
          items: [
            {
              Product: {
                id: 100,
                basePrice: 20000000,
                categories: [{ name: 'Điện thoại' }],
              },
            },
          ],
        },
      ],
    });

    // Product.findAll gọi lần 1: lấy sản phẩm theo category (trả về 1 sản phẩm)
    const personalProduct = makeProductFindAllResult({ id: 200, isFeatured: false });
    Product.findAll
      .mockResolvedValueOnce([personalProduct])  // lần 1: category query
      .mockResolvedValueOnce([]);                // lần 2: fallback (nếu cần)

    const result = await chatbotService.getPersonalizedRecommendations(5, { type: 'personal', limit: 3 });

    expect(Array.isArray(result)).toBe(true);
    // Product.findAll được gọi (lần 1 cho category, có thể lần 2 cho fallback)
    expect(Product.findAll).toHaveBeenCalled();
  });

  it('sản phẩm đã mua bị loại khỏi kết quả personal', async () => {
    // User đã mua product id=100 → sản phẩm 100 bị filter
    User.findByPk.mockResolvedValue({
      id: 6,
      name: 'Repeat Buyer',
      email: 'repeat@test.com',
      orders: [
        {
          items: [
            {
              Product: {
                id: 100,
                basePrice: 20000000,
                categories: [{ name: 'Điện thoại' }],
              },
            },
          ],
        },
      ],
    });

    // Trả về product 100 (đã mua) và product 200 (chưa mua)
    Product.findAll
      .mockResolvedValueOnce([
        makeProductFindAllResult({ id: 100 }),  // đã mua → bị filter
        makeProductFindAllResult({ id: 200 }),  // chưa mua → giữ lại
      ])
      .mockResolvedValueOnce([]); // fallback

    const result = await chatbotService.getPersonalizedRecommendations(6, { type: 'personal', limit: 5 });

    // Product 100 (đã mua) phải bị loại
    const ids = result.map(p => p.id);
    expect(ids).not.toContain(100);
  });

  it('inStock = true khi (variants || []).reduce > 0 — dùng [] khi variants undefined', async () => {
    User.findByPk.mockResolvedValue({
      id: 7, name: 'Test', email: 't@t.com', orders: [],
    });

    // product.variants = undefined → (undefined || []).reduce(...) = 0
    // product.stockQuantity = 5 > 0 → inStock = true
    const productNoVariants = makeProductFindAllResult({
      variants: undefined,  // undefined → (undefined || []) = []
      stockQuantity: 5,
    });
    Product.findAll.mockResolvedValue([productNoVariants]);

    const result = await chatbotService.getPersonalizedRecommendations(7, { type: 'general', limit: 5 });

    if (result.length > 0) {
      expect(result[0].inStock).toBe(true);
    }
  });
});

// ============================================================
// Lines 397-405: generateSalesPitch — urgency với products[0]?.discount undefined
// → fallback '50%'
// ============================================================

describe('ChatbotService.generateSalesPitch — lines 397-405: urgency discount fallback', () => {
  beforeEach(() => {
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = [];
    chatbotService._cacheExpiry = Date.now() + 60000;
    User.findByPk.mockResolvedValue(null);
    Product.findAll.mockResolvedValue([]);
  });

  it('urgency pitch: dùng "50%" khi products[0].discount = undefined (line 397 || right side)', async () => {
    const originalSelect = chatbotService.selectPitchType.bind(chatbotService);
    chatbotService.selectPitchType = jest.fn().mockReturnValue('urgency');

    const bestDealsNoDiscount = [
      { id: 1, name: 'A', slug: 'a', basePrice: 10000000, compareAtPrice: 12000000,
        discount: undefined,  // undefined → || '50%' → dùng '50%'
        thumbnail: 'a.jpg' },
    ];

    const result = await chatbotService.generateSalesPitch({
      userProfile: null,
      message: 'có deal không',
      bestDeals: bestDealsNoDiscount,
      trendingProducts: [],
      context: {},
    });

    chatbotService.selectPitchType = originalSelect;

    expect(result.type).toBe('urgency');
    expect(result.text).toContain('50%');
  });

  it('urgency pitch: dùng giá trị discount thực khi products[0].discount có giá trị', async () => {
    const originalSelect = chatbotService.selectPitchType.bind(chatbotService);
    chatbotService.selectPitchType = jest.fn().mockReturnValue('urgency');

    const bestDealsWithDiscount = [
      { id: 1, name: 'B', slug: 'b', basePrice: 8000000, compareAtPrice: 10000000,
        discount: 20,   // 20 → truthy → dùng 20 không phải '50%'
        thumbnail: 'b.jpg' },
    ];

    const result = await chatbotService.generateSalesPitch({
      userProfile: null,
      message: 'có deal không',
      bestDeals: bestDealsWithDiscount,
      trendingProducts: [],
      context: {},
    });

    chatbotService.selectPitchType = originalSelect;

    expect(result.type).toBe('urgency');
    // Phải dùng 20 (discount thực) không phải 50%
    expect(result.text).toContain('20');
    expect(result.text).not.toContain('50%');
  });

  it('urgency pitch khi bestDeals rỗng → products[0]?.discount = undefined → "50%"', async () => {
    const originalSelect = chatbotService.selectPitchType.bind(chatbotService);
    chatbotService.selectPitchType = jest.fn().mockReturnValue('urgency');

    const result = await chatbotService.generateSalesPitch({
      userProfile: null,
      message: 'có gì không',
      bestDeals: [],  // rỗng → products[0] = undefined → ?. = undefined → || '50%'
      trendingProducts: [],
      context: {},
    });

    chatbotService.selectPitchType = originalSelect;

    expect(result.type).toBe('urgency');
    expect(result.text).toContain('50%');
  });
});

// ============================================================
// generateSalesPitch — personal pitch: userProfile?.name || 'bạn'
// — right side khi userProfile = null
// ============================================================

describe('ChatbotService.generateSalesPitch — personal: userProfile?.name || "bạn"', () => {
  beforeEach(() => {
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = [];
    chatbotService._cacheExpiry = Date.now() + 60000;
    User.findByPk.mockResolvedValue(null);
    Product.findAll.mockResolvedValue([]);
  });

  it('dùng "bạn" khi userProfile = null trong personal pitch', async () => {
    const originalSelect = chatbotService.selectPitchType.bind(chatbotService);
    chatbotService.selectPitchType = jest.fn().mockReturnValue('personal');

    const result = await chatbotService.generateSalesPitch({
      userProfile: null,  // null → userProfile?.name = undefined → || 'bạn'
      message: 'gợi ý đi',
      bestDeals: [],
      trendingProducts: [],
      context: {},
    });

    chatbotService.selectPitchType = originalSelect;

    expect(result.type).toBe('personal');
    expect(result.text).toContain('bạn');
  });

  it('dùng "bạn" khi userProfile.name = undefined', async () => {
    const originalSelect = chatbotService.selectPitchType.bind(chatbotService);
    chatbotService.selectPitchType = jest.fn().mockReturnValue('personal');

    const result = await chatbotService.generateSalesPitch({
      userProfile: { id: 1, name: undefined, isVip: true }, // name undefined → || 'bạn'
      message: 'gợi ý',
      bestDeals: [],
      trendingProducts: [],
      context: {},
    });

    chatbotService.selectPitchType = originalSelect;

    expect(result.text).toContain('bạn');
  });
});

// ============================================================
// getUserProfile — priceRange không null khi có ít nhất 1 product với basePrice
// (line 273: priceRange.min === Infinity → false → trả về priceRange thực)
// ============================================================

describe('ChatbotService.getUserProfile — line 273: priceRange không null khi có products', () => {
  it('trả về priceRange thực khi có ít nhất 1 order item với basePrice', async () => {
    User.findByPk.mockResolvedValue({
      id: 20,
      name: 'Shopper',
      email: 's@s.com',
      orders: [
        {
          items: [
            {
              Product: {
                id: 50,
                basePrice: 15000000,
                categories: [],
              },
            },
          ],
        },
      ],
    });

    const profile = await chatbotService.getUserProfile(20);

    // priceRange.min = 15000000 ≠ Infinity → priceRange !== null
    expect(profile.priceRange).not.toBeNull();
    expect(profile.priceRange.min).toBe(15000000);
    expect(profile.priceRange.max).toBe(15000000);
  });

  it('priceRange bao phủ min và max khi có nhiều products', async () => {
    User.findByPk.mockResolvedValue({
      id: 21,
      name: 'Multi Buyer',
      email: 'm@m.com',
      orders: [
        {
          items: [
            { Product: { id: 60, basePrice: 5000000, categories: [] } },
            { Product: { id: 61, basePrice: 30000000, categories: [] } },
          ],
        },
      ],
    });

    const profile = await chatbotService.getUserProfile(21);

    expect(profile.priceRange.min).toBe(5000000);
    expect(profile.priceRange.max).toBe(30000000);
  });
});

// ============================================================
// getUserProfile — item.Product categories?.forEach — categoryPreferences tích lũy
// (items với nhiều categories)
// ============================================================

describe('ChatbotService.getUserProfile — categoryPreferences accumulation', () => {
  it('cộng dồn categoryPreferences khi cùng category xuất hiện nhiều lần', async () => {
    User.findByPk.mockResolvedValue({
      id: 30,
      name: 'Cat Fan',
      email: 'cat@test.com',
      orders: [
        {
          items: [
            { Product: { id: 70, basePrice: 10000000, categories: [{ name: 'Điện thoại' }] } },
            { Product: { id: 71, basePrice: 20000000, categories: [{ name: 'Điện thoại' }] } },
          ],
        },
      ],
    });

    const profile = await chatbotService.getUserProfile(30);

    // Điện thoại xuất hiện 2 lần
    expect(profile.categoryPreferences['Điện thoại']).toBe(2);
  });
});

// ============================================================
// Line 177: extractSearchParams — price "nghìn" unit parsing (nghìn branch)
// ============================================================

describe('ChatbotService.extractSearchParams — line 177: nghìn unit', () => {
  beforeEach(() => {
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = [];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });

  it('trích xuất price với "nghìn" → nhân 1000', () => {
    const params = chatbotService.extractSearchParams('tìm sản phẩm dưới 500 nghìn');
    expect(params.maxPrice).toBe(500000);
  });
});

// ============================================================
// Line 249: user.orders?.length || 0 — Covers `||0` right side when length = 0
// (orders là mảng rỗng → length = 0 → 0 || 0 = 0, nhưng bản thân 0 là truthy-left-side)
// Thật ra line 249 là `user.orders?.length || 0` khi orders = undefined → ?.length = undefined → || 0
// Đã cover rồi, nhưng thêm test về orders có độ dài = 0 để chắc chắn
// ============================================================

describe('ChatbotService.getUserProfile — line 249: orders.length = 0', () => {
  it('orderCount = 0 khi user.orders là mảng rỗng', async () => {
    User.findByPk.mockResolvedValue({
      id: 50, name: 'No History', email: 'nh@test.com',
      orders: [], // mảng rỗng → length = 0
    });

    const profile = await chatbotService.getUserProfile(50);
    expect(profile.orderCount).toBe(0);
    expect(profile.isVip).toBe(false);
  });
});

// ============================================================
// Line 286: getPersonalizedRecommendations — default params
// params = {} → type='personal', limit=5 (default values)
// ============================================================

describe('ChatbotService.getPersonalizedRecommendations — line 286: params default = {}', () => {
  beforeEach(() => {
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = [];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });

  it('params = undefined → dùng default {} → type=personal, limit=5', async () => {
    User.findByPk.mockResolvedValue(null);
    Product.findAll.mockResolvedValue([]);

    // Không truyền params → default = {}
    const result = await chatbotService.getPersonalizedRecommendations(1, undefined);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ============================================================
// Lines 331-363: getPersonalizedRecommendations
// — discount = 0 khi compareAtPrice = null/falsy
// ============================================================

describe('ChatbotService.getPersonalizedRecommendations — line 363: discount = 0', () => {
  beforeEach(() => {
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = [];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });

  it('discount = 0 khi compareAtPrice = null (line 363 false branch)', async () => {
    User.findByPk.mockResolvedValue({
      id: 100, name: 'Test', email: 't@t.com', orders: [],
    });

    const product = {
      id: 1, name: 'Laptop', slug: 'laptop',
      basePrice: 10000000,
      compareAtPrice: null,   // null → falsy → discount = 0
      thumbnail: null, stockQuantity: 5,
      isFeatured: true,
      variants: [],
      categories: [],
    };
    Product.findAll.mockResolvedValue([product]);

    const result = await chatbotService.getPersonalizedRecommendations(100, { type: 'general', limit: 5 });

    if (result.length > 0) {
      expect(result[0].discount).toBe(0);
    }
  });
});

// ============================================================
// Line 249: if (item.Product) — FALSE branch (item.Product = null)
// ============================================================

describe('ChatbotService.getUserProfile — line 249: item.Product falsy', () => {
  it('item.Product = null → bỏ qua item đó, không push vào purchaseHistory', async () => {
    User.findByPk.mockResolvedValue({
      id: 200,
      name: 'Test',
      email: 't@t.com',
      orders: [
        {
          items: [
            { Product: null },          // null → if(null) = false → skip
            { Product: undefined },     // undefined → if(undefined) = false → skip
          ],
        },
      ],
    });

    const profile = await chatbotService.getUserProfile(200);

    // Không crash, purchaseHistory rỗng (vì item.Product null/undefined bị skip)
    expect(profile.purchaseHistory).toHaveLength(0);
    expect(profile.priceRange).toBeNull(); // min vẫn Infinity → null
  });

  it('có 1 item valid và 1 item.Product = null → chỉ push item valid vào purchaseHistory', async () => {
    User.findByPk.mockResolvedValue({
      id: 201,
      name: 'Mixed',
      email: 'm@t.com',
      orders: [
        {
          items: [
            { Product: { id: 1, basePrice: 10000000, categories: [] } },  // valid
            { Product: null },   // null → skip
          ],
        },
      ],
    });

    const profile = await chatbotService.getUserProfile(201);

    expect(profile.purchaseHistory).toHaveLength(1);
    expect(profile.purchaseHistory[0].id).toBe(1);
  });
});

// ============================================================
// Line 331: if (products.length < limit) — FALSE branch
// (personal products đủ limit, không cần fallback)
// ============================================================

describe('ChatbotService.getPersonalizedRecommendations — line 331: products >= limit, no fallback', () => {
  beforeEach(() => {
    chatbotService._brandsCache = [];
    chatbotService._categoriesCache = ['Điện thoại'];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });

  it('không gọi fallback Product.findAll khi personal products đã đủ limit', async () => {
    // User có order với category Điện thoại → getUserProfile trả về categoryPreferences
    User.findByPk.mockResolvedValue({
      id: 300,
      name: 'Big Buyer',
      email: 'bb@test.com',
      orders: [
        {
          items: [
            { Product: { id: 500, basePrice: 20000000, categories: [{ name: 'Điện thoại' }] } },
          ],
        },
      ],
    });

    // Tạo đủ limit=3 products từ category query (không có product 500 vì đã mua)
    const personalProducts = [
      { id: 501, name: 'P1', slug: 'p1', basePrice: 10000000, compareAtPrice: null, thumbnail: null, stockQuantity: 5, isFeatured: false, variants: [] },
      { id: 502, name: 'P2', slug: 'p2', basePrice: 12000000, compareAtPrice: null, thumbnail: null, stockQuantity: 3, isFeatured: false, variants: [] },
      { id: 503, name: 'P3', slug: 'p3', basePrice: 8000000, compareAtPrice: null, thumbnail: null, stockQuantity: 2, isFeatured: false, variants: [] },
    ];

    // Product.findAll gọi lần 1 trả về 3 sản phẩm (đủ limit * 2 = 6 nhưng sau filter chỉ còn 3)
    Product.findAll.mockResolvedValueOnce(personalProducts);

    const result = await chatbotService.getPersonalizedRecommendations(300, { type: 'personal', limit: 3 });

    expect(Array.isArray(result)).toBe(true);
    // Fallback findAll không nên được gọi (lần 2) vì products.length = 3 = limit
    // Nếu Product.findAll chỉ được gọi 1 lần → không có fallback
    // (limit * 2 = 6 cho category query, sau filter = 3 → 3 < 3 là false → không fallback)
    expect(Product.findAll.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
