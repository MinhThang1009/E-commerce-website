// Attribute service — mutation-kill: assert OUTCOME (message tiếng Việt cụ thể,
// soft-delete isActive:false, getPopular map shape, generateNameRealTime
// array/object/null + options + productId branch). KHÔNG tautological.

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

beforeEach(() => {
  jest.clearAllMocks();
  service.setNameGenerator(null);
});

// ── message cụ thể cho từng guard not-found ────────────────────
describe('message not-found cụ thể', () => {
  test('getProductAttributeGroups: product null → "Không tìm thấy sản phẩm" 404', async () => {
    repo.findProductWithGroups.mockResolvedValue(null);
    await expect(service.getProductAttributeGroups(9)).rejects.toThrow('Không tìm thấy sản phẩm');
  });

  test('updateGroup: group null → "Không tìm thấy nhóm thuộc tính" 404', async () => {
    repo.findGroupById.mockResolvedValue(null);
    await expect(service.updateGroup(1, {})).rejects.toThrow('Không tìm thấy nhóm thuộc tính');
  });

  test('deleteGroup: group null → "Không tìm thấy nhóm thuộc tính" 404', async () => {
    repo.findGroupById.mockResolvedValue(null);
    await expect(service.deleteGroup(1)).rejects.toThrow('Không tìm thấy nhóm thuộc tính');
  });

  test('addValue: group null → "Không tìm thấy nhóm thuộc tính" 404', async () => {
    repo.findGroupById.mockResolvedValue(null);
    await expect(service.addValue({ attributeGroupId: 1 })).rejects.toThrow(
      'Không tìm thấy nhóm thuộc tính',
    );
  });

  test('updateValue: value null → "Không tìm thấy giá trị thuộc tính" 404', async () => {
    repo.findValueById.mockResolvedValue(null);
    await expect(service.updateValue(1, {})).rejects.toThrow('Không tìm thấy giá trị thuộc tính');
  });

  test('deleteValue: value null → "Không tìm thấy giá trị thuộc tính" 404', async () => {
    repo.findValueById.mockResolvedValue(null);
    await expect(service.deleteValue(1)).rejects.toThrow('Không tìm thấy giá trị thuộc tính');
  });
});

// ── soft-delete: update({ isActive: false }) ───────────────────
describe('soft-delete set isActive=false', () => {
  test('deleteGroup → group.update({ isActive: false })', async () => {
    const group = { update: jest.fn().mockResolvedValue() };
    repo.findGroupById.mockResolvedValue(group);
    await service.deleteGroup(1);
    expect(group.update).toHaveBeenCalledWith({ isActive: false });
  });

  test('deleteValue → value.update({ isActive: false })', async () => {
    const value = { update: jest.fn().mockResolvedValue() };
    repo.findValueById.mockResolvedValue(value);
    await service.deleteValue(1);
    expect(value.update).toHaveBeenCalledWith({ isActive: false });
  });

  test('addValue: group tồn tại → createValue được gọi với data', async () => {
    repo.findGroupById.mockResolvedValue({ id: 1 });
    repo.createValue.mockResolvedValue({ id: 5 });
    const data = { attributeGroupId: 1, name: 'Đỏ' };
    const result = await service.addValue(data);
    expect(repo.createValue).toHaveBeenCalledWith(data);
    expect(result).toEqual({ id: 5 });
  });
});

// ── name generation guard: "Name generator chưa được khởi tạo" ──
describe('name-gen guard 500 message', () => {
  test('previewProductName chưa init → "Name generator chưa được khởi tạo"', () => {
    expect(() => service.previewProductName('x', [], {})).toThrow(
      'Name generator chưa được khởi tạo',
    );
  });

  test('getNameAffectingAttributes chưa init → message', () => {
    expect(() => service.getNameAffectingAttributes(1)).toThrow(
      'Name generator chưa được khởi tạo',
    );
  });

  test('batchGenerateNames chưa init → message', () => {
    expect(() => service.batchGenerateNames([], ' ')).toThrow('Name generator chưa được khởi tạo');
  });
});

// ── generateNameRealTime: array/object/null + options + productId ─
describe('generateNameRealTime', () => {
  function genMock() {
    return { previewProductName: jest.fn().mockResolvedValue({ name: 'Áo Pro' }) };
  }

  test('attributeValues là MẢNG → dùng nguyên mảng (KHÔNG filter) (L93 cond→false)', async () => {
    const gen = genMock();
    service.setNameGenerator(gen);

    await service.generateNameRealTime('Áo', [5, 0, 7], null);

    // mảng truyền verbatim — mutant "luôn Object.values().filter" sẽ thành [5,7]
    expect(gen.previewProductName).toHaveBeenCalledWith('Áo', [5, 0, 7], {
      separator: ' ',
      includeDetails: true,
    });
  });

  test('attributeValues là OBJECT → Object.values + filter falsy (L93 cond→true/filter)', async () => {
    const gen = genMock();
    service.setNameGenerator(gen);

    await service.generateNameRealTime('Áo', { color: 1, size: null, material: 3 }, null);

    // mutant cond→true (dùng object), filter→[] hoặc no-filter ([1,null,3]) đều khác [1,3]
    expect(gen.previewProductName).toHaveBeenCalledWith('Áo', [1, 3], expect.any(Object));
  });

  test('attributeValues null → [] (Object.values(null||{}))', async () => {
    const gen = genMock();
    service.setNameGenerator(gen);

    await service.generateNameRealTime('Áo', null, null);

    expect(gen.previewProductName).toHaveBeenCalledWith('Áo', [], expect.any(Object));
  });

  test('options: separator " " + includeDetails true (L95/96/97)', async () => {
    const gen = genMock();
    service.setNameGenerator(gen);

    await service.generateNameRealTime('Áo', [1], null);

    expect(gen.previewProductName).toHaveBeenCalledWith('Áo', [1], {
      separator: ' ',
      includeDetails: true,
    });
  });

  test('có productId → lấy suggestions từ recent variants (L101)', async () => {
    const gen = genMock();
    service.setNameGenerator(gen);
    repo.findRecentVariants.mockResolvedValue([
      { attributeValues: ['x'], displayName: 'd', name: 'n' },
    ]);

    const result = await service.generateNameRealTime('Áo', [1], 42);

    expect(repo.findRecentVariants).toHaveBeenCalledWith(42);
    expect(result.suggestions).toEqual([
      { attributeValues: ['x'], displayName: 'd', fullName: 'n' },
    ]);
    expect(result.name).toBe('Áo Pro'); // spread từ preview
    expect(typeof result.timestamp).toBe('string');
  });

  test('KHÔNG có productId → suggestions = [] (không gọi recent variants)', async () => {
    const gen = genMock();
    service.setNameGenerator(gen);

    const result = await service.generateNameRealTime('Áo', [1], null);

    expect(repo.findRecentVariants).not.toHaveBeenCalled();
    expect(result.suggestions).toEqual([]);
  });

  test('productId + recent variants throw → suggestions [] + log info (catch L70)', async () => {
    const gen = genMock();
    service.setNameGenerator(gen);
    repo.findRecentVariants.mockRejectedValue(new Error('db lỗi'));

    const result = await service.generateNameRealTime('Áo', [1], 42);

    expect(result.suggestions).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith('Không thể lấy tổ hợp phổ biến:', 'db lỗi');
  });
});
