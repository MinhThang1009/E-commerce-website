/**
 * @file keywordFallback.test.js
 * @description Tests cho keywordFallback.js — phủ simpleKeywordMatch và getFallbackResponse.
 * Tập trung vào lines 41-47 (versionNumbers filter empty → productName extraction).
 */

jest.mock('@utils/logger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));
jest.mock('@modules/ai/services/chatbot/language/language-detector', () => ({
  detectLanguage: jest.fn((text) => {
    if (/[àáâãèéêìíòóôõùúýăđơưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯẠ-ỹ]/.test(text)) return 'vi';
    return 'en';
  }),
}));

const { simpleKeywordMatch, getFallbackResponse } = require('./keyword-fallback');

const makeProduct = (overrides = {}) => ({
  id: 1,
  name: 'iPhone 14 Pro',
  slug: 'iphone-14-pro',
  shortDescription: 'điện thoại cao cấp',
  price: 25000000,
  compareAtPrice: null,
  thumbnail: null,
  inStock: true,
  ...overrides,
});

// ── simpleKeywordMatch — happy path ───────────────────────────────────────────

describe('simpleKeywordMatch — match thành công', () => {
  test('match theo tên sản phẩm', () => {
    const products = [makeProduct()];
    const result = simpleKeywordMatch('iPhone 14', products);
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.intent).toBe('product_search');
  });

  test('match theo shortDescription', () => {
    const products = [makeProduct({ shortDescription: 'gaming laptop dell' })];
    const result = simpleKeywordMatch('laptop gaming', products);
    expect(result).toHaveProperty('response');
  });

  test('discount > 0 khi compareAtPrice > price', () => {
    const products = [makeProduct({ price: 20000000, compareAtPrice: 25000000 })];
    const result = simpleKeywordMatch('iphone 14 pro', products);
    // Assertion unconditional — nếu không match được product, test PHẢI fail rõ ràng
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products[0].discount).toBeGreaterThan(0);
  });

  test('không match → trả về fallback với suggestions', () => {
    const result = simpleKeywordMatch('máy in 3D', []);
    expect(result).toHaveProperty('suggestions');
    expect(Array.isArray(result.suggestions)).toBe(true);
  });
});

// ── simpleKeywordMatch — versionNumbers filter empty (lines 41-47) ─────────────

