/**
 * @file discountCodeRepository.test.js
 * @layer Test
 * @module discountCode
 * @description Tests cho discountCodeRepository — cover tất cả branches của data access layer
 */

const { Op } = require('sequelize');

// Mock models
const mockDiscount = {
  destroy: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue({}),
};

jest.mock('../../../models', () => ({
  DiscountCode: {
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    increment: jest.fn(),
  },
}));

const { DiscountCode } = require('../../../models');
const repo = require('./discountCodeRepository');

describe('discountCodeRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('gọi DiscountCode.findAndCountAll với đúng options', async () => {
      DiscountCode.findAndCountAll.mockResolvedValue({ count: 2, rows: [{ id: 1 }, { id: 2 }] });
      const opts = { where: { isActive: true }, limit: 10, offset: 0, order: [['createdAt', 'DESC']] };

      const result = await repo.findAll(opts);

      expect(DiscountCode.findAndCountAll).toHaveBeenCalledWith(opts);
      expect(result.count).toBe(2);
      expect(result.rows).toHaveLength(2);
    });

    it('trả về count 0 khi không có kết quả', async () => {
      DiscountCode.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      const result = await repo.findAll({ where: {}, limit: 10, offset: 0 });
      expect(result.count).toBe(0);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('trả về discount code khi tìm thấy', async () => {
      const mockCode = { id: 'abc-123', code: 'SALE20' };
      DiscountCode.findByPk.mockResolvedValue(mockCode);

      const result = await repo.findById('abc-123');

      expect(DiscountCode.findByPk).toHaveBeenCalledWith('abc-123');
      expect(result).toEqual(mockCode);
    });

    it('trả về null khi không tìm thấy', async () => {
      DiscountCode.findByPk.mockResolvedValue(null);
      const result = await repo.findById('not-exist');
      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('tìm theo code và isActive', async () => {
      const mockCode = { id: '1', code: 'SUMMER', isActive: true };
      DiscountCode.findOne.mockResolvedValue(mockCode);

      const result = await repo.findOne({ code: 'SUMMER', isActive: true });

      expect(DiscountCode.findOne).toHaveBeenCalledWith({ where: { code: 'SUMMER', isActive: true } });
      expect(result.code).toBe('SUMMER');
    });

    it('trả về null khi không khớp', async () => {
      DiscountCode.findOne.mockResolvedValue(null);
      const result = await repo.findOne({ code: 'EXPIRED' });
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('tạo mã giảm giá mới với đúng dữ liệu', async () => {
      const newCode = { id: 'new-id', code: 'NEW10', type: 'percent', value: 10 };
      DiscountCode.create.mockResolvedValue(newCode);

      const data = { code: 'NEW10', type: 'percent', value: 10, isActive: true };
      const result = await repo.create(data);

      expect(DiscountCode.create).toHaveBeenCalledWith(data);
      expect(result.code).toBe('NEW10');
    });
  });

  describe('remove', () => {
    it('gọi destroy trên instance', async () => {
      const fakeCode = { id: '1', destroy: jest.fn().mockResolvedValue(undefined) };

      await repo.remove(fakeCode);

      expect(fakeCode.destroy).toHaveBeenCalled();
    });
  });

  describe('incrementUsedCount', () => {
    it('gọi DiscountCode.increment với đúng id', async () => {
      DiscountCode.increment.mockResolvedValue({});

      await repo.incrementUsedCount('code-id-123');

      expect(DiscountCode.increment).toHaveBeenCalledWith(
        'usedCount',
        { where: { id: 'code-id-123' } },
      );
    });
  });

  describe('getOp', () => {
    it('trả về Sequelize Op operators', () => {
      const op = repo.getOp();
      expect(op).toBeDefined();
      expect(op.like).toBeDefined(); // Op.like phải tồn tại
    });
  });
});
