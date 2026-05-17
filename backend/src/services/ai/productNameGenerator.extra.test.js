/**
 * Tests bổ sung cho ProductNameGeneratorService
 * Nhắm vào các nhánh chưa được cover:
 * - lines 6, 13: association setup khi chưa có (AttributeValue.belongsTo / AttributeGroup.hasMany)
 * - lines 107-108: generateVariantName() error catch → propagate
 * - lines 164-165: previewProductName() error catch → propagate
 */

// ── Tests với associations chưa được định nghĩa (lines 6, 13) ────────────────

describe('productNameGenerator module load — association setup khi chưa có', () => {
  it('gọi AttributeValue.belongsTo khi associations.attributeGroup chưa tồn tại (line 6)', () => {
    jest.resetModules();

    const mockBelongsTo = jest.fn();
    const mockHasMany = jest.fn();

    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));

    jest.mock('../../models', () => ({
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
    require('./productNameGenerator');

    expect(mockBelongsTo).toHaveBeenCalledTimes(1);
    expect(mockHasMany).toHaveBeenCalledTimes(1);
  });

  it('KHÔNG gọi belongsTo/hasMany khi associations đã tồn tại', () => {
    jest.resetModules();

    const mockBelongsTo = jest.fn();
    const mockHasMany = jest.fn();

    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));

    jest.mock('../../models', () => ({
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

    require('./productNameGenerator');

    expect(mockBelongsTo).not.toHaveBeenCalled();
    expect(mockHasMany).not.toHaveBeenCalled();
  });
});

// ── generateVariantName() error catch (lines 107-108) ─────────────────────────

describe('productNameGenerator — generateVariantName() error propagation (lines 107-108)', () => {
  let service;

  beforeEach(() => {
    jest.resetModules();

    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));

    jest.mock('../../models', () => ({
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

    service = require('./productNameGenerator');
  });

  it('AttributeValue.findAll throw trong generateVariantName → propagate lỗi (lines 107-108)', async () => {
    await expect(
      service.generateVariantName('MacBook', { colorGroup: 1 })
    ).rejects.toThrow('variant DB crash');
  });

  it('logger.error được gọi khi generateVariantName ném lỗi', async () => {
    const mockLogger = require('../../utils/logger');

    try {
      await service.generateVariantName('MacBook', { colorGroup: 1 });
    } catch {
      // bỏ qua — chỉ kiểm tra logger
    }

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error generating'),
      expect.any(Error)
    );
  });
});

// ── previewProductName() error catch (lines 164-165) ──────────────────────────

describe('productNameGenerator — previewProductName() error propagation (lines 164-165)', () => {
  let service;

  beforeEach(() => {
    jest.resetModules();

    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));

    jest.mock('../../models', () => ({
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

    service = require('./productNameGenerator');
  });

  it('AttributeValue.findAll throw trong previewProductName → propagate lỗi (lines 164-165)', async () => {
    await expect(
      service.previewProductName('Dell', [1, 2])
    ).rejects.toThrow('preview DB timeout');
  });

  it('logger.error được gọi khi previewProductName ném lỗi', async () => {
    const mockLogger = require('../../utils/logger');

    try {
      await service.previewProductName('Dell', [1]);
    } catch {
      // bỏ qua
    }

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error previewing'),
      expect.any(Error)
    );
  });
});
