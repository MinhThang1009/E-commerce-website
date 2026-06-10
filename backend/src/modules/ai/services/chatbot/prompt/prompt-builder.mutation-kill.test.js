/**
 * prompt-builder.mutation-kill.test.js
 *
 * Bổ sung cho prompt-builder.test.js (100% branch nhưng mutation ~50%).
 * buildAugmentedPrompt là pure function trả về 1 chuỗi → kill mutant bằng
 * golden-string (so khớp CHÍNH XÁC từng dòng output) + version-warning + store env.
 *
 * Lưu ý: chuỗi "CẢNH BÁO" xuất hiện cả trong rules tĩnh (quy tắc 4) → detect
 * version warning bằng marker duy nhất "Query đề cập đến số".
 */

const { buildAugmentedPrompt } = require('./prompt-builder');

const STORE_ENV = [
  'STORE_NAME',
  'STORE_WARRANTY',
  'STORE_SHIPPING',
  'STORE_RETURN',
  'STORE_SUPPORT',
];

beforeEach(() => {
  STORE_ENV.forEach((k) => delete process.env[k]);
});
afterEach(() => {
  STORE_ENV.forEach((k) => delete process.env[k]);
});

const lineOf = (prompt) =>
  prompt.split('\n').find((l) => l.startsWith('- ') && l.includes('Giá từ'));
const hasVersionWarning = (prompt) => prompt.includes('Query đề cập đến số');

// ══════════════════════════════════════════════════════════════════════════════
// Product line — golden string đầy đủ
// ══════════════════════════════════════════════════════════════════════════════

