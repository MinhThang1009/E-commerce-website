/**
 * Unit tests cho ProductNameGeneratorService
 * (src/services/ai/productNameGenerator.js)
 *
 * Mock: AttributeValue.findAll, AttributeGroup (models)
 * Phủ: generateProductName, generateVariantName, previewProductName,
 *       getNameAffectingAttributes, batchGenerateNames
 */

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock models — service require '../../models'
// Biến mock phải được khai báo TRONG factory function để tránh lỗi hoisting với jest.mock
const mockAttributeValueFindAll = jest.fn();

jest.mock('../../models', () => ({
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
const productNameGenerator = require('./productNameGenerator');

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
    await expect(
      productNameGenerator.generateProductName('', [1])
    ).rejects.toThrow('Base name is required');
  });

  it('baseName null → throw Error', async () => {
    await expect(
      productNameGenerator.generateProductName(null, [1])
    ).rejects.toThrow('Base name is required');
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
    mockAttributeValueFindAll.mockResolvedValue([
      makeAttrValue({ name: 'White' }),
    ]);

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

    await expect(
      productNameGenerator.generateProductName('MacBook', [1])
    ).rejects.toThrow('DB connection lost');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateVariantName()', () => {
  it('truyền attributesCombination object → delegate sang generateProductName', async () => {
    mockAttributeValueFindAll.mockResolvedValue([
      makeAttrValue({ name: 'Red' }),
    ]);

    // attributesCombination: { groupId: valueId }
    const result = await productNameGenerator.generateVariantName(
      'iPhone 17',
      { colorGroup: 1 }
    );

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
    mockAttributeValueFindAll.mockResolvedValue([
      makeAttrValue({ name: 'Blue' }),
    ]);

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
    mockAttributeValueFindAll.mockResolvedValue([
      makeAttrValue({ name: 'Silver' }),
    ]);

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
    const attrs = [
      makeAttrValue({ id: 1, name: 'Red' }),
      makeAttrValue({ id: 2, name: '8GB' }),
    ];
    mockAttributeValueFindAll.mockResolvedValue(attrs);

    const result = await productNameGenerator.getNameAffectingAttributes();

    expect(result).toBe(attrs);
    expect(mockAttributeValueFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ affectsName: true, isActive: true }),
      })
    );
  });

  it('không có attribute nào → trả về mảng rỗng', async () => {
    mockAttributeValueFindAll.mockResolvedValue([]);

    const result = await productNameGenerator.getNameAffectingAttributes();

    expect(result).toEqual([]);
  });

  it('DB throw → propagate error', async () => {
    mockAttributeValueFindAll.mockRejectedValue(new Error('timeout'));

    await expect(
      productNameGenerator.getNameAffectingAttributes()
    ).rejects.toThrow('timeout');
  });

  it('gọi AttributeValue.findAll với include AttributeGroup', async () => {
    mockAttributeValueFindAll.mockResolvedValue([]);
    await productNameGenerator.getNameAffectingAttributes();

    expect(mockAttributeValueFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ as: 'attributeGroup' }),
        ]),
      })
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

    const items = [
      { id: 1, baseName: 'MacBook', selectedAttributes: [1] },
    ];

    const results = await productNameGenerator.batchGenerateNames(items, '-');

    expect(results[0].generatedName).toBe('MacBook-Pro');
  });

  it('một item throw → propagate error', async () => {
    mockAttributeValueFindAll.mockRejectedValue(new Error('DB error'));

    await expect(
      productNameGenerator.batchGenerateNames([
        { id: 1, baseName: 'Test', selectedAttributes: [99] },
      ])
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
    const logger = require('../../utils/logger');
    logger.error.mockClear();

    // Object.values(null) throw TypeError đồng bộ → catch trong generateVariantName kích hoạt
    await expect(
      productNameGenerator.generateVariantName('Phone', null)
    ).rejects.toThrow(TypeError);

    expect(logger.error).toHaveBeenCalledWith(
      'Error generating variant name:',
      expect.any(TypeError)
    );
  });

  it('catch block không nuốt lỗi — caller nhận được lỗi gốc', async () => {
    // Truyền null để bypass default parameter — Object.values(null) throw TypeError
    await expect(
      productNameGenerator.generateVariantName('Laptop', null)
    ).rejects.toBeInstanceOf(TypeError);
  });
});
