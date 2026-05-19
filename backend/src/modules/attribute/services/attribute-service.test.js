process.env.NODE_ENV = 'test';

jest.mock('@modules/attribute/repositories/sequelize-attribute-repository');
jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const repo = require('@modules/attribute/repositories/sequelize-attribute-repository');
const logger = require('@utils/logger');
const service = require('./attribute-service');
const { AppError } = require('@shared/errors');

beforeEach(() => {
  jest.clearAllMocks();
  // Reset nameGenerator giữa các test
  service.setNameGenerator(null);
});

// ─── setNameGenerator + previewProductName ────────────────────────────────────

describe('previewProductName', () => {
  it('throw 500 khi nameGenerator chưa được set', async () => {
    await expect(() => service.previewProductName('Laptop', [], {})).toThrow(AppError);
  });

  it('gọi nameGenerator.previewProductName khi đã được inject', async () => {
    const gen = { previewProductName: jest.fn().mockResolvedValue({ name: 'Laptop Pro' }) };
    service.setNameGenerator(gen);
    const result = await service.previewProductName('Laptop', [1, 2], { separator: ' ' });
    expect(gen.previewProductName).toHaveBeenCalledWith('Laptop', [1, 2], { separator: ' ' });
    expect(result).toEqual({ name: 'Laptop Pro' });
  });
});

// ─── getNameAffectingAttributes ───────────────────────────────────────────────

describe('getNameAffectingAttributes', () => {
  it('throw 500 khi nameGenerator chưa được set', () => {
    expect(() => service.getNameAffectingAttributes(1)).toThrow(AppError);
  });

  it('delegate sang nameGenerator khi đã inject', () => {
    const gen = { getNameAffectingAttributes: jest.fn().mockReturnValue([]) };
    service.setNameGenerator(gen);
    service.getNameAffectingAttributes(1);
    expect(gen.getNameAffectingAttributes).toHaveBeenCalledWith(1);
  });
});

// ─── batchGenerateNames ───────────────────────────────────────────────────────

describe('batchGenerateNames', () => {
  it('throw 500 khi nameGenerator chưa được set', () => {
    expect(() => service.batchGenerateNames([], ' ')).toThrow(AppError);
  });

  it('delegate sang nameGenerator khi đã inject', () => {
    const gen = { batchGenerateNames: jest.fn().mockReturnValue([]) };
    service.setNameGenerator(gen);
    service.batchGenerateNames([{ baseName: 'A' }], '-');
    expect(gen.batchGenerateNames).toHaveBeenCalledWith([{ baseName: 'A' }], '-');
  });
});

// ─── getAttributeGroups ───────────────────────────────────────────────────────

describe('getAttributeGroups', () => {
  it('trả về danh sách nhóm từ repo', async () => {
    repo.findAllGroups.mockResolvedValue([{ id: 1 }]);
    const result = await service.getAttributeGroups();
    expect(result).toEqual([{ id: 1 }]);
  });
});

// ─── getProductAttributeGroups ────────────────────────────────────────────────

describe('getProductAttributeGroups', () => {
  it('throw 404 khi sản phẩm không tồn tại', async () => {
    repo.findProductWithGroups.mockResolvedValue(null);
    await expect(service.getProductAttributeGroups(99)).rejects.toThrow(AppError);
  });

  it('trả về attributeGroups của sản phẩm', async () => {
    repo.findProductWithGroups.mockResolvedValue({ attributeGroups: [{ id: 1 }] });
    const result = await service.getProductAttributeGroups(1);
    expect(result).toEqual([{ id: 1 }]);
  });
});

// ─── createGroup ─────────────────────────────────────────────────────────────

describe('createGroup', () => {
  it('gọi repo.createGroup', async () => {
    repo.createGroup.mockResolvedValue({ id: 1, name: 'Màu sắc' });
    const result = await service.createGroup({ name: 'Màu sắc' });
    expect(result.id).toBe(1);
  });
});

// ─── updateGroup ─────────────────────────────────────────────────────────────

describe('updateGroup', () => {
  it('throw 404 khi nhóm không tồn tại', async () => {
    repo.findGroupById.mockResolvedValue(null);
    await expect(service.updateGroup(99, {})).rejects.toThrow(AppError);
  });

  it('cập nhật và trả về nhóm', async () => {
    const group = { id: 1, update: jest.fn().mockResolvedValue() };
    repo.findGroupById.mockResolvedValue(group);
    const result = await service.updateGroup(1, { name: 'Size' });
    expect(group.update).toHaveBeenCalledWith({ name: 'Size' });
    expect(result).toBe(group);
  });
});

// ─── deleteGroup ─────────────────────────────────────────────────────────────