describe('product line — format chính xác', () => {
  it('sản phẩm đầy đủ (variants/rating/desc/specs) → dòng khớp chính xác', () => {
    const full = {
      id: 1,
      name: 'iPhone 15 Pro',
      category: 'Điện thoại',
      shortDescription: 'Flagship Apple',
      description: 'Mô tả chi tiết dài hơn phần ngắn',
      price: 29990000,
      inStock: true,
      ratingAverage: 4.5,
      specifications: 'RAM 8GB',
      variants: [
        { variantName: '128GB', price: 25000000, stockQuantity: 5 },
        { variantName: '256GB', price: 30000000, stockQuantity: 0 },
      ],
    };
    const out = buildAugmentedPrompt('iphone 15', [full]);
    expect(lineOf(out)).toBe(
      '- iPhone 15 Pro (Điện thoại): Flagship Apple - Mô tả: Mô tả chi tiết dài hơn phần ngắn. Thông số: RAM 8GB | Phiên bản: 128GB (25.000.000đ, còn hàng); 256GB (30.000.000đ, hết hàng) - Giá từ: 29.990.000 đ - Tình trạng: Còn hàng - Đánh giá: 4.5/5',
    );
  });

  it('sản phẩm tối thiểu (không variants/rating/desc/specs/lowConfidence) → dòng khớp chính xác, không có "Stryker"', () => {
    const minimal = {
      id: 1,
      name: 'A',
      category: 'C',
      shortDescription: 'S1',
      price: 1,
      inStock: true,
    };
    const out = buildAugmentedPrompt('x', [minimal]);
    expect(lineOf(out)).toBe('- A (C): S1 - Giá từ: 1 đ - Tình trạng: Còn hàng');
    expect(out).not.toContain('Stryker was here');
  });

  it('variant price=null → KHÔNG hiển thị giá variant (dòng khớp chính xác)', () => {
    const p = {
      id: 2,
      name: 'P',
      category: 'C',
      shortDescription: 'S',
      price: 100,
      inStock: true,
      variants: [{ variantName: 'Basic', price: null, stockQuantity: 3 }],
    };
    const out = buildAugmentedPrompt('test', [p]);
    expect(lineOf(out)).toBe(
      '- P (C): S | Phiên bản: Basic, còn hàng) - Giá từ: 100 đ - Tình trạng: Còn hàng',
    );
    expect(out).not.toContain('Basic (');
  });

  it('description dài >300 ký tự → cắt còn đúng 300 ký tự', () => {
    const longDesc = 'X'.repeat(350);
    const p = {
      id: 1,
      name: 'A',
      category: 'C',
      shortDescription: 'short',
      description: longDesc,
      price: 1,
      inStock: true,
    };
    const out = buildAugmentedPrompt('x', [p]);
    const m = out.match(/Mô tả: (X+)/);
    expect(m[1]).toHaveLength(300);
  });

  it('2 sản phẩm → nối bằng "\\n" (kill join "")', () => {
    const products = [
      { id: 1, name: 'A', category: 'C', shortDescription: 'S1', price: 1, inStock: true },
      { id: 2, name: 'B', category: 'C', shortDescription: 'S2', price: 2, inStock: false },
    ];
    const out = buildAugmentedPrompt('x', products);
    expect(out).toContain(
      '- A (C): S1 - Giá từ: 1 đ - Tình trạng: Còn hàng\n- B (C): S2 - Giá từ: 2 đ - Tình trạng: Hết hàng',
    );
  });

  it('danh sách rỗng → "(Không tìm thấy sản phẩm nào phù hợp trong cơ sở dữ liệu)"', () => {
    const out = buildAugmentedPrompt('x', []);
    expect(out).toContain('(Không tìm thấy sản phẩm nào phù hợp trong cơ sở dữ liệu)');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Version warning — regex + filter + conditional
// ══════════════════════════════════════════════════════════════════════════════

describe('version warning', () => {
  const galaxy = [
    { id: 1, name: 'Galaxy S24', category: 'C', shortDescription: 'S', price: 100, inStock: true },
  ];

  it('số model không khớp → cảnh báo với danh sách số nối bằng ", "', () => {
    const out = buildAugmentedPrompt('So sánh iPhone 17 và 18', galaxy);
    expect(out).toContain(
      '⚠️ CẢNH BÁO: Query đề cập đến số "17, 18" nhưng KHÔNG có sản phẩm nào trong danh sách chứa số này. Đây là retrieved context gần nhất, KHÔNG phải sản phẩm được hỏi.',
    );
  });

  it('số model khớp tên 1 trong nhiều sản phẩm → KHÔNG cảnh báo (kill some→every)', () => {
    // 2 sản phẩm: chỉ 1 chứa "17". some() → không thiếu; every() (mutant) → thiếu → cảnh báo.
    const out = buildAugmentedPrompt('iPhone 17', [
      {
        id: 1,
        name: 'iPhone 17 Pro',
        category: 'C',
        shortDescription: 'S',
        price: 1,
        inStock: true,
      },
      { id: 2, name: 'Galaxy S24', category: 'C', shortDescription: 'S', price: 2, inStock: true },
    ]);
    expect(hasVersionWarning(out)).toBe(false);
    expect(out).not.toContain('Stryker was here');
  });

  it('query không có số → KHÔNG cảnh báo (kill ArrayDeclaration fallback)', () => {
    const out = buildAugmentedPrompt('tư vấn điện thoại tốt', galaxy);
    expect(hasVersionWarning(out)).toBe(false);
    expect(out).not.toContain('Stryker was here');
  });

  // Regex: \d{2,4} (kill \d single-digit)
  it('số 1 chữ số (iPhone 7) → KHÔNG cảnh báo', () => {
    expect(hasVersionWarning(buildAugmentedPrompt('iPhone 7', galaxy))).toBe(false);
  });

  // Verifies [M2]: số đầu của dải giá không phải số model — trước fix "15" trong "15-20 triệu"
  // sinh cảnh báo sai khiến LLM bị ép trả "Cửa hàng chưa có..."
  it('dải giá "15-20 triệu" → KHÔNG cảnh báo (số 15 là giá, không phải model)', () => {
    expect(hasVersionWarning(buildAugmentedPrompt('điện thoại tầm 15-20 triệu', galaxy))).toBe(
      false,
    );
  });

  it('dải giá "15 đến 20 triệu" → KHÔNG cảnh báo', () => {
    expect(
      hasVersionWarning(buildAugmentedPrompt('điện thoại từ 15 đến 20 triệu giá tốt', galaxy)),
    ).toBe(false);
  });

  it('dải giá + số model thật → CHỈ cảnh báo số model ("17"), không kèm "15"', () => {
    const out = buildAugmentedPrompt('iPhone 17 tầm 15-20 triệu', galaxy);
    expect(out).toContain('Query đề cập đến số "17"');
  });

  // Regex: lookahead loại đơn vị, \s* (0+ space)
  it('số dính đơn vị "256gb" → KHÔNG cảnh báo', () => {
    expect(hasVersionWarning(buildAugmentedPrompt('máy 256gb ram', galaxy))).toBe(false);
  });

  it('số + 1 space + đơn vị "17 gb" → KHÔNG cảnh báo (kill \\s*→\\S*)', () => {
    expect(hasVersionWarning(buildAugmentedPrompt('tai nghe 17 gb', galaxy))).toBe(false);
  });

  it('số + 2 space + đơn vị "17  gb" → KHÔNG cảnh báo (kill \\s*→\\s)', () => {
    expect(hasVersionWarning(buildAugmentedPrompt('tai nghe 17  gb', galaxy))).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Store info block — env default vs override
// ══════════════════════════════════════════════════════════════════════════════

describe('store info block', () => {
  it('env chưa set → dùng giá trị mặc định chính xác', () => {
    const out = buildAugmentedPrompt('x', []);
    expect(out).toContain('THÔNG TIN CỬA HÀNG (TechStore):');
    expect(out).toContain('- Bảo hành: 12 tháng chính hãng');
    expect(out).toContain('- Giao hàng: Miễn phí toàn quốc');
    expect(out).toContain('- Đổi trả: 30 ngày nếu lỗi nhà sản xuất');
    expect(out).toContain('- Hỗ trợ kỹ thuật: Tư vấn cấu hình, so sánh, hỗ trợ sau mua hàng');
  });

  it('env đã set → dùng giá trị từ env (kill ConditionalExpression false)', () => {
    process.env.STORE_NAME = 'MyShop';
    process.env.STORE_WARRANTY = 'BH 24 tháng';
    process.env.STORE_SHIPPING = 'Ship hỏa tốc';
    process.env.STORE_RETURN = 'Đổi trả 7 ngày';
    process.env.STORE_SUPPORT = 'Hotline 24/7';
    const out = buildAugmentedPrompt('x', []);
    expect(out).toContain('THÔNG TIN CỬA HÀNG (MyShop):');
    expect(out).toContain('- Bảo hành: BH 24 tháng');
    expect(out).toContain('- Giao hàng: Ship hỏa tốc');
    expect(out).toContain('- Đổi trả: Đổi trả 7 ngày');
    expect(out).toContain('- Hỗ trợ kỹ thuật: Hotline 24/7');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// User message + tình trạng hết hàng
// ══════════════════════════════════════════════════════════════════════════════

describe('user message + stock', () => {
  it('userMessage được nhúng đúng trong prompt', () => {
    const out = buildAugmentedPrompt('câu hỏi đặc biệt 999', []);
    expect(out).toContain('TIN NHẮN KHÁCH HÀNG: "câu hỏi đặc biệt 999"');
  });

  it('inStock=false → "Hết hàng"', () => {
    const out = buildAugmentedPrompt('x', [
      { id: 1, name: 'A', category: 'C', shortDescription: 'S', price: 1, inStock: false },
    ]);
    expect(lineOf(out)).toBe('- A (C): S - Giá từ: 1 đ - Tình trạng: Hết hàng');
  });
});
