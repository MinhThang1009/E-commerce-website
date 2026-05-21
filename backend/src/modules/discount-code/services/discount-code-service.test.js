/**
 * @file discountCodeService.test.js
 * @layer Test
 * @module discountCode
 * @description Tests cho discountCodeService — business logic của mã giảm giá
 */

const { Op } = require('sequelize');
jest.mock('@modules/discount-code/repositories/sequelize-discount-code-repository');

jest.mock('@shared/admin-audit', () => ({
  AdminAuditService: {
    logDiscountCodeAction: jest.fn(),
  },
}));

const discountCodeRepository = require('@modules/discount-code/repositories/sequelize-discount-code-repository');
discountCodeRepository.getOp = jest.fn().mockReturnValue(Op);

const { AdminAuditService } = require('@shared/admin-audit');
const discountCodeService = require('./discount-code-service');

function makeCode(overrides = {}) {
  return {
    id: 'code-id-1',
    code: 'SUMMER20',
    type: 'percent',
    value: 20,
    minOrderAmount: 100000,
    maxDiscountAmount: 50000,
    usageLimit: 10,
    usedCount: 0,
    isActive: true,
    startDate: null,
    endDate: null,
    update: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('discountCodeService.getAllDiscountCodes', () => {
  it('trả về danh sách với pagination đúng', async () => {
    discountCodeRepository.findAll.mockResolvedValue({
      count: 25,
      rows: [makeCode(), makeCode({ id: '2', code: 'WINTER10' })],
    });

    const result = await discountCodeService.getAllDiscountCodes({ page: 2, limit: 10 });

    expect(discountCodeRepository.findAll).toHaveBeenCalled();
    expect(result.pagination.currentPage).toBe(2);
    expect(result.pagination.totalPages).toBe(3);
    expect(result.pagination.totalItems).toBe(25);
  });

  it('filter theo search và isActive', async () => {
    discountCodeRepository.findAll.mockResolvedValue({ count: 1, rows: [makeCode()] });

    await discountCodeService.getAllDiscountCodes({ search: 'SUM', isActive: 'true' });

    const callArgs = discountCodeRepository.findAll.mock.calls[0][0];
    expect(callArgs.where).toHaveProperty('code');
    expect(callArgs.where.isActive).toBe(true);
  });

  it('không filter khi search rỗng và isActive undefined', async () => {
    discountCodeRepository.findAll.mockResolvedValue({ count: 5, rows: [] });

    await discountCodeService.getAllDiscountCodes({});

    const callArgs = discountCodeRepository.findAll.mock.calls[0][0];
    expect(callArgs.where).toEqual({});
  });
});

describe('discountCodeService.getDiscountCodeById', () => {
  it('trả về code khi tìm thấy', async () => {
    const code = makeCode();
    discountCodeRepository.findById.mockResolvedValue(code);

    const result = await discountCodeService.getDiscountCodeById('code-id-1');

    expect(result).toEqual(code);
  });

  it('ném AppError 404 khi không tìm thấy', async () => {
    discountCodeRepository.findById.mockResolvedValue(null);

    await expect(discountCodeService.getDiscountCodeById('not-exist')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('discountCodeService.createDiscountCode', () => {
  it('tạo code thành công và ghi audit log', async () => {
    discountCodeRepository.findOne.mockResolvedValue(null); // không trùng
    const newCode = makeCode({ id: 'new-id' });
    discountCodeRepository.create.mockResolvedValue(newCode);

    const actor = { id: 1, email: 'admin@test.com' };
    const result = await discountCodeService.createDiscountCode(
      { code: 'SUMMER20', type: 'percent', value: 20 },
      actor,
    );

    expect(result.id).toBe('new-id');
    expect(AdminAuditService.logDiscountCodeAction).toHaveBeenCalledWith(
      actor,
      'CREATE',
      'new-id',
      'SUMMER20',
    );
  });

  it('ném AppError 400 khi mã đã tồn tại', async () => {
    discountCodeRepository.findOne.mockResolvedValue(makeCode());

    await expect(
      discountCodeService.createDiscountCode({ code: 'SUMMER20', type: 'percent', value: 20 }, {}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('discountCodeService.updateDiscountCode', () => {
  it('update thành công — audit action UPDATE', async () => {
    const code = makeCode({ isActive: true });
    discountCodeRepository.findById.mockResolvedValue(code);
    discountCodeRepository.findOne.mockResolvedValue(null);

    const actor = { id: 1 };
    await discountCodeService.updateDiscountCode('code-id-1', { isActive: true }, actor);

    expect(AdminAuditService.logDiscountCodeAction).toHaveBeenCalledWith(
      actor,
      'UPDATE',
      'code-id-1',
      code.code,
    );
  });

  it('audit action DEACTIVATE khi isActive chuyển từ true → false', async () => {
    const code = makeCode({ isActive: true });
    discountCodeRepository.findById.mockResolvedValue(code);
    discountCodeRepository.findOne.mockResolvedValue(null);

    const actor = { id: 1 };
    await discountCodeService.updateDiscountCode('code-id-1', { isActive: false }, actor);

    expect(AdminAuditService.logDiscountCodeAction).toHaveBeenCalledWith(
      actor,
      'DEACTIVATE',
      'code-id-1',
      code.code,
    );
  });

  it('ném 400 khi đổi code thành mã đã tồn tại', async () => {
    discountCodeRepository.findById.mockResolvedValue(makeCode({ code: 'OLD' }));
    discountCodeRepository.findOne.mockResolvedValue(makeCode({ code: 'NEW' }));

    await expect(
      discountCodeService.updateDiscountCode('1', { code: 'NEW' }, {}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('discountCodeService.deleteDiscountCode', () => {
  it('xóa thành công và ghi audit log', async () => {
    const code = makeCode();
    discountCodeRepository.findById.mockResolvedValue(code);
    discountCodeRepository.remove.mockResolvedValue(undefined);

    const actor = { id: 1 };
    await discountCodeService.deleteDiscountCode('code-id-1', actor);

    expect(discountCodeRepository.remove).toHaveBeenCalledWith(code);
    expect(AdminAuditService.logDiscountCodeAction).toHaveBeenCalledWith(
      actor,
      'DELETE',
      'code-id-1',
      code.code,
    );
  });

  it('ném 404 khi không tìm thấy code', async () => {
    discountCodeRepository.findById.mockResolvedValue(null);

    await expect(discountCodeService.deleteDiscountCode('not-exist', {})).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('discountCodeService.applyDiscountCode', () => {
  it('tính đúng tiền giảm kiểu percent', async () => {
    const code = makeCode({
      type: 'percent',
      value: 20,
      maxDiscountAmount: 100000,
      minOrderAmount: 0,
    });
    discountCodeRepository.findOne.mockResolvedValue(code);

    const result = await discountCodeService.applyDiscountCode('SUMMER20', 500000);

    expect(result.discountAmount).toBe(100000); // 20% * 500000 = 100000 (capped at maxDiscountAmount)
  });

  it('tính đúng tiền giảm kiểu fixed', async () => {
    const code = makeCode({
      type: 'fixed',
      value: 50000,
      minOrderAmount: 0,
      maxDiscountAmount: null,
    });
    discountCodeRepository.findOne.mockResolvedValue(code);

    const result = await discountCodeService.applyDiscountCode('FIXED50', 300000);

    expect(result.discountAmount).toBe(50000);
  });

  it('cap discountAmount không vượt quá orderAmount', async () => {
    const code = makeCode({
      type: 'fixed',
      value: 999999,
      minOrderAmount: 0,
      maxDiscountAmount: null,
    });
    discountCodeRepository.findOne.mockResolvedValue(code);

    const result = await discountCodeService.applyDiscountCode('HUGE', 100000);

    expect(result.discountAmount).toBe(100000); // capped at orderAmount
  });

  it('ném 400 khi mã không tồn tại', async () => {
    discountCodeRepository.findOne.mockResolvedValue(null);

    await expect(discountCodeService.applyDiscountCode('INVALID', 100000)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('ném 400 khi mã chưa đến ngày bắt đầu', async () => {
    const futureDate = new Date(Date.now() + 86400000); // tomorrow
    const code = makeCode({ startDate: futureDate });
    discountCodeRepository.findOne.mockResolvedValue(code);

    await expect(discountCodeService.applyDiscountCode('FUTURE', 100000)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('ném 400 khi mã đã hết hạn', async () => {
    const pastDate = new Date(Date.now() - 86400000); // yesterday
    const code = makeCode({ endDate: pastDate });
    discountCodeRepository.findOne.mockResolvedValue(code);

    await expect(discountCodeService.applyDiscountCode('EXPIRED', 100000)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('ném 400 khi đã đạt giới hạn lượt dùng', async () => {
    const code = makeCode({ usageLimit: 5, usedCount: 5 });
    discountCodeRepository.findOne.mockResolvedValue(code);

    await expect(discountCodeService.applyDiscountCode('MAXED', 100000)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('ném 400 khi đơn hàng không đủ giá trị tối thiểu', async () => {
    const code = makeCode({ minOrderAmount: 500000 });
    discountCodeRepository.findOne.mockResolvedValue(code);

    await expect(discountCodeService.applyDiscountCode('MIN500', 100000)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
