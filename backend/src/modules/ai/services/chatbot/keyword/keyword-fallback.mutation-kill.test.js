/**
 * keyword-fallback.mutation-kill.test.js
 *
 * Bổ sung cho keyword-fallback.test.js (baseline mutation 57%). Kill mutant assert OUTCOME:
 *   - toProductCard: object đầy đủ + discount + toNum
 *   - scoring: name (+10) > desc (+5) → thứ tự
 *   - version filter + brand coherence + negation + price filter + category prefix
 *   - intent responses EN/VI: generic, pricing, policy, order_inquiry, notFound, new-products, fallback
 */

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { simpleKeywordMatch, getFallbackResponse } = require('./keyword-fallback');

const prod = (o = {}) => ({
  id: 1,
  name: 'iPhone 16 Pro Max',
  slug: 'a',
  price: 30000000,
  basePrice: null,
  compareAtPrice: null,
  thumbnail: 't',
  inStock: true,
  stockQuantity: 5,
  shortDescription: 'dt',
  ...o,
});

beforeEach(() => {
  jest.clearAllMocks();
  ['STORE_NAME', 'STORE_SHIPPING', 'STORE_WARRANTY', 'STORE_RETURN', 'STORE_SUPPORT'].forEach(
    (k) => delete process.env[k],
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// toProductCard
// ══════════════════════════════════════════════════════════════════════════════

describe('product card', () => {
  it('object đầy đủ + discount (compare 36tr, price 30tr → 17%)', () => {
    const out = simpleKeywordMatch('iPhone', [prod({ compareAtPrice: 36000000 })]);
    expect(out.products[0]).toEqual({
      id: 1,
      name: 'iPhone 16 Pro Max',
      slug: 'a',
      price: 30000000,
      compareAtPrice: 36000000,
      thumbnail: 't',
      inStock: true,
      stockQuantity: 5,
      rating: null,
      discount: 17,
    });
  });

  it('discount = 0 khi không có compareAtPrice', () => {
    const out = simpleKeywordMatch('iPhone', [prod()]);
    expect(out.products[0].discount).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Scoring: tên (+10) > mô tả (+5)
// ══════════════════════════════════════════════════════════════════════════════

describe('scoring', () => {
  it('khớp tên xếp trên khớp mô tả', () => {
    const out = simpleKeywordMatch('iphone', [
      { ...prod({ id: 1, name: 'Samsung', shortDescription: 'iphone clone' }) },
      { ...prod({ id: 2, name: 'iPhone 16', shortDescription: 'x' }) },
    ]);
    expect(out.products[0].id).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Generic list (EN + VI)
// ══════════════════════════════════════════════════════════════════════════════

describe('generic list response', () => {
  it('EN (input không dấu) → "I found some products"', () => {
    const out = simpleKeywordMatch('iPhone', [prod()]);
    expect(out.response).toContain('I found some products matching your request');
    expect(out.intent).toBe('product_search');
  });

  it('VI (input có dấu) → "Mình tìm thấy"', () => {
    const out = simpleKeywordMatch('điện thoại tốt', [
      prod({ shortDescription: 'điện thoại cao cấp' }),
    ]);
    expect(out.response).toContain('Mình tìm thấy một số sản phẩm phù hợp');
  });

  it('giới hạn tối đa 3 product card trả về', () => {
    const many = [1, 2, 3, 4, 5].map((i) => prod({ id: i, name: `iPhone 16 model ${i}` }));
    const out = simpleKeywordMatch('iPhone', many);
    expect(out.products).toHaveLength(3);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Pricing (EN + VI)
// ══════════════════════════════════════════════════════════════════════════════

describe('pricing response', () => {
  it('VI: "có giá ... đang còn hàng ạ"', () => {
    const out = simpleKeywordMatch('iPhone 16 Pro Max giá bao nhiêu', [prod()]);
    expect(out.response).toContain('có giá 30.000.000 đ');
    expect(out.response).toContain('đang còn hàng ạ');
    expect(out.intent).toBe('pricing');
  });

  it('EN: "is priced at ... currently in stock"', () => {
    const out = simpleKeywordMatch('iPhone price', [prod()]);
    expect(out.response).toContain('is priced at 30.000.000 ₫');
    expect(out.response).toContain('currently in stock');
  });

  it('hết hàng → suffix "(hiện đang hết hàng)"', () => {
    const out = simpleKeywordMatch('iPhone 16 Pro Max giá bao nhiêu', [prod({ inStock: false })]);
    expect(out.response).toContain('(hiện đang hết hàng)');
  });

  it('"bao nhiêu RAM" KHÔNG phải price query → không format pricing', () => {
    const out = simpleKeywordMatch('iPhone 16 Pro Max bao nhiêu RAM', [prod()]);
    expect(out.response).not.toContain('có giá');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Version filter + brand coherence + notFound
// ══════════════════════════════════════════════════════════════════════════════

describe('version filter & brand coherence', () => {
  // Verifies: "đ" sát số giá phải được strip — "đ\b" cũ là dead pattern (\b ASCII-only)
  it('giá viết liền "15000000đ" KHÔNG bị nhầm thành số model → vẫn trả sản phẩm', () => {
    const out = simpleKeywordMatch('điện thoại 15000000đ có không', [
      prod({ id: 1, name: 'điện thoại iPhone 16' }),
    ]);
    expect(out.products.length).toBeGreaterThan(0);
  });

  // Verifies: số ngân sách KHÔNG kèm đơn vị ("tầm 20") không phải số model
  it('"điện thoại tầm 20" (thiếu "triệu") KHÔNG trả notFound', () => {
    const out = simpleKeywordMatch('điện thoại tầm 20', [
      prod({ id: 1, name: 'điện thoại iPhone 16' }),
    ]);
    expect(out.products.length).toBeGreaterThan(0);
    expect(out.response).not.toContain('🚫');
  });

  it('số model không có sản phẩm → notFound EN', () => {
    const out = simpleKeywordMatch('iPhone 17', [prod()]);
    expect(out.products).toHaveLength(0);
    expect(out.response).toContain("We don't currently have");
    expect(out.intent).toBe('product_search');
  });

  it('brand discriminator không khớp kết quả → notFound (iPhone 15 vs Xiaomi 15)', () => {
    const out = simpleKeywordMatch('iPhone 15', [prod({ id: 9, name: 'Xiaomi Redmi 15' })]);
    expect(out.products).toHaveLength(0);
  });

  it('số model khớp → giữ sản phẩm', () => {
    const out = simpleKeywordMatch('iPhone 16', [prod({ name: 'iPhone 16 Pro Max' })]);
    expect(out.products).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Negation + price + category filters
// ══════════════════════════════════════════════════════════════════════════════

describe('filters', () => {
  it('negation "không muốn Samsung" → loại Samsung', () => {
    const out = simpleKeywordMatch('điện thoại không muốn Samsung', [
      prod({ id: 1, name: 'điện thoại Samsung S25' }),
      prod({ id: 2, name: 'điện thoại iPhone 16' }),
    ]);
    expect(out.products.map((p) => p.id)).toEqual([2]);
  });

  // Verifies [M12]: connective "hay/hoặc" không cắt danh sách phủ định — loại CẢ các brand sau "hay"
  it('negation list "không muốn iPhone, Samsung hay OPPO" → loại cả 3', () => {
    const out = simpleKeywordMatch('điện thoại không muốn iPhone, Samsung hay OPPO', [
      prod({ id: 1, name: 'điện thoại Samsung S25' }),
      prod({ id: 2, name: 'điện thoại iPhone 16' }),
      prod({ id: 3, name: 'điện thoại OPPO Reno 12' }),
      prod({ id: 4, name: 'điện thoại Xiaomi 15' }),
    ]);
    expect(out.products.map((p) => p.id)).toEqual([4]);
  });

  // Verifies [M14]: price null + compareAtPrice có giá trị → discount = 0, không phải 100%
  it('price null + compareAtPrice set → discount 0 (không hiển thị "giảm 100%")', () => {
    const out = simpleKeywordMatch('iPhone', [
      prod({ price: null, basePrice: null, compareAtPrice: 36000000 }),
    ]);
    expect(out.products[0].discount).toBe(0);
  });

  it('price approx "tầm 20 triệu" → giữ trong ±20% (loại 40tr)', () => {
    const out = simpleKeywordMatch('điện thoại tầm 20 triệu', [
      prod({ id: 1, name: 'điện thoại A', price: 20000000 }),
      prod({ id: 2, name: 'điện thoại B', price: 40000000 }),
    ]);
    expect(out.products.map((p) => p.id)).toEqual([1]);
  });

  it('price max "dưới 25 triệu" → loại >25tr', () => {
    const out = simpleKeywordMatch('điện thoại dưới 25 triệu', [
      prod({ id: 1, name: 'điện thoại A', price: 20000000 }),
      prod({ id: 2, name: 'điện thoại B', price: 40000000 }),
    ]);
    expect(out.products.map((p) => p.id)).toEqual([1]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Policy / order_inquiry
// ══════════════════════════════════════════════════════════════════════════════

describe('policy & order_inquiry', () => {
  it('policy không sản phẩm → trả chính sách (VI), không product', () => {
    const out = simpleKeywordMatch('chính sách bảo hành', []);
    expect(out.response).toContain('Chính sách cửa hàng');
    expect(out.intent).toBe('policy');
    expect(out.products).toHaveLength(0);
  });

  it('order_inquiry kèm sản phẩm → policy text + product cards', () => {
    const out = simpleKeywordMatch('giao hàng iPhone không', [
      prod({ name: 'iPhone 16', shortDescription: 'giao hàng nhanh' }),
    ]);
    expect(out.response).toContain('Chính sách cửa hàng');
    expect(out.intent).toBe('order_inquiry');
    expect(out.products.length).toBeGreaterThan(0);
  });

  it('policy dùng env STORE_WARRANTY khi set', () => {
    process.env.STORE_WARRANTY = 'BH 99 tháng';
    const out = simpleKeywordMatch('chính sách bảo hành', []);
    expect(out.response).toContain('BH 99 tháng');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// New products + fallback
// ══════════════════════════════════════════════════════════════════════════════

describe('new products & fallback', () => {
  it('"sản phẩm mới" (không khớp keyword) → sort theo createdAt giảm dần', () => {
    const out = simpleKeywordMatch('sản phẩm mới', [
      prod({ id: 1, name: 'Tablet Alpha', createdAt: '2026-01-01' }),
      prod({ id: 2, name: 'Laptop Beta', createdAt: '2026-06-01' }),
    ]);
    expect(out.response).toContain('sản phẩm mới nhất');
    expect(out.products[0].id).toBe(2);
  });

  it('không khớp gì (input tiếng Việt) → getFallbackResponse (VI)', () => {
    const out = simpleKeywordMatch('chào bạn ơi', []);
    expect(out.response).toContain('nhân viên hỗ trợ');
    expect(out.intent).toBe('general');
  });
});

describe('getFallbackResponse', () => {
  it('VI greeting + storeName mặc định TechStore', () => {
    const out = getFallbackResponse('xin chào bạn');
    expect(out.response).toContain('TechStore');
    expect(out.response).toContain('nhân viên hỗ trợ');
    expect(out.intent).toBe('general');
    expect(out.products).toEqual([]);
  });

  it('EN greeting khi input tiếng Anh', () => {
    const out = getFallbackResponse('hello there friend');
    expect(out.response).toContain('support assistant');
  });

  it('dùng STORE_NAME từ env', () => {
    process.env.STORE_NAME = 'MyShop';
    expect(getFallbackResponse('hello there').response).toContain('MyShop');
  });
});
