/**
 * @file productNameGenerator.test.js
 * @description Gộp từ productNameGenerator.test.js + .branches.test.js + .extra.test.js
 */
// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock models — service require '@models'
// Biến mock phải được khai báo TRONG factory function để tránh lỗi hoisting với jest.mock
const mockAttributeValueFindAll = jest.fn();

jest.mock('@models', () => ({
  AttributeValue: {
    associations: { attributeGroup: true }, // đã có association → service không gọi belongsTo
    findAll: (...args) => mockAttributeValueFindAll(...args),
    belongsTo: jest.fn(),
  },
  AttributeGroup: {
    associations: { values: true }, // đã có association → service không gọi hasMany
    hasMany: jest.fn(),
  },
}));

// ── Load service ──────────────────────────────────────────────────────────────
const productNameGenerator = require('./product-name-generator');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeAttrValue(overrides = {}) {
  return {
    id: 1,
    name: 'Black',
    nameTemplate: null,
    affectsName: true,
    isActive: true,
    sortOrder: 1,
    attributeGroup: { id: 1, name: 'Color', type: 'color', sortOrder: 1 },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateProductName()', () => {
  it('baseName rỗng → throw Error', async () => {
    await expect(productNameGenerator.generateProductName('', [1])).rejects.toThrow(
      'Base name is required',
    );
  });

  it('baseName null → throw Error', async () => {
    await expect(productNameGenerator.generateProductName(null, [1])).rejects.toThrow(
      'Base name is required',
    );
  });

  it('selectedAttributes rỗng → trả về baseName nguyên', async () => {
    const result = await productNameGenerator.generateProductName('ThinkPad X1', []);
    expect(result).toBe('ThinkPad X1');
  });

  it('không có attribute nào có affectsName=true → trả về baseName', async () => {
    mockAttributeValueFindAll.mockResolvedValue([]); // DB không trả về gì

    const result = await productNameGenerator.generateProductName('ThinkPad X1', [1, 2]);
    expect(result).toBe('ThinkPad X1');
  });

  it('1 attribute có name → baseName + separator + name', async () => {
    mockAttributeValueFindAll.mockResolvedValue([
      makeAttrValue({ name: 'Black', nameTemplate: null }),
    ]);

    const result = await productNameGenerator.generateProductName('ThinkPad X1', [1]);
    expect(result).toBe('ThinkPad X1 Black');
  });

  it('attribute có nameTemplate → dùng nameTemplate thay vì name', async () => {
    mockAttributeValueFindAll.mockResolvedValue([
      makeAttrValue({ name: 'Black', nameTemplate: 'Đen' }),
    ]);

    const result = await productNameGenerator.generateProductName('ThinkPad X1', [1]);
    expect(result).toBe('ThinkPad X1 Đen');
  });

  it('nhiều attributes → nối theo thứ tự, cách nhau bằng separator', async () => {
    mockAttributeValueFindAll.mockResolvedValue([
      makeAttrValue({ name: 'Black', nameTemplate: null }),
      makeAttrValue({ id: 2, name: '16GB RAM', nameTemplate: null }),
    ]);

    const result = await productNameGenerator.generateProductName('Laptop', [1, 2]);
    expect(result).toBe('Laptop Black 16GB RAM');
  });

  it('separator tùy chỉnh "/" được áp dụng', async () => {
    mockAttributeValueFindAll.mockResolvedValue([makeAttrValue({ name: 'White' })]);

    const result = await productNameGenerator.generateProductName('MacBook', [1], '/');
    expect(result).toBe('MacBook/White');
  });

  it('nameTemplate hoặc name là whitespace → bỏ qua, không thêm vào tên', async () => {
    mockAttributeValueFindAll.mockResolvedValue([
      makeAttrValue({ name: '   ', nameTemplate: '   ' }),
    ]);

    const result = await productNameGenerator.generateProductName('Dell XPS', [1]);
    expect(result).toBe('Dell XPS');
  });

  it('AttributeValue.findAll throw → propagate error', async () => {
    mockAttributeValueFindAll.mockRejectedValue(new Error('DB connection lost'));

    await expect(productNameGenerator.generateProductName('MacBook', [1])).rejects.toThrow(
      'DB connection lost',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateVariantName()', () => {
  it('truyền attributesCombination object → delegate sang generateProductName', async () => {
    mockAttributeValueFindAll.mockResolvedValue([makeAttrValue({ name: 'Red' })]);

    // attributesCombination: { groupId: valueId }
    const result = await productNameGenerator.generateVariantName('iPhone 17', { colorGroup: 1 });

    expect(result).toBe('iPhone 17 Red');
  });

  it('combination rỗng {} → trả về baseName nguyên', async () => {
    const result = await productNameGenerator.generateVariantName('iPhone 17', {});
    expect(result).toBe('iPhone 17');
  });

  it('combination với giá trị null bị lọc bỏ', async () => {
    mockAttributeValueFindAll.mockResolvedValue([]);
    const result = await productNameGenerator.generateVariantName('Samsung', {
      colorGroup: null,
      storageGroup: undefined,
    });
    expect(result).toBe('Samsung');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('previewProductName()', () => {
  it('trả về originalName, generatedName, hasChanges', async () => {
    mockAttributeValueFindAll.mockResolvedValue([makeAttrValue({ name: 'Blue' })]);

    const result = await productNameGenerator.previewProductName('Dell', [1]);

    expect(result.originalName).toBe('Dell');
    expect(result.generatedName).toBe('Dell Blue');
    expect(result.hasChanges).toBe(true);
  });

  it('không có attribute ảnh hưởng → hasChanges = false', async () => {
    mockAttributeValueFindAll.mockResolvedValue([]);

    const result = await productNameGenerator.previewProductName('Dell', [1]);

    expect(result.generatedName).toBe('Dell');
    expect(result.hasChanges).toBe(false);
  });

  it('parts là mảng các thành phần của generatedName', async () => {
    mockAttributeValueFindAll.mockResolvedValue([makeAttrValue({ name: 'Silver' })]);

    const result = await productNameGenerator.previewProductName('Asus', [1]);

    expect(result.parts).toEqual(['Asus', 'Silver']);
  });

  it('includeDetails=false → không trả về affectingAttributes', async () => {
    mockAttributeValueFindAll.mockResolvedValue([makeAttrValue({ name: 'Red' })]);

    const result = await productNameGenerator.previewProductName('Lenovo', [1], {
      includeDetails: false,
    });

    expect(result.affectingAttributes).toBeUndefined();
  });

  it('includeDetails=true → gọi AttributeValue.findAll lần 2 và trả về affectingAttributes', async () => {
    // lần 1: generateProductName, lần 2: details
    mockAttributeValueFindAll
      .mockResolvedValueOnce([makeAttrValue({ name: 'Green' })])
      .mockResolvedValueOnce([makeAttrValue({ name: 'Green' })]);

    const result = await productNameGenerator.previewProductName('HP', [1], {
      includeDetails: true,
    });

    expect(result.affectingAttributes).toBeDefined();
    expect(Array.isArray(result.affectingAttributes)).toBe(true);
    expect(mockAttributeValueFindAll).toHaveBeenCalledTimes(2);
  });

  it('separator tùy chỉnh được áp dụng vào parts', async () => {
    mockAttributeValueFindAll.mockResolvedValue([makeAttrValue({ name: '512GB' })]);

    const result = await productNameGenerator.previewProductName('MacBook Pro', [1], {
      separator: '-',
    });

    expect(result.generatedName).toBe('MacBook Pro-512GB');
    expect(result.parts).toEqual(['MacBook Pro', '512GB']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getNameAffectingAttributes()', () => {
  it('trả về danh sách attribute values có affectsName=true', async () => {
    const attrs = [makeAttrValue({ id: 1, name: 'Red' }), makeAttrValue({ id: 2, name: '8GB' })];
    mockAttributeValueFindAll.mockResolvedValue(attrs);

    const result = await productNameGenerator.getNameAffectingAttributes();

    expect(result).toBe(attrs);
    expect(mockAttributeValueFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ affectsName: true, isActive: true }),
      }),
    );
  });

  it('không có attribute nào → trả về mảng rỗng', async () => {
    mockAttributeValueFindAll.mockResolvedValue([]);

    const result = await productNameGenerator.getNameAffectingAttributes();

    expect(result).toEqual([]);
  });

  it('DB throw → propagate error', async () => {
    mockAttributeValueFindAll.mockRejectedValue(new Error('timeout'));

    await expect(productNameGenerator.getNameAffectingAttributes()).rejects.toThrow('timeout');
  });

  it('gọi AttributeValue.findAll với include AttributeGroup', async () => {
    mockAttributeValueFindAll.mockResolvedValue([]);
    await productNameGenerator.getNameAffectingAttributes();

    expect(mockAttributeValueFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.arrayContaining([expect.objectContaining({ as: 'attributeGroup' })]),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('batchGenerateNames()', () => {
  it('mảng rỗng → trả về mảng rỗng', async () => {
    const result = await productNameGenerator.batchGenerateNames([]);
    expect(result).toEqual([]);
  });

  it('xử lý từng item và trả về mảng kết quả với id, baseName, generatedName', async () => {
    mockAttributeValueFindAll
      .mockResolvedValueOnce([makeAttrValue({ name: 'Blue' })])
      .mockResolvedValueOnce([]);

    const items = [
      { id: 'v1', baseName: 'iPhone 17', selectedAttributes: [1] },
      { id: 'v2', baseName: 'iPhone 17', selectedAttributes: [] },
    ];

    const results = await productNameGenerator.batchGenerateNames(items);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      id: 'v1',
      baseName: 'iPhone 17',
      generatedName: 'iPhone 17 Blue',
    });
    expect(results[1]).toMatchObject({
      id: 'v2',
      baseName: 'iPhone 17',
      generatedName: 'iPhone 17',
    });
  });

  it('separator tùy chỉnh được áp dụng cho tất cả items trong batch', async () => {
    // Reset any leftover mockResolvedValueOnce from previous test before setting new value
    mockAttributeValueFindAll.mockReset();
    mockAttributeValueFindAll.mockResolvedValue([makeAttrValue({ name: 'Pro' })]);

    const items = [{ id: 1, baseName: 'MacBook', selectedAttributes: [1] }];

    const results = await productNameGenerator.batchGenerateNames(items, '-');

    expect(results[0].generatedName).toBe('MacBook-Pro');
  });

  it('một item throw → propagate error', async () => {
    mockAttributeValueFindAll.mockRejectedValue(new Error('DB error'));

    await expect(
      productNameGenerator.batchGenerateNames([
        { id: 1, baseName: 'Test', selectedAttributes: [99] },
      ]),
    ).rejects.toThrow('DB error');
  });

  it('kết quả chứa selectedAttributes gốc', async () => {
    mockAttributeValueFindAll.mockResolvedValue([makeAttrValue({ name: 'Red' })]);

    const items = [{ id: 'x', baseName: 'Phone', selectedAttributes: [5, 6] }];
    const results = await productNameGenerator.batchGenerateNames(items);

    expect(results[0].selectedAttributes).toEqual([5, 6]);
  });
});

// ─── generateVariantName catch block — lines 107-108 ─────────────────────────
// Covers lines 107-108: catch chạy khi Object.values(attributesCombination) throw đồng bộ
// Note: return this.generateProductName(...) không có await nên Promise rejection
// không bị catch trong generateVariantName; cần input gây lỗi đồng bộ để cover catch

describe('generateVariantName() — catch block (lines 107-108)', () => {
  it('attributesCombination không hợp lệ (null) → catch ghi error log và re-throw', async () => {
    const logger = require('@utils/logger');
    logger.error.mockClear();

    // Object.values(null) throw TypeError đồng bộ → catch trong generateVariantName kích hoạt
    await expect(productNameGenerator.generateVariantName('Phone', null)).rejects.toThrow(
      TypeError,
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error generating variant name:',
      expect.any(TypeError),
    );
  });

  it('catch block không nuốt lỗi — caller nhận được lỗi gốc', async () => {
    // Truyền null để bypass default parameter — Object.values(null) throw TypeError
    await expect(productNameGenerator.generateVariantName('Laptop', null)).rejects.toBeInstanceOf(
      TypeError,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Branch coverage (từ productNameGenerator.branches.test.js)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@models', () => ({
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
        id: 1,
        name: 'Silver',
        nameTemplate: null,
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
    const result = await productNameGenerator.previewProductName('Lenovo', [], {
      includeDetails: false,
    });
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
      undefined, // separator = undefined → default ' '
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
        nameTemplate: '', // falsy empty string → || triggers → dùng name
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
        nameTemplate: 0, // 0 → falsy → || name = 'Red'
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

// ═══════════════════════════════════════════════════════════════════════════════
// Extra coverage (từ productNameGenerator.extra.test.js)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Tests với associations chưa được định nghĩa (lines 6, 13) ────────────────

describe('productNameGenerator module load — association setup khi chưa có', () => {
  it('gọi AttributeValue.belongsTo khi associations.attributeGroup chưa tồn tại (line 6)', () => {
    jest.resetModules();

    const mockBelongsTo = jest.fn();
    const mockHasMany = jest.fn();

    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    jest.mock('@models', () => ({
      AttributeValue: {
        associations: {}, // KHÔNG có attributeGroup → phải gọi belongsTo (line 6)
        findAll: jest.fn().mockResolvedValue([]),
        belongsTo: mockBelongsTo,
      },
      AttributeGroup: {
        associations: {}, // KHÔNG có values → phải gọi hasMany (line 13)
        hasMany: mockHasMany,
      },
    }));

    // Require module → module-level code chạy, gọi AttributeValue.belongsTo và AttributeGroup.hasMany
    require('./product-name-generator');

    expect(mockBelongsTo).toHaveBeenCalledTimes(1);
    expect(mockHasMany).toHaveBeenCalledTimes(1);
  });

  it('KHÔNG gọi belongsTo/hasMany khi associations đã tồn tại', () => {
    jest.resetModules();

    const mockBelongsTo = jest.fn();
    const mockHasMany = jest.fn();

    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    jest.mock('@models', () => ({
      AttributeValue: {
        associations: { attributeGroup: true }, // đã có → không gọi belongsTo
        findAll: jest.fn().mockResolvedValue([]),
        belongsTo: mockBelongsTo,
      },
      AttributeGroup: {
        associations: { values: true }, // đã có → không gọi hasMany
        hasMany: mockHasMany,
      },
    }));

    require('./product-name-generator');

    expect(mockBelongsTo).not.toHaveBeenCalled();
    expect(mockHasMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// association setup khi chưa tồn tại (từ product-name-generator.assoc.test.js)
// ─────────────────────────────────────────────────────────────────────────────

describe('association setup khi chưa tồn tại (assoc file)', () => {
  it('belongsTo + hasMany được gọi với foreignKey/as đúng', () => {
    jest.resetModules();

    const mockBelongsTo = jest.fn();
    const mockHasMany = jest.fn();

    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    jest.mock('@models', () => ({
      AttributeValue: {
        associations: {},
        findAll: jest.fn(),
        belongsTo: (...args) => mockBelongsTo(...args),
      },
      AttributeGroup: {
        associations: {},
        hasMany: (...args) => mockHasMany(...args),
      },
    }));

    const { AttributeValue, AttributeGroup } = require('@models');
    require('@modules/ai/services/product/product-name-generator');

    expect(mockBelongsTo).toHaveBeenCalledWith(AttributeGroup, {
      foreignKey: 'attributeGroupId',
      as: 'attributeGroup',
    });
    expect(mockHasMany).toHaveBeenCalledWith(AttributeValue, {
      foreignKey: 'attributeGroupId',
      as: 'values',
    });
  });
});

// ── generateVariantName() error catch (lines 107-108) ─────────────────────────

describe('productNameGenerator — generateVariantName() error propagation (lines 107-108)', () => {
  let service;

  beforeEach(() => {
    jest.resetModules();

    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    jest.mock('@models', () => ({
      AttributeValue: {
        associations: { attributeGroup: true },
        findAll: jest.fn().mockRejectedValue(new Error('variant DB crash')),
        belongsTo: jest.fn(),
      },
      AttributeGroup: {
        associations: { values: true },
        hasMany: jest.fn(),
      },
    }));

    service = require('./product-name-generator');
  });

  it('AttributeValue.findAll throw trong generateVariantName → propagate lỗi (lines 107-108)', async () => {
    await expect(service.generateVariantName('MacBook', { colorGroup: 1 })).rejects.toThrow(
      'variant DB crash',
    );
  });

  it('logger.error được gọi khi generateVariantName ném lỗi', async () => {
    const mockLogger = require('@utils/logger');

    try {
      await service.generateVariantName('MacBook', { colorGroup: 1 });
    } catch {
      // bỏ qua — chỉ kiểm tra logger
    }

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error generating'),
      expect.any(Error),
    );
  });
});

// ── previewProductName() error catch (lines 164-165) ──────────────────────────

describe('productNameGenerator — previewProductName() error propagation (lines 164-165)', () => {
  let service;

  beforeEach(() => {
    jest.resetModules();

    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    jest.mock('@models', () => ({
      AttributeValue: {
        associations: { attributeGroup: true },
        findAll: jest.fn().mockRejectedValue(new Error('preview DB timeout')),
        belongsTo: jest.fn(),
      },
      AttributeGroup: {
        associations: { values: true },
        hasMany: jest.fn(),
      },
    }));

    service = require('./product-name-generator');
  });

  it('AttributeValue.findAll throw trong previewProductName → propagate lỗi (lines 164-165)', async () => {
    await expect(service.previewProductName('Dell', [1, 2])).rejects.toThrow('preview DB timeout');
  });

  it('logger.error được gọi khi previewProductName ném lỗi', async () => {
    const mockLogger = require('@utils/logger');

    try {
      await service.previewProductName('Dell', [1]);
    } catch {
      // bỏ qua
    }

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error previewing'),
      expect.any(Error),
    );
  });
});
