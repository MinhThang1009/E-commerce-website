/**
 * Branch-coverage tests cho productNameGenerator.js.
 * Nhắm vào các nhánh DEFAULT PARAMETER chưa được cover:
 *  - line 32: selectedAttributes = [] → khi caller truyền undefined
 *  - line 94: attributesCombination = {} → khi caller truyền undefined
 *  - line 119: options = {} → khi caller truyền undefined
 *  - line 210: separator = ' ' → khi caller truyền undefined
 *
 * Lưu ý: V8 coverage đánh dấu default parameter expressions là "branches".
 * "Left side" = caller truyền giá trị, "Right side" = caller không truyền → dùng default.
 * Nhánh "right side" của default param bị miss khi tất cả tests đều truyền tường minh.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockAttributeValueFindAll = jest.fn();

jest.mock('../../models', () => ({
  AttributeValue: {
    associations: { attributeGroup: true },
    findAll: (...args) => mockAttributeValueFindAll(...args),
    belongsTo: jest.fn(),
  },
  AttributeGroup: {
    associations: { values: true },
    hasMany: jest.fn(),
  },
}));

const productNameGenerator = require('./productNameGenerator');

afterEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// Line 32: selectedAttributes = [] default parameter
// — triggered khi caller gọi generateProductName(baseName, undefined)
// ============================================================

describe('generateProductName — line 32: selectedAttributes default = []', () => {
  it('selectedAttributes = undefined → dùng default [] → trả về baseName ngay', async () => {
    // Không truyền selectedAttributes (undefined) → default = []
    // selectedAttributes.length = 0 → return baseName ngay, không gọi DB
    const result = await productNameGenerator.generateProductName('ThinkPad X1', undefined);

    expect(result).toBe('ThinkPad X1');
    expect(mockAttributeValueFindAll).not.toHaveBeenCalled();
  });

  it('separator = undefined → dùng default " " khi selectedAttributes cũng undefined', async () => {
    // Cả selectedAttributes lẫn separator đều undefined → default cả hai
    mockAttributeValueFindAll.mockResolvedValue([]);

    // Truyền baseName + selectedAttributes=undefined + separator=undefined
    const result = await productNameGenerator.generateProductName('Dell XPS', undefined, undefined);
    expect(result).toBe('Dell XPS');
  });
});

// ============================================================
// Line 94: attributesCombination = {} default parameter
// — triggered khi caller gọi generateVariantName(baseName, undefined)
// ============================================================

describe('generateVariantName — line 94: attributesCombination default = {}', () => {
  it('attributesCombination = undefined → dùng default {} → Object.values({}) = [] → baseName ngay', async () => {
    // Không truyền attributesCombination → default = {}
    // Object.values({}) = [] → filter = [] → generateProductName với [] → baseName
    const result = await productNameGenerator.generateVariantName('MacBook Pro', undefined);

    expect(result).toBe('MacBook Pro');
    expect(mockAttributeValueFindAll).not.toHaveBeenCalled();
  });

  it('separator = undefined → dùng default " " trong generateVariantName', async () => {
    // Truyền attributesCombination=undefined, separator=undefined
    const result = await productNameGenerator.generateVariantName('Laptop', undefined, undefined);
    expect(result).toBe('Laptop');
  });
});

// ============================================================
// Line 119: options = {} default parameter
// — triggered khi caller gọi previewProductName(baseName, attrs, undefined)
// ============================================================

describe('previewProductName — line 119: options default = {}', () => {
  it('options = undefined → dùng default {} → separator=" ", includeDetails=false', async () => {
    // Không truyền options (undefined) → default = {}
    // Destructure: separator = ' ' (default), includeDetails = false (default)
    mockAttributeValueFindAll.mockResolvedValue([]);

    const result = await productNameGenerator.previewProductName('HP Pavilion', [1], undefined);

    expect(result.originalName).toBe('HP Pavilion');
    expect(result.generatedName).toBe('HP Pavilion');
    // includeDetails = false → affectingAttributes không có trong result
    expect(result.affectingAttributes).toBeUndefined();
  });

  it('options = undefined → separator mặc định " " — generatedName nối bằng space', async () => {
    mockAttributeValueFindAll.mockResolvedValue([
      {
        id: 1, name: 'Silver', nameTemplate: null,
        attributeGroup: { id: 1, name: 'Color', type: 'color', sortOrder: 1 },
      },
    ]);

    // Truyền undefined cho options → separator = ' ' (default)
    // Dùng baseName 1 từ để parts = [baseName, attrName] (không bị split thêm)
    const result = await productNameGenerator.previewProductName('Asus', [1], undefined);

    expect(result.generatedName).toBe('Asus Silver');
    // parts được split bằng default separator ' ' → ['Asus', 'Silver']
    expect(result.parts).toEqual(['Asus', 'Silver']);
  });

  it('options.separator = undefined → separator destructure default " "', async () => {
    mockAttributeValueFindAll.mockResolvedValue([]);

    // Truyền options nhưng không có separator → destructure default
    const result = await productNameGenerator.previewProductName('Lenovo', [], { includeDetails: false });
    expect(result.parts).toEqual(['Lenovo']);
  });
});

// ============================================================
// Line 210: separator = ' ' default parameter trong batchGenerateNames
// — triggered khi caller gọi batchGenerateNames(items, undefined)
// ============================================================

describe('batchGenerateNames — line 210: separator default = " "', () => {
  it('separator = undefined → dùng default " " (khoảng trắng)', async () => {
    mockAttributeValueFindAll.mockResolvedValue([
      {
        id: 1,
        name: 'Pro',
        nameTemplate: null,
        attributeGroup: { id: 1, name: 'Edition', type: 'text', sortOrder: 1 },
      },
    ]);

    // Không truyền separator (undefined) → default = ' '
    const results = await productNameGenerator.batchGenerateNames(
      [{ id: 'v1', baseName: 'Surface', selectedAttributes: [1] }],
      undefined  // separator = undefined → default ' '
    );

    expect(results).toHaveLength(1);
    // Separator ' ' → "Surface Pro" (có khoảng trắng)
    expect(results[0].generatedName).toBe('Surface Pro');
  });

  it('items = undefined → dùng default [] → trả về mảng rỗng không crash', async () => {
    // items = undefined → default = [] → for...of không chạy → results = []
    const results = await productNameGenerator.batchGenerateNames(undefined);

    expect(results).toEqual([]);
    expect(mockAttributeValueFindAll).not.toHaveBeenCalled();
  });
});

// ============================================================
// Bonus: generateProductName — nameTemplate falsy nhưng name có giá trị
// (line 72: nameToAdd = attrValue.nameTemplate || attrValue.name → right side)
// ============================================================

describe('generateProductName — line 72: nameToAdd = nameTemplate || name', () => {
  it('nameTemplate = false (empty string) → dùng name thay thế', async () => {
    mockAttributeValueFindAll.mockResolvedValue([
      {
        id: 1,
        name: 'Blue',
        nameTemplate: '',      // falsy empty string → || triggers → dùng name
        attributeGroup: { name: 'Color', type: 'color', sortOrder: 1 },
      },
    ]);

    const result = await productNameGenerator.generateProductName('Dell XPS', [1]);
    // nameTemplate = '' → falsy → nameToAdd = '' || 'Blue' = 'Blue'
    expect(result).toBe('Dell XPS Blue');
  });

  it('nameTemplate = 0 (falsy number) → dùng name thay thế', async () => {
    mockAttributeValueFindAll.mockResolvedValue([
      {
        id: 2,
        name: 'Red',
        nameTemplate: 0,       // 0 → falsy → || name = 'Red'
        attributeGroup: { name: 'Color', type: 'color', sortOrder: 1 },
      },
    ]);

    const result = await productNameGenerator.generateProductName('HP', [2]);
    expect(result).toBe('HP Red');
  });
});

// ============================================================
// Line 119: previewProductName — selectedAttributes = [] default param
// — triggered khi selectedAttributes không được truyền (undefined)
// ============================================================

describe('previewProductName — line 119: selectedAttributes default = []', () => {
  it('selectedAttributes không truyền → dùng default [] → hasChanges = false', async () => {
    // Không truyền selectedAttributes → default = []
    // → generateProductName('baseName', []) → return baseName → no changes
    const result = await productNameGenerator.previewProductName('Acer Nitro');

    expect(result.originalName).toBe('Acer Nitro');
    expect(result.generatedName).toBe('Acer Nitro');
    expect(result.hasChanges).toBe(false);
    expect(mockAttributeValueFindAll).not.toHaveBeenCalled();
  });

  it('cả selectedAttributes và options không truyền → cả 2 dùng default', async () => {
    // Không truyền cả selectedAttributes lẫn options
    const result = await productNameGenerator.previewProductName('MSI Laptop');

    expect(result.generatedName).toBe('MSI Laptop');
    expect(result.parts).toEqual(['MSI', 'Laptop']); // split by default ' '
  });
});
