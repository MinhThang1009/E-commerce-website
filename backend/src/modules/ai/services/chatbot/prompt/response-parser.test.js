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

  test('map được khi tên DB có dấu phẩy/ngoặc còn LLM viết gọn (word-overlap normalize)', () => {
    // Tên laptop trong DB chứa specs + dấu câu; LLM viết lại gọn hơn.
    // Trước fix: "1334u," ≠ "1334u" → overlap < 80% → map fail → mất card.
    const prods = [
      {
        id: 7,
        name: 'Laptop HP 15 fd0235TU - 9Q970PA (i5 1334U, 16GB, 512GB, Full HD, Win11)',
        price: 13890000,
        slug: 'laptop-hp-15-fd0235tu',
        thumbnail: null,
        inStock: true,
      },
    ];
    const aiText = JSON.stringify({
      response: 'Dạ có Laptop HP 15 fd0235TU i5 1334U (9Q970PA) ạ',
      matchedProducts: ['Laptop HP 15 fd0235TU i5 1334U (9Q970PA)'],
      suggestions: [],
      intent: 'product_search',
    });

    const result = parseLLMOutput(aiText, prods, 'laptop hp');
    expect(result.products).toHaveLength(1);
    expect(result.products[0].id).toBe(7);
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

// ─── hasNegationContext — pos === Infinity khi coreWords rỗng (line 113 branch[0]) ─────────

describe('parseLLMOutput — extractProductsFromText: coreWords rỗng → hasNegationContext trả false (line 113)', () => {
  test('sản phẩm có tên chỉ gồm ký tự đơn (< 2 ký tự) → coreWords rỗng → hasNegationContext pos=Infinity → trả false → sản phẩm được bổ sung', () => {
    // Core name sẽ là "a b" (2 từ đơn ký tự, bị filter bởi w.length >= 2)
    // → coreWords = [] → hasNegationContext(rLower, []) → for loop không chạy → pos=Infinity → return false
    // → sản phẩm KHÔNG bị skip → được thêm vào candidates
    // Để đạt được điều này: tên sản phẩm phải có core ≥ 2 từ (qua filter length < 2 tại line 160),
    // nhưng tất cả từ trong core đều < 2 ký tự sau khi filter tại line 165.
    // Cách dễ nhất: tên có 2 ký tự đơn, nhưng core.split().length >= 2 sẽ pass vì length=2 (2 single chars joined by space).
    // Tuy nhiên filter (w) => w.length < 2 loại cả, còn regex phrase match cần test response chứa "a b".
    // → dùng tên với 2 ký tự đơn được cách nhau: "A B Samsung" nhưng CATEGORY_PREFIX_RE không strip gì
    // Core "a b samsung" có 3 words; "a"(1 char) và "b"(1 char) bị filter → coreWords = ["samsung"]
    // → hasNegationContext được gọi với 1 word "samsung" tồn tại trong response → pos ≠ Infinity
    // Cách đúng: đặt core name = "X Y" (2 từ 1 ký tự) — vì split length ≥ 2 pass line 160,
    // nhưng sau filter >= 2 ký tự thì coreWords = []. Tuy nhiên regex phrase match "x y" cần có trong response.
    const prods = [
      {
        id: 70,
        name: 'A B', // core = "a b" — 2 từ đơn ký tự, split length=2 ≥ 2 → pass line 160
        // coreWords = ["a","b"].filter(w => w.length >= 2) = [] → hasNegationContext(rLower, []) = false
        price: 5000000,
        basePrice: 5000000,
        slug: 'a-b',
        thumbnail: null,
        inStock: true,
        stockQuantity: 2,
      },
    ];
    // Response chứa "a b" để vượt qua phrase-match regex ở line 163
    const aiText = JSON.stringify({
      response: 'a b là sản phẩm bạn cần tìm.',
      matchedProducts: [],
      suggestions: [],
      intent: 'product_search',
    });
    const result = parseLLMOutput(aiText, prods, 'a b');
    // hasNegationContext trả false → sản phẩm được bổ sung (không bị skip)
    expect(result.products).toHaveLength(1);
    expect(result.products[0].id).toBe(70);
  });
});

// ─── hasNegationContext — trả true khi câu chứa từ phủ định (line 166 branch[0]) ────────────

describe('parseLLMOutput — extractProductsFromText: hasNegationContext=true → bỏ qua sản phẩm (line 166)', () => {
  test('response đề cập sản phẩm trong ngữ cảnh phủ định → sản phẩm không được bổ sung', () => {
    // Response chứa tên sản phẩm nhưng câu có "không có" → hasNegationContext = true → skip
    const prods = [
      {
        id: 71,
        name: 'Xiaomi Redmi Note 12',
        price: 6000000,
        basePrice: 6000000,
        slug: 'xiaomi-redmi-note-12',
        thumbnail: null,
        inStock: false,
        stockQuantity: 0,
      },
    ];
    const aiText = JSON.stringify({
      response: 'Rất tiếc, chúng tôi không có Xiaomi Redmi Note 12 trong kho hiện tại.',
      matchedProducts: [],
      suggestions: [],
      intent: 'product_search',
    });
    const result = parseLLMOutput(aiText, prods, 'xiaomi note 12');
    // Câu chứa "không có" ngay trước tên SP → hasNegationContext = true → bị skip
    expect(result.products).toHaveLength(0);
  });

  test('response đề cập sản phẩm với "hết hàng" → không được bổ sung', () => {
    const prods = [
      {
        id: 72,
        name: 'OPPO Find X7 Ultra',
        price: 30000000,
        basePrice: 30000000,
        slug: 'oppo-find-x7-ultra',
        thumbnail: null,
        inStock: false,
        stockQuantity: 0,
      },
    ];
    const aiText = JSON.stringify({
      response: 'OPPO Find X7 Ultra hiện đã hết hàng, bạn vui lòng chọn sản phẩm khác.',
      matchedProducts: [],
      suggestions: [],
      intent: 'product_search',
    });
    const result = parseLLMOutput(aiText, prods, 'oppo find x7');
    // Câu chứa "hết hàng" → hasNegationContext = true → bị skip
    expect(result.products).toHaveLength(0);
  });
});

// ─── extractProductsFromText — p.price null → dùng p.basePrice (line 205 binary-expr branch[1]) ─

describe('parseLLMOutput — extractProductsFromText: p.price null → fallback sang p.basePrice (line 205)', () => {
  test('sản phẩm không có price (null) → toNum(p.price ?? p.basePrice) dùng basePrice', () => {
    const prods = [
      {
        id: 73,
        name: 'Samsung Galaxy Tab S9 Ultra',
        price: null, // null → ?? operator lấy basePrice
        basePrice: 22000000,
        slug: 'samsung-tab-s9-ultra',
        thumbnail: 'tab.jpg',
        inStock: true,
        stockQuantity: 4,
      },
    ];
    const aiText = JSON.stringify({
      response: 'Samsung Galaxy Tab S9 Ultra là chiếc máy tính bảng cao cấp nhất hiện nay.',
      matchedProducts: [],
      suggestions: [],
      intent: 'product_search',
    });
    const result = parseLLMOutput(aiText, prods, 'samsung tab s9');
    expect(result.products).toHaveLength(1);
    // price null → p.price ?? p.basePrice = 22000000
    expect(result.products[0].price).toBe(22000000);
  });

  test('sản phẩm không có price (undefined) → toNum(p.price ?? p.basePrice) dùng basePrice', () => {
    const prods = [
      {
        id: 74,
        name: 'Lenovo ThinkPad X13 Gen4',
        // price undefined
        basePrice: 35000000,
        slug: 'lenovo-thinkpad-x13',
        thumbnail: null,
        inStock: true,
        stockQuantity: 1,
      },
    ];
    const aiText = JSON.stringify({
      response: 'Lenovo ThinkPad X13 Gen4 là laptop doanh nhân đáng tin cậy.',
      matchedProducts: [],
      suggestions: [],
      intent: 'product_search',
    });
    const result = parseLLMOutput(aiText, prods, 'lenovo thinkpad x13');
    expect(result.products).toHaveLength(1);
    expect(result.products[0].price).toBe(35000000);
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
