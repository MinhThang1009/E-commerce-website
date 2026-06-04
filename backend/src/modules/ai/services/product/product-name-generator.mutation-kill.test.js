/**
 * product-name-generator.mutation-kill.test.js
 *
 * Bổ sung cho product-name-generator.test.js — kill mutant:
 *   - findAll args CHÍNH XÁC (where/include/order/attributes) cho 3 query method
 *     → kill hàng loạt BooleanLiteral/StringLiteral/ArrayDeclaration/ObjectLiteral
 *   - nameToAdd.trim() guard (whitespace-only → không push)
 *   - generateVariantName filter id falsy
 *   - previewProductName affectingAttributes mapping + optional chaining attributeGroup
 *   - logger.error message trong catch
 */

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockFindAll = jest.fn();
jest.mock('@models', () => ({
  AttributeValue: {
    associations: { attributeGroup: true },
    findAll: (...args) => mockFindAll(...args),
    belongsTo: jest.fn(),
  },
  AttributeGroup: {
    associations: { values: true },
    hasMany: jest.fn(),
  },
}));

const productNameGenerator = require('./product-name-generator');
const logger = require('@utils/logger');
const { AttributeGroup } = require('@models');

const makeAttrValue = (overrides = {}) => ({
  id: 1,
  name: 'Black',
  nameTemplate: null,
  affectsName: true,
  isActive: true,
  sortOrder: 1,
  attributeGroup: { id: 1, name: 'Color', type: 'color', sortOrder: 1 },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// findAll args chính xác
// ══════════════════════════════════════════════════════════════════════════════

describe('findAll query args', () => {
  it('generateProductName → where/include/order chính xác', async () => {
    mockFindAll.mockResolvedValue([makeAttrValue()]);
    await productNameGenerator.generateProductName('Base', [1, 2], ' ');

    expect(mockFindAll).toHaveBeenCalledTimes(1);
    expect(mockFindAll.mock.calls[0][0]).toEqual({
      where: { id: [1, 2], affectsName: true, isActive: true },
      include: [
        { model: AttributeGroup, as: 'attributeGroup', attributes: ['name', 'type', 'sortOrder'] },
      ],
      order: [
        [{ model: AttributeGroup, as: 'attributeGroup' }, 'sortOrder', 'ASC'],
        ['sortOrder', 'ASC'],
      ],
    });
  });

  it('previewProductName includeDetails → findAll lần 2 args chính xác', async () => {
    mockFindAll.mockResolvedValueOnce([makeAttrValue()]).mockResolvedValueOnce([makeAttrValue()]);
    await productNameGenerator.previewProductName('Base', [3], { includeDetails: true });

    expect(mockFindAll.mock.calls[1][0]).toEqual({
      where: { id: [3], affectsName: true, isActive: true },
      include: [
        { model: AttributeGroup, as: 'attributeGroup', attributes: ['id', 'name', 'type'] },
      ],
    });
  });

  it('getNameAffectingAttributes → where/include(nested where)/order chính xác', async () => {
    mockFindAll.mockResolvedValue([makeAttrValue()]);
    await productNameGenerator.getNameAffectingAttributes();

    expect(mockFindAll.mock.calls[0][0]).toEqual({
      where: { affectsName: true, isActive: true },
      include: [
        {
          model: AttributeGroup,
          as: 'attributeGroup',
          attributes: ['id', 'name', 'type', 'description'],
          where: { isActive: true },
        },
      ],
      order: [
        [{ model: AttributeGroup, as: 'attributeGroup' }, 'sortOrder', 'ASC'],
        ['sortOrder', 'ASC'],
      ],
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Logic build name
// ══════════════════════════════════════════════════════════════════════════════

describe('build name logic', () => {
  it('nameToAdd chỉ có khoảng trắng → KHÔNG nối vào tên (kill bỏ .trim() ở điều kiện)', async () => {
    mockFindAll.mockResolvedValue([makeAttrValue({ name: '   ', nameTemplate: null })]);
    const result = await productNameGenerator.generateProductName('Base', [1], ' ');
    expect(result).toBe('Base');
  });

  it('name có khoảng trắng bao quanh → trim khi nối (kill bỏ .trim() lúc push)', async () => {
    mockFindAll.mockResolvedValue([makeAttrValue({ name: '  Pro  ', nameTemplate: null })]);
    const result = await productNameGenerator.generateProductName('Base', [1], ' ');
    expect(result).toBe('Base Pro');
  });

  it('nameTemplate ưu tiên hơn name', async () => {
    mockFindAll.mockResolvedValue([makeAttrValue({ name: 'Black', nameTemplate: 'Đen' })]);
    const result = await productNameGenerator.generateProductName('Base', [1], ' ');
    expect(result).toBe('Base Đen');
  });

  it('generateVariantName lọc bỏ id falsy trước khi query', async () => {
    mockFindAll.mockResolvedValue([makeAttrValue()]);
    await productNameGenerator.generateVariantName('Base', { g1: 5, g2: 0, g3: null }, ' ');
    expect(mockFindAll.mock.calls[0][0].where.id).toEqual([5]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// previewProductName affectingAttributes mapping
// ══════════════════════════════════════════════════════════════════════════════

describe('previewProductName affectingAttributes', () => {
  it('map đúng id/name/nameTemplate/groupName/groupType', async () => {
    const attr = makeAttrValue({
      id: 7,
      name: 'Pro',
      nameTemplate: 'Pro Max',
      attributeGroup: { id: 2, name: 'Dòng', type: 'select' },
    });
    mockFindAll.mockResolvedValueOnce([attr]).mockResolvedValueOnce([attr]);
    const result = await productNameGenerator.previewProductName('Base', [7], {
      includeDetails: true,
    });

    expect(result.affectingAttributes).toEqual([
      { id: 7, name: 'Pro', nameTemplate: 'Pro Max', groupName: 'Dòng', groupType: 'select' },
    ]);
  });

  it('attr không có attributeGroup → groupName/groupType undefined, không crash', async () => {
    const attr = makeAttrValue({ id: 9, name: 'X', nameTemplate: null, attributeGroup: undefined });
    mockFindAll.mockResolvedValueOnce([attr]).mockResolvedValueOnce([attr]);
    const result = await productNameGenerator.previewProductName('Base', [9], {
      includeDetails: true,
    });

    expect(result.affectingAttributes).toEqual([
      { id: 9, name: 'X', nameTemplate: null, groupName: undefined, groupType: undefined },
    ]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// logger.error trong catch
// ══════════════════════════════════════════════════════════════════════════════

describe('logger.error messages', () => {
  it('getNameAffectingAttributes lỗi → log "Error getting name affecting attributes:"', async () => {
    const err = new Error('DB fail');
    mockFindAll.mockRejectedValue(err);
    await expect(productNameGenerator.getNameAffectingAttributes()).rejects.toThrow('DB fail');
    expect(logger.error).toHaveBeenCalledWith('Error getting name affecting attributes:', err);
  });

  it('batchGenerateNames lỗi → log "Error batch generating names:"', async () => {
    const err = new Error('DB fail');
    mockFindAll.mockRejectedValue(err);
    await expect(
      productNameGenerator.batchGenerateNames([{ id: 1, baseName: 'B', selectedAttributes: [1] }]),
    ).rejects.toThrow('DB fail');
    expect(logger.error).toHaveBeenCalledWith('Error batch generating names:', err);
  });
});
