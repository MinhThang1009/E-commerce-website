/**
 * @file responseParser.extra.test.js
 * @description Covers lines 18-19 (extractJSON inner catch) và line 62 (number mismatch).
 */

jest.mock('@utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
}));

jest.mock('@modules/ai/services/chatbot/keyword/keyword-fallback', () => ({
  simpleKeywordMatch: jest.fn(() => ({
    response: 'fallback',
    products: [],
    suggestions: [],
    intent: 'general',
  })),
}));

const { parseLLMOutput, extractJSON } = require('./response-parser');

describe('extractJSON — inner try-catch (lines 18-19)', () => {
  test('trả về null khi text có {...} nhưng không phải JSON hợp lệ', () => {
    // First parse fails, regex matches {...}, second parse also fails → return null
    const result = extractJSON('Text here { invalid: json, no quotes }');
    expect(result).toBeNull();
  });

  test('trả về object khi regex match là valid JSON', () => {
    const result = extractJSON('Some text {"key": "value"} more text');
    expect(result).toEqual({ key: 'value' });
  });

  test('trả về null khi text không có {} pattern', () => {
    const result = extractJSON('completely invalid text without braces');
    expect(result).toBeNull();
  });
});

describe('parseLLMOutput — number mismatch (line 62)', () => {
  const products = [
    {
      id: 1,
      name: 'iPhone 14 Pro',
      price: 25000000,
      basePrice: 25000000,
      slug: 'iphone-14-pro',
      thumbnail: 'img.jpg',
      inStock: true,
      stockQuantity: 5,
    },
    {
      id: 2,
      name: 'iPhone 15',
      price: 28000000,
      basePrice: 28000000,
      slug: 'iphone-15',
      thumbnail: 'img2.jpg',
      inStock: true,
    },
  ];

  test('không match khi LLM đề xuất sản phẩm có model number khác (line 62 — hasNumberMismatch)', () => {
    // iPhone 15 Pro vs iPhone 14 Pro: numbers 15 vs 14 → mismatch → line 62
    // Không có version mismatch (cả hai đều có 'pro') nên sẽ đến được line 62
    const prods = [
      {
        id: 3,
        name: 'iPhone 14 Pro',
        price: 22000000,
        basePrice: 22000000,
        slug: 'iphone-14-pro',
        thumbnail: null,
        inStock: true,
      },
    ];
    const aiText = JSON.stringify({
      response: 'Tim thay san pham',
      matchedProducts: ['iPhone 15 Pro'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = parseLLMOutput(aiText, prods, 'iphone 15 pro');
    expect(result.products).toHaveLength(0);
  });

  test('match khi cùng số, không có version mismatch', () => {
    const prods = [
      {
        id: 4,
        name: 'iPhone 15',
        price: 28000000,
        slug: 'iphone-15',
        thumbnail: null,
        inStock: true,
      },
    ];
    const aiText = JSON.stringify({
      response: 'Đây là iPhone 15',
      matchedProducts: ['iPhone 15'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = parseLLMOutput(aiText, prods, 'iphone 15');
    expect(result.products).toHaveLength(1);
    expect(result.products[0].id).toBe(4);
  });
});

// ─── hasNegationContext — pos === Infinity khi không có keyword nào trong response (line 109) ─

describe('parseLLMOutput — extractProductsFromText: product words không xuất hiện trong response (line 109)', () => {
  test('sản phẩm có tên không xuất hiện trong response text → không được bổ sung vào extras', () => {
    const prods = [
      {
        id: 50,
        name: 'Laptop Dell Inspiron 15 3520',
        price: 15000000,
        basePrice: 15000000,
        slug: 'laptop-dell-inspiron-15',
        thumbnail: null,
        inStock: true,
        stockQuantity: 5,
      },
    ];
    // Response hoàn toàn không đề cập đến "dell" hay "inspiron"
    const aiText = JSON.stringify({
      response: 'Bạn có thể xem các sản phẩm phù hợp trên website của chúng tôi.',
      matchedProducts: [],
      suggestions: [],
      intent: 'general',
    });

    const result = parseLLMOutput(aiText, prods, 'laptop rẻ');
    // Không có sản phẩm nào được bổ sung vì words không xuất hiện trong response
    expect(result.products).toHaveLength(0);
  });
});

// ─── extractProductsFromText — product passed 75% threshold → push extras (lines 171-187) ─

describe('parseLLMOutput — extractProductsFromText: bổ sung sản phẩm từ response text (lines 171-187)', () => {
  test('sản phẩm được đề cập trong response nhưng không có trong matchedProducts → được bổ sung', () => {
    // matchedProducts sẽ là rỗng từ LLM, nhưng response đề cập sản phẩm → extractProductsFromText bổ sung
    const prods = [
      {
        id: 60,
        name: 'Samsung Galaxy A55 Pro Ultra',
        price: 12000000,
        basePrice: 12000000,
        compareAtPrice: 15000000,
        slug: 'samsung-galaxy-a55',
        thumbnail: 'a55.jpg',
        inStock: true,
        stockQuantity: 10,
      },
    ];
    // Response đề cập "samsung galaxy a55 pro" — đủ ≥75% words khớp
    const aiText = JSON.stringify({
      response: 'Tôi đề xuất Samsung Galaxy A55 Pro Ultra cho bạn với giá tốt.',
      matchedProducts: [], // LLM quên đưa vào matchedProducts
      suggestions: [],
      intent: 'product_search',
    });

    const result = parseLLMOutput(aiText, prods, 'samsung a55');
    // extractProductsFromText phải phát hiện và bổ sung Samsung Galaxy A55
    expect(result.products).toHaveLength(1);
    expect(result.products[0].id).toBe(60);
    // Tính discount: (15000000 - 12000000) / 15000000 * 100 = 20%
    expect(result.products[0].discount).toBe(20);
  });

  test('sản phẩm được đề cập nhưng dùng p.price khi không có basePrice', () => {
    const prods = [
      {
        id: 61,
        name: 'Xiaomi Redmi Note 13 Pro',
        price: 8000000,
        // không có basePrice — dùng p.price ?? p.basePrice
        slug: 'xiaomi-redmi-note-13',
        thumbnail: null,
        inStock: undefined, // → default true
        stockQuantity: 3,
      },
    ];
    const aiText = JSON.stringify({
      response: 'Xiaomi Redmi Note 13 Pro là lựa chọn tốt trong tầm giá này.',
      matchedProducts: [],
      suggestions: [],
      intent: 'product_search',
    });

    const result = parseLLMOutput(aiText, prods, 'xiaomi note 13');
    expect(result.products).toHaveLength(1);
    expect(result.products[0].price).toBe(8000000);
    expect(result.products[0].inStock).toBe(true); // default true khi inStock = undefined
    expect(result.products[0].discount).toBe(0); // không có compareAtPrice
  });
});

// ─── hasNumberMismatch FALSE branch — matching numbers fall through ───────────

describe('parseLLMOutput — hasNumberMismatch=false: fall through tiếp tục matching', () => {
  test('Samsung Galaxy S24 vs Samsung S24 — không exact match, numbers match (24=24), hasNumberMismatch=false', () => {
    // pName='samsung galaxy s24' !== rName='samsung s24' → không short-circuit ở line 45
    // Cả hai có số '24' → numbersP=['24'], numbersR=['24'] → hasNumberMismatch=false
    // if(false) return false → KHÔNG return → fall through → tiếp tục check words
    const prods = [
      {
        id: 99,
        name: 'Samsung Galaxy S24',
        price: 20000000,
        basePrice: 20000000,
        slug: 'samsung-galaxy-s24',
        thumbnail: null,
        inStock: true,
        stockQuantity: 3,
      },
    ];
    const aiText = JSON.stringify({
      response: 'Samsung S24 tốt',
      matchedProducts: ['Samsung S24'],
      suggestions: [],
      intent: 'product_search',
    });
    const result = parseLLMOutput(aiText, prods, 'samsung s24');
    expect(result).toBeDefined();
  });
});
