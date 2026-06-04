/**
 * response-parser.mutation-kill.test.js
 *
 * Bổ sung cho response-parser.test.js (baseline mutation 56%). Kill mutant assert OUTCOME:
 *   - extractJSON: markdown strip / direct / substring / null
 *   - parseLLMOutput matching: exact, version-keyword, number, word-overlap ≥80%, hallucination
 *   - product object đầy đủ (toNum, discount, inStock default), dedup theo id
 *   - defaults (response/suggestions/intent), fallback khi parse fail
 *   - extractProductsFromText: bổ sung SP nhắc trong response, negation loại, category prefix
 */

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { parseLLMOutput, extractJSON } = require('./response-parser');
const logger = require('@utils/logger');

const makeProduct = (o = {}) => ({
  id: 1,
  name: 'iPhone 16 Pro Max',
  slug: 'ip16pm',
  price: '30000000.00',
  basePrice: null,
  compareAtPrice: '33000000.00',
  thumbnail: 't.jpg',
  inStock: true,
  stockQuantity: 5,
  ...o,
});

beforeEach(() => jest.clearAllMocks());

// ══════════════════════════════════════════════════════════════════════════════
// extractJSON
// ══════════════════════════════════════════════════════════════════════════════

describe('extractJSON', () => {
  it('strip markdown fence rồi parse', () => {
    expect(extractJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('tìm substring {...} khi có text bao quanh', () => {
    expect(extractJSON('giải thích {"a":2} kết thúc')).toEqual({ a: 2 });
  });

  it('không parse được → null', () => {
    expect(extractJSON('hoàn toàn không phải json')).toBeNull();
  });

  it('fence không nhãn json vẫn parse', () => {
    expect(extractJSON('```\n{"b":3}\n```')).toEqual({ b: 3 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// parseLLMOutput — matched product object đầy đủ
// ══════════════════════════════════════════════════════════════════════════════

describe('parseLLMOutput — matched product', () => {
  it('map đúng product object (toNum DECIMAL, discount, passthrough meta)', () => {
    const out = parseLLMOutput(
      JSON.stringify({
        response: 'Đây là máy',
        matchedProducts: ['iPhone 16 Pro Max'],
        suggestions: ['x'],
        intent: 'product_search',
      }),
      [makeProduct()],
      'ip',
    );
    expect(out.products).toEqual([
      {
        id: 1,
        name: 'iPhone 16 Pro Max',
        slug: 'ip16pm',
        price: 30000000,
        compareAtPrice: 33000000,
        thumbnail: 't.jpg',
        inStock: true,
        stockQuantity: 5,
        rating: null,
        discount: 9, // round((33-30)/33*100)
      },
    ]);
    expect(out.response).toBe('Đây là máy');
    expect(out.suggestions).toEqual(['x']);
    expect(out.intent).toBe('product_search');
  });

  it('inStock mặc định true khi product.inStock undefined', () => {
    const out = parseLLMOutput(
      JSON.stringify({ response: 'r', matchedProducts: ['iPhone 16 Pro Max'] }),
      [makeProduct({ inStock: undefined })],
      'ip',
    );
    expect(out.products[0].inStock).toBe(true);
  });

  it('discount = 0 khi không có compareAtPrice', () => {
    const out = parseLLMOutput(
      JSON.stringify({ response: 'r', matchedProducts: ['iPhone 16 Pro Max'] }),
      [makeProduct({ compareAtPrice: null })],
      'ip',
    );
    expect(out.products[0].discount).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matching rules
// ══════════════════════════════════════════════════════════════════════════════

describe('parseLLMOutput — matching rules', () => {
  it('version keyword khác (Pro vs Pro Max) → KHÔNG match + log hallucination', () => {
    const out = parseLLMOutput(
      JSON.stringify({ response: 'r', matchedProducts: ['iPhone 16 Pro'] }),
      [makeProduct()],
      'ip',
    );
    expect(out.products).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Hallucination'));
  });

  it('số thế hệ khác (15 vs 16) → KHÔNG match', () => {
    const out = parseLLMOutput(
      JSON.stringify({ response: 'r', matchedProducts: ['iPhone 15 Pro Max'] }),
      [makeProduct()],
      'ip',
    );
    expect(out.products).toHaveLength(0);
  });

  it('word overlap ≥80% (thêm "Apple") → vẫn match', () => {
    const out = parseLLMOutput(
      JSON.stringify({ response: 'r', matchedProducts: ['Apple iPhone 16 Pro Max'] }),
      [makeProduct()],
      'ip',
    );
    expect(out.products).toHaveLength(1);
  });

  it('exact match (lowercase) → match', () => {
    const out = parseLLMOutput(
      JSON.stringify({ response: 'r', matchedProducts: ['iphone 16 pro max'] }),
      [makeProduct()],
      'ip',
    );
    expect(out.products).toHaveLength(1);
  });

  it('dedup: 2 tên cùng resolve 1 product → 1 kết quả', () => {
    const out = parseLLMOutput(
      JSON.stringify({
        response: 'r',
        matchedProducts: ['iPhone 16 Pro Max', 'iphone 16 pro max'],
      }),
      [makeProduct()],
      'ip',
    );
    expect(out.products).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Defaults + fallback
// ══════════════════════════════════════════════════════════════════════════════

describe('parseLLMOutput — defaults & fallback', () => {
  it('thiếu response/suggestions/intent → dùng default', () => {
    const out = parseLLMOutput(JSON.stringify({ matchedProducts: [] }), [], 'ip');
    expect(out.response).toBe('Tôi có thể giúp bạn tìm sản phẩm phù hợp!');
    expect(out.suggestions).toEqual([
      'Xem tất cả sản phẩm',
      'Sản phẩm khuyến mãi',
      'Hỗ trợ mua hàng',
      'Liên hệ tư vấn',
    ]);
    expect(out.intent).toBe('general');
  });

  it('JSON không parse được → fallback simpleKeywordMatch + log error', () => {
    const out = parseLLMOutput('không phải json', [makeProduct()], 'iphone');
    expect(out).toHaveProperty('response');
    expect(out).toHaveProperty('products');
    expect(out).toHaveProperty('suggestions');
    expect(out).toHaveProperty('intent');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('parseLLMOutput'),
      expect.any(String),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// extractProductsFromText (post-processing)
// ══════════════════════════════════════════════════════════════════════════════

describe('parseLLMOutput — bổ sung SP từ response text', () => {
  const p1 = makeProduct({ id: 1, name: 'iPhone 16 Pro Max', compareAtPrice: null });
  const p2 = {
    id: 2,
    name: 'Samsung Galaxy S25',
    slug: 'b',
    price: 25000000,
    compareAtPrice: null,
    thumbnail: 't2',
    inStock: true,
    stockQuantity: 3,
  };

  it('SP nhắc trong response nhưng thiếu khỏi matchedProducts → bổ sung + log debug', () => {
    const out = parseLLMOutput(
      JSON.stringify({
        response: 'Bạn xem thêm Samsung Galaxy S25 nhé',
        matchedProducts: ['iPhone 16 Pro Max'],
      }),
      [p1, p2],
      'x',
    );
    expect(out.products.map((p) => p.id).sort()).toEqual([1, 2]);
    expect(out.products.find((p) => p.id === 2)).toEqual({
      id: 2,
      name: 'Samsung Galaxy S25',
      slug: 'b',
      price: 25000000,
      compareAtPrice: null,
      thumbnail: 't2',
      inStock: true,
      stockQuantity: 3,
      rating: null,
      discount: 0,
    });
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Post-processing'));
  });

  it('ngữ cảnh phủ định ("không có hàng") → KHÔNG bổ sung', () => {
    const out = parseLLMOutput(
      JSON.stringify({ response: 'Samsung Galaxy S25 hiện không có hàng', matchedProducts: [] }),
      [p2],
      'x',
    );
    expect(out.products).toHaveLength(0);
  });

  it('core name 1 từ (< 2 từ) → bỏ qua không bổ sung', () => {
    const out = parseLLMOutput(
      JSON.stringify({ response: 'có Oppo nhé', matchedProducts: [] }),
      [{ ...p2, id: 3, name: 'Oppo' }],
      'x',
    );
    expect(out.products).toHaveLength(0);
  });
});