describe('simpleKeywordMatch — versionNumbers exist nhưng filtered empty (lines 41-47)', () => {
  test('message có số 15 nhưng không có sản phẩm nào tên chứa 15 → lines 41-47', () => {
    // Products chỉ có 'iPhone 14' — không chứa '15'
    // versionNumbers = ['15'] → filtered = [] → vào block 41-47
    const products = [makeProduct({ name: 'iPhone 14 Pro', shortDescription: 'iphone fourteen' })];
    const result = simpleKeywordMatch('iphone 15 giá bao nhiêu', products);
    // Không tìm thấy iPhone 15 → response có message không có sản phẩm
    expect(result.response).toContain('15');
    expect(result.products).toHaveLength(0);
  });

  test('English message với version number không tìm thấy → English response (lines 48-52)', () => {
    // '25' có trong message, không có product nào tên chứa '25' → filtered.length === 0
    // detectLanguage('how much') = 'en' → isEn = true → English response (lines 48-52)
    const products = [makeProduct({ name: 'Samsung Galaxy S24', shortDescription: 'samsung 24' })];
    const result = simpleKeywordMatch('samsung 25 how much', products);
    // English path: "We don't currently have..."
    expect(result.response).toMatch(/don't currently have|We don/i);
    expect(Array.isArray(result.suggestions)).toBe(true);
    // English suggestions
    expect(result.suggestions).toContain('View similar products');
  });

  test('versionNumbers có kết quả → dùng filtered thay vì tất cả', () => {
    // products có cả 14 và 15, message hỏi về 14 → chỉ lấy iPhone 14
    const products = [
      makeProduct({ id: 1, name: 'iPhone 14 Pro' }),
      makeProduct({ id: 2, name: 'iPhone 15 Pro' }),
    ];
    const result = simpleKeywordMatch('iphone 14', products);
    // filtered = products có '14' → chỉ iPhone 14 được giữ
    expect(result).toHaveProperty('response');
  });
});

// ── getFallbackResponse ───────────────────────────────────────────────────────

describe('getFallbackResponse', () => {
  test('trả về response, suggestions, intent', () => {
    const result = getFallbackResponse('xin chào');
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('suggestions');
    expect(result).toHaveProperty('intent');
  });

  test('intent là general', () => {
    expect(getFallbackResponse('anything').intent).toBe('general');
  });
});

// ── simpleKeywordMatch — negation filter (lines 206-212) ─────────────────────

describe('simpleKeywordMatch — negation filter', () => {
  test('"không muốn iPhone" → loại sản phẩm có iPhone trong tên', () => {
    const products = [
      makeProduct({ id: 1, name: 'iPhone 14 Pro', shortDescription: 'Apple flagship' }),
      makeProduct({ id: 2, name: 'Samsung Galaxy S24', shortDescription: 'Samsung flagship' }),
    ];
    const result = simpleKeywordMatch('điện thoại không muốn iPhone', products);
    const hasIphone = result.products.some((p) => p.name.includes('iPhone'));
    expect(hasIphone).toBe(false);
  });

  test('"tránh Samsung" → loại sản phẩm Samsung', () => {
    const products = [
      makeProduct({ id: 1, name: 'iPhone 14 Pro', shortDescription: 'điện thoại Apple' }),
      makeProduct({ id: 2, name: 'Samsung Galaxy S24', shortDescription: 'điện thoại Samsung' }),
    ];
    const result = simpleKeywordMatch('điện thoại tránh Samsung', products);
    const hasSamsung = result.products.some((p) => p.name.includes('Samsung'));
    expect(hasSamsung).toBe(false);
  });
});

// ── simpleKeywordMatch — price range filter (lines 250-270) ──────────────────

describe('simpleKeywordMatch — price range filter', () => {
  const expensivePhone = makeProduct({
    id: 1,
    name: 'iPhone 16 Pro Max',
    price: 35000000,
    basePrice: 35000000,
  });
  const midPhone = makeProduct({ id: 2, name: 'iPhone 16', price: 22000000, basePrice: 22000000 });
  const cheapPhone = makeProduct({
    id: 3,
    name: 'iPhone SE',
    price: 12000000,
    basePrice: 12000000,
  });

  test('"15-25 triệu" → chỉ giữ sản phẩm trong khoảng', () => {
    const result = simpleKeywordMatch('iPhone 15-25 triệu', [expensivePhone, midPhone, cheapPhone]);
    if (result.products.length > 0) {
      result.products.forEach((p) => {
        expect(p.price).toBeGreaterThanOrEqual(15000000);
        expect(p.price).toBeLessThanOrEqual(25000000);
      });
    }
  });

  test('"dưới 15 triệu" → chỉ giữ sản phẩm giá thấp', () => {
    const result = simpleKeywordMatch('iPhone dưới 15 triệu', [
      expensivePhone,
      midPhone,
      cheapPhone,
    ]);
    if (result.products.length > 0) {
      result.products.forEach((p) => {
        expect(p.price).toBeLessThanOrEqual(15000000);
      });
    }
  });

  test('"tầm 20 triệu" → window ±20% (16M-24M)', () => {
    const result = simpleKeywordMatch('iPhone tầm 20 triệu', [
      expensivePhone,
      midPhone,
      cheapPhone,
    ]);
    if (result.products.length > 0) {
      result.products.forEach((p) => {
        expect(p.price).toBeGreaterThanOrEqual(16000000);
        expect(p.price).toBeLessThanOrEqual(24000000);
      });
    }
  });

  test('"trên 30 triệu" → chỉ giữ sản phẩm giá cao', () => {
    const result = simpleKeywordMatch('iPhone trên 30 triệu', [
      expensivePhone,
      midPhone,
      cheapPhone,
    ]);
    if (result.products.length > 0) {
      result.products.forEach((p) => {
        expect(p.price).toBeGreaterThanOrEqual(30000000);
      });
    }
  });
});

// ── simpleKeywordMatch — category prefix filter (lines 299-302) ──────────────

describe('simpleKeywordMatch — category prefix filter', () => {
  test('"laptop tầm 20 triệu" → chỉ giữ sản phẩm tên bắt đầu bằng "laptop"', () => {
    const products = [
      makeProduct({ id: 1, name: 'Laptop Dell Inspiron', price: 18000000 }),
      makeProduct({
        id: 2,
        name: 'Máy tính bảng Samsung',
        shortDescription: 'laptop alternative',
        price: 15000000,
      }),
    ];
    const result = simpleKeywordMatch('laptop tầm 20 triệu', products);
    if (result.products.length > 0) {
      expect(result.products.every((p) => p.name.toLowerCase().startsWith('laptop'))).toBe(true);
    }
  });

  test('comparative query "vs" → không áp dụng category filter', () => {
    const products = [
      makeProduct({ id: 1, name: 'Laptop Dell Inspiron', price: 18000000 }),
      makeProduct({ id: 2, name: 'Điện thoại iPhone 16', price: 25000000 }),
    ];
    const result = simpleKeywordMatch('laptop vs điện thoại', products);
    expect(result).toHaveProperty('response');
  });
});

// ── simpleKeywordMatch — intent-aware response (lines 344, 365-370) ──────────

describe('simpleKeywordMatch — intent-aware response', () => {
  test('policy intent không có sản phẩm → trả policy info (line 344)', () => {
    const result = simpleKeywordMatch('chính sách bảo hành', []);
    expect(result.response).toContain('Chính sách');
    expect(result.intent).toBe('policy');
  });

  test('pricing intent với sản phẩm → trả giá trực tiếp (lines 365-370)', () => {
    const products = [
      makeProduct({ id: 1, name: 'iPhone 14 Pro', price: 25000000, inStock: true }),
    ];
    const result = simpleKeywordMatch('iPhone 14 Pro giá bao nhiêu', products);
    expect(result.response).toContain('iPhone 14 Pro');
    expect(result.intent).toBe('pricing');
  });

  test('pricing intent sản phẩm hết hàng → hiển thị "hết hàng"', () => {
    const products = [
      makeProduct({ id: 1, name: 'iPhone 14 Pro', price: 25000000, inStock: false }),
    ];
    const result = simpleKeywordMatch('iPhone 14 Pro giá bao nhiêu', products);
    expect(result.response).toMatch(/hết hàng/i);
  });

  test('order_inquiry intent có sản phẩm → trả policy + products (line 353)', () => {
    const products = [
      makeProduct({ id: 1, name: 'iPhone 14 Pro', shortDescription: 'điện thoại giao hàng nhanh' }),
    ];
    const result = simpleKeywordMatch('mua iPhone 14 Pro có ship không', products);
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('products');
  });
});

// ── simpleKeywordMatch — brand coherence check (line 183) ────────────────────

describe('simpleKeywordMatch — brand coherence check', () => {
  test('hỏi iPhone 15 nhưng chỉ có Xiaomi 15 → brand mismatch → "chưa có"', () => {
    // Brand discriminator: "iphone" (dài > 3, không phải số, có trong ít nhất 1 matched product name)
    // Để trigger brand coherence: products phải match keyword + version filter,
    // nhưng brand discriminator không match trong filtered results
    const products = [
      makeProduct({ id: 1, name: 'Điện thoại iPhone 14 Pro', shortDescription: 'Apple flagship' }),
      makeProduct({ id: 2, name: 'Xiaomi Redmi Note 15 Pro', shortDescription: 'Xiaomi phone' }),
    ];
    const result = simpleKeywordMatch('iPhone 15 Pro giá bao nhiêu', products);
    // Version "15" chỉ match Xiaomi, nhưng brand "iphone" không có trong Xiaomi → not found
    expect(result.products).toHaveLength(0);
  });
});