describe('deleteGroup', () => {
  it('throw 404 khi nhóm không tồn tại', async () => {
    repo.findGroupById.mockResolvedValue(null);
    await expect(service.deleteGroup(99)).rejects.toThrow(AppError);
  });

  it('soft-delete bằng isActive=false', async () => {
    const group = { id: 1, update: jest.fn().mockResolvedValue() };
    repo.findGroupById.mockResolvedValue(group);
    await service.deleteGroup(1);
    expect(group.update).toHaveBeenCalledWith({ isActive: false });
  });
});

// ─── addValue ────────────────────────────────────────────────────────────────

describe('addValue', () => {
  it('gọi repo.createValue', async () => {
    repo.createValue.mockResolvedValue({ id: 5 });
    const result = await service.addValue({ value: 'Đỏ' });
    expect(result.id).toBe(5);
  });
});

// ─── updateValue ─────────────────────────────────────────────────────────────

describe('updateValue', () => {
  it('throw 404 khi giá trị không tồn tại', async () => {
    repo.findValueById.mockResolvedValue(null);
    await expect(service.updateValue(99, {})).rejects.toThrow(AppError);
  });

  it('cập nhật và trả về giá trị', async () => {
    const value = { id: 1, update: jest.fn().mockResolvedValue() };
    repo.findValueById.mockResolvedValue(value);
    const result = await service.updateValue(1, { value: 'Xanh' });
    expect(value.update).toHaveBeenCalledWith({ value: 'Xanh' });
    expect(result).toBe(value);
  });
});

// ─── deleteValue ─────────────────────────────────────────────────────────────

describe('deleteValue', () => {
  it('throw 404 khi giá trị không tồn tại', async () => {
    repo.findValueById.mockResolvedValue(null);
    await expect(service.deleteValue(99)).rejects.toThrow(AppError);
  });

  it('soft-delete bằng isActive=false', async () => {
    const value = { id: 1, update: jest.fn().mockResolvedValue() };
    repo.findValueById.mockResolvedValue(value);
    await service.deleteValue(1);
    expect(value.update).toHaveBeenCalledWith({ isActive: false });
  });
});

// ─── assignGroupToProduct ────────────────────────────────────────────────────

describe('assignGroupToProduct', () => {
  it('gọi repo.createProductGroupAssignment', async () => {
    repo.createProductGroupAssignment.mockResolvedValue({ id: 1 });
    await service.assignGroupToProduct({ productId: 1, groupId: 2 });
    expect(repo.createProductGroupAssignment).toHaveBeenCalled();
  });
});

// getPopularAttributeCombinations là internal — test qua generateNameRealTime

// ─── generateNameRealTime ─────────────────────────────────────────────────────

describe('generateNameRealTime', () => {
  beforeEach(() => {
    const gen = {
      previewProductName: jest.fn().mockResolvedValue({ name: 'Laptop Đỏ', parts: [] }),
      getNameAffectingAttributes: jest.fn(),
      batchGenerateNames: jest.fn(),
    };
    service.setNameGenerator(gen);
  });

  it('nhận attributeValues là mảng', async () => {
    repo.findRecentVariants.mockResolvedValue([]);
    const result = await service.generateNameRealTime('Laptop', [1, 2], null);
    expect(result).toMatchObject({ name: 'Laptop Đỏ', suggestions: [] });
    expect(result.timestamp).toBeDefined();
  });

  it('nhận attributeValues là object → filter falsy', async () => {
    repo.findRecentVariants.mockResolvedValue([]);
    const result = await service.generateNameRealTime('Laptop', { a: 1, b: null, c: 2 }, null);
    expect(result.name).toBe('Laptop Đỏ');
  });

  it('gọi getPopularAttributeCombinations khi có productId', async () => {
    repo.findRecentVariants.mockResolvedValue([
      { attributeValues: [1], displayName: 'Đỏ', name: 'SP Đỏ' },
    ]);
    const result = await service.generateNameRealTime('Laptop', [], 5);
    expect(result.suggestions).toHaveLength(1);
  });

  it('suggestions rỗng khi getPopularAttributeCombinations throw', async () => {
    repo.findRecentVariants.mockRejectedValue(new Error('DB lỗi'));
    const result = await service.generateNameRealTime('Laptop', [], 5);
    expect(result.suggestions).toEqual([]);
    expect(logger.info).toHaveBeenCalled();
  });
});

// ─── generateNameRealTime — falsy attributeValues ─────────────────────────────

describe('generateNameRealTime — falsy attributeValues', () => {
  beforeEach(() => {
    const gen = {
      previewProductName: jest.fn().mockResolvedValue({ name: 'Laptop', parts: [] }),
    };
    service.setNameGenerator(gen);
    repo.findRecentVariants.mockResolvedValue([]);
  });

  it('null attributeValues → Object.values(null || {}) = []', async () => {
    const result = await service.generateNameRealTime('Laptop', null, null);
    expect(result.name).toBe('Laptop');
  });
});
