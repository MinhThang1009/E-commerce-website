/**
 * @file discount-code-service.mutation-kill.test.js
 * @layer Test (mutation-strengthening)
 * @description Test nhắm các mutant SỐNG (Stryker) ở applyDiscountCode (date/usageLimit/cap branch)
 *   + getAllDiscountCodes (where/pagination) — assert OUTCOME để nâng mutation score qua break=70.
 *   KHÔNG nhắm equivalent mutants (`>` -> `>=` ở cap khi 2 vế bằng nhau, date-exact-boundary) —
 *   chúng không thể giết bằng outcome, để survive có chủ đích.
 */
const { Op } = require('sequelize');
jest.mock('@modules/discount-code/repositories/sequelize-discount-code-repository');
const discountCodeRepository = require('@modules/discount-code/repositories/sequelize-discount-code-repository');
discountCodeRepository.getOp = jest.fn().mockReturnValue(Op);
const discountCodeService = require('./discount-code-service');

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.useRealTimers());

function activeCode(overrides = {}) {
  return {
    id: 'c1',
    code: 'SALE',
    type: 'percent',
    value: 20,
    minOrderAmount: 0,
    maxDiscountAmount: null,
    usageLimit: null,
    usedCount: 0,
    isActive: true,
    startDate: null,
    endDate: null,
    ...overrides,
  };
}

describe('applyDiscountCode — validate date/usageLimit (giết ConditionalExpression/Logical/Equality L239-245)', () => {
  it('từ chối khi startDate ở tương lai (chưa đến thời gian)', async () => {
    discountCodeRepository.findOne.mockResolvedValue(
      activeCode({ startDate: '2099-01-01T00:00:00Z' }),
    );
    await expect(discountCodeService.applyDiscountCode('SALE', 1000000)).rejects.toThrow(
      /chưa đến thời gian/i,
    );
  });

  it('chấp nhận khi startDate ở quá khứ', async () => {
    discountCodeRepository.findOne.mockResolvedValue(
      activeCode({ startDate: '2000-01-01T00:00:00Z' }),
    );
    const r = await discountCodeService.applyDiscountCode('SALE', 1000000);
    expect(r.discountAmount).toBe(200000); // 20% * 1tr, không cap
  });

  it('từ chối khi endDate đã qua (đã hết hạn)', async () => {
    discountCodeRepository.findOne.mockResolvedValue(
      activeCode({ endDate: '2000-01-01T00:00:00Z' }),
    );
    await expect(discountCodeService.applyDiscountCode('SALE', 1000000)).rejects.toThrow(
      /hết hạn/i,
    );
  });

  it('chấp nhận khi endDate còn xa', async () => {
    discountCodeRepository.findOne.mockResolvedValue(
      activeCode({ endDate: '2099-01-01T00:00:00Z' }),
    );
    const r = await discountCodeService.applyDiscountCode('SALE', 1000000);
    expect(r.discountAmount).toBe(200000);
  });

  it('từ chối khi đã đạt giới hạn lượt dùng (usedCount >= usageLimit)', async () => {
    discountCodeRepository.findOne.mockResolvedValue(activeCode({ usageLimit: 5, usedCount: 5 }));
    await expect(discountCodeService.applyDiscountCode('SALE', 1000000)).rejects.toThrow(
      /giới hạn/i,
    );
  });

  it('chấp nhận khi còn lượt dùng (usedCount < usageLimit)', async () => {
    discountCodeRepository.findOne.mockResolvedValue(activeCode({ usageLimit: 5, usedCount: 4 }));
    const r = await discountCodeService.applyDiscountCode('SALE', 1000000);
    expect(r.discountAmount).toBe(200000);
  });

  it('từ chối khi orderAmount nhỏ hơn minOrderAmount', async () => {
    discountCodeRepository.findOne.mockResolvedValue(activeCode({ minOrderAmount: 500000 }));
    await expect(discountCodeService.applyDiscountCode('SALE', 100000)).rejects.toThrow(
      /tối thiểu/i,
    );
  });

  // Boundary now === startDate/endDate (dùng fake timers để control `now` chính xác) —
  // giết EqualityOperator `<`->`<=` (L239) và `>`->`>=` (L242): tại đúng mốc, code gốc KHÔNG
  // chặn (cho phép áp ngay thời điểm bắt đầu / tới hết hạn), mutant `<=`/`>=` lại chặn.
  it('startDate boundary: now === startDate → KHÔNG chặn (giết EqualityOperator L239)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2030-06-01T00:00:00.000Z'));
    discountCodeRepository.findOne.mockResolvedValue(
      activeCode({ startDate: '2030-06-01T00:00:00.000Z' }),
    );
    const r = await discountCodeService.applyDiscountCode('SALE', 1000000);
    expect(r.discountAmount).toBe(200000); // now === startDate → `now < startDate` false → không throw
  });

  it('endDate boundary: now === endDate → KHÔNG chặn (giết EqualityOperator L242)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2030-06-01T00:00:00.000Z'));
    discountCodeRepository.findOne.mockResolvedValue(
      activeCode({ endDate: '2030-06-01T00:00:00.000Z' }),
    );
    const r = await discountCodeService.applyDiscountCode('SALE', 1000000);
    expect(r.discountAmount).toBe(200000); // now === endDate → `now > endDate` false → không throw
  });
});

describe('applyDiscountCode — nhánh maxDiscountAmount (giết LogicalOperator/Conditional L262)', () => {
  it('percent KHÔNG cap khi maxDiscountAmount = null (nhánh falsy)', async () => {
    discountCodeRepository.findOne.mockResolvedValue(
      activeCode({ value: 50, maxDiscountAmount: null }),
    );
    const r = await discountCodeService.applyDiscountCode('SALE', 1000000);
    expect(r.discountAmount).toBe(500000); // 50% đầy đủ, không bị cap
  });

  it('percent BỊ cap khi vượt maxDiscountAmount (nhánh truthy + cap)', async () => {
    discountCodeRepository.findOne.mockResolvedValue(
      activeCode({ value: 50, maxDiscountAmount: 100000 }),
    );
    const r = await discountCodeService.applyDiscountCode('SALE', 1000000);
    expect(r.discountAmount).toBe(100000); // bị cap về maxDiscountAmount
  });

  it('percent KHÔNG cap khi chưa chạm maxDiscountAmount', async () => {
    discountCodeRepository.findOne.mockResolvedValue(
      activeCode({ value: 5, maxDiscountAmount: 100000 }),
    );
    const r = await discountCodeService.applyDiscountCode('SALE', 1000000);
    expect(r.discountAmount).toBe(50000); // 5% = 50k < 100k cap → giữ nguyên
  });
});

describe('getAllDiscountCodes — where/pagination (giết String/Object/Array/Arithmetic L41-86)', () => {
  it('build where.code LIKE khi có search, where.isActive khi isActive="true", và pagination đúng', async () => {
    discountCodeRepository.findAll.mockResolvedValue({ count: 25, rows: [activeCode()] });
    const res = await discountCodeService.getAllDiscountCodes({
      page: 2,
      limit: 10,
      search: 'SUMMER',
      isActive: 'true',
      sortBy: 'code',
      sortOrder: 'asc',
    });
    const arg = discountCodeRepository.findAll.mock.calls[0][0];
    expect(arg.where.code).toEqual({ [Op.like]: '%SUMMER%' });
    expect(arg.where.isActive).toBe(true);
    expect(arg.limit).toBe(10);
    expect(arg.offset).toBe(10); // (page2-1)*10
    expect(arg.order).toEqual([['code', 'ASC']]);
    expect(res.pagination).toEqual({
      currentPage: 2,
      totalPages: 3,
      totalItems: 25,
      itemsPerPage: 10,
    });
  });

  it('where rỗng khi không search và không truyền isActive', async () => {
    discountCodeRepository.findAll.mockResolvedValue({ count: 0, rows: [] });
    await discountCodeService.getAllDiscountCodes({ page: 1, limit: 5 });
    const arg = discountCodeRepository.findAll.mock.calls[0][0];
    expect(arg.where).toEqual({});
    expect(arg.offset).toBe(0);
  });

  it('isActive="false" → where.isActive = false', async () => {
    discountCodeRepository.findAll.mockResolvedValue({ count: 0, rows: [] });
    await discountCodeService.getAllDiscountCodes({ isActive: 'false' });
    expect(discountCodeRepository.findAll.mock.calls[0][0].where.isActive).toBe(false);
  });
});

describe('getAvailableDiscountCodes — filter còn lượt + chỉ map field an toàn (giết L74-100)', () => {
  it('lọc bỏ mã đã hết lượt, giữ mã usageLimit=null và mã còn lượt; KHÔNG expose usedCount', async () => {
    discountCodeRepository.findAll.mockResolvedValue({
      rows: [
        {
          id: '1',
          code: 'A',
          type: 'percent',
          value: 10,
          maxDiscountAmount: 5,
          minOrderAmount: 1,
          endDate: null,
          usageLimit: 5,
          usedCount: 5,
        }, // hết lượt → loại
        {
          id: '2',
          code: 'B',
          type: 'fixed',
          value: 20,
          maxDiscountAmount: null,
          minOrderAmount: 2,
          endDate: '2099-01-01',
          usageLimit: null,
          usedCount: 99,
        }, // null → giữ
        {
          id: '3',
          code: 'C',
          type: 'percent',
          value: 30,
          maxDiscountAmount: 9,
          minOrderAmount: 3,
          endDate: null,
          usageLimit: 10,
          usedCount: 4,
        }, // còn → giữ
      ],
    });
    const res = await discountCodeService.getAvailableDiscountCodes();
    expect(res.map((c) => c.code)).toEqual(['B', 'C']);
    expect(res[0]).toEqual({
      id: '2',
      code: 'B',
      type: 'fixed',
      value: 20,
      maxDiscountAmount: null,
      minOrderAmount: 2,
      endDate: '2099-01-01',
    });
    expect(res[0]).not.toHaveProperty('usedCount');
    const arg = discountCodeRepository.findAll.mock.calls[0][0];
    expect(arg.where.isActive).toBe(true);
    expect(arg.limit).toBe(50);
    expect(arg.order).toEqual([['createdAt', 'DESC']]);
  });
});

describe('getDiscountCodeById (giết ConditionalExpression L111)', () => {
  it('trả về mã khi tồn tại', async () => {
    const code = activeCode();
    discountCodeRepository.findById.mockResolvedValue(code);
    await expect(discountCodeService.getDiscountCodeById('c1')).resolves.toBe(code);
  });
  it('throw 404 khi không tồn tại', async () => {
    discountCodeRepository.findById.mockResolvedValue(null);
    await expect(discountCodeService.getDiscountCodeById('x')).rejects.toThrow(/Không tìm thấy/i);
  });
});

describe('createDiscountCode (giết dup-check + default L137-153)', () => {
  it('throw 400 khi mã đã tồn tại', async () => {
    discountCodeRepository.findOne.mockResolvedValue(activeCode());
    await expect(discountCodeService.createDiscountCode({ code: 'SALE' })).rejects.toThrow(
      /đã tồn tại/i,
    );
  });
  it('tạo với default minOrderAmount=0 + isActive=true khi không truyền', async () => {
    discountCodeRepository.findOne.mockResolvedValue(null);
    discountCodeRepository.create.mockResolvedValue({ id: 'new' });
    await discountCodeService.createDiscountCode({ code: 'NEW', type: 'fixed', value: 10 });
    const arg = discountCodeRepository.create.mock.calls[0][0];
    expect(arg.minOrderAmount).toBe(0);
    expect(arg.isActive).toBe(true);
  });
  it('giữ isActive=false khi truyền tường minh', async () => {
    discountCodeRepository.findOne.mockResolvedValue(null);
    discountCodeRepository.create.mockResolvedValue({ id: 'new' });
    await discountCodeService.createDiscountCode({
      code: 'NEW',
      isActive: false,
      minOrderAmount: 500,
    });
    const arg = discountCodeRepository.create.mock.calls[0][0];
    expect(arg.isActive).toBe(false);
    expect(arg.minOrderAmount).toBe(500);
  });
});

describe('updateDiscountCode (giết per-field ??/|| L182-200)', () => {
  function makeUpdatable(overrides = {}) {
    const obj = {
      id: 'c1',
      code: 'OLD',
      type: 'percent',
      value: 10,
      minOrderAmount: 100,
      maxDiscountAmount: 50,
      startDate: '2000-01-01',
      endDate: '2099-01-01',
      usageLimit: 5,
      isActive: true,
      description: 'old',
      ...overrides,
    };
    obj.update = jest.fn().mockResolvedValue(obj);
    return obj;
  }
  it('throw 404 khi không tồn tại', async () => {
    discountCodeRepository.findById.mockResolvedValue(null);
    await expect(discountCodeService.updateDiscountCode('x', {})).rejects.toThrow(
      /Không tìm thấy/i,
    );
  });
  it('throw 400 khi đổi code sang mã đã tồn tại', async () => {
    discountCodeRepository.findById.mockResolvedValue(makeUpdatable());
    discountCodeRepository.findOne.mockResolvedValue(makeUpdatable({ id: 'other' }));
    await expect(discountCodeService.updateDiscountCode('c1', { code: 'TAKEN' })).rejects.toThrow(
      /đã tồn tại/i,
    );
  });
  it('KHÔNG check dup khi code không đổi', async () => {
    discountCodeRepository.findById.mockResolvedValue(makeUpdatable());
    await discountCodeService.updateDiscountCode('c1', { code: 'OLD' });
    expect(discountCodeRepository.findOne).not.toHaveBeenCalled();
  });
  it('dùng GIÁ TRỊ MỚI khi truyền đủ field', async () => {
    const dc = makeUpdatable();
    discountCodeRepository.findById.mockResolvedValue(dc);
    discountCodeRepository.findOne.mockResolvedValue(null);
    await discountCodeService.updateDiscountCode('c1', {
      code: 'NEW',
      type: 'fixed',
      value: 99,
      minOrderAmount: 0,
      maxDiscountAmount: 0,
      startDate: '2020-01-01',
      endDate: '2050-01-01',
      usageLimit: 0,
      isActive: false,
      description: 'new',
    });
    expect(dc.update).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'NEW',
        type: 'fixed',
        value: 99,
        minOrderAmount: 0,
        maxDiscountAmount: 0,
        startDate: '2020-01-01',
        endDate: '2050-01-01',
        usageLimit: 0,
        isActive: false,
        description: 'new',
      }),
    );
  });
  it('GIỮ giá trị cũ khi không truyền field (chỉ id)', async () => {
    const dc = makeUpdatable();
    discountCodeRepository.findById.mockResolvedValue(dc);
    await discountCodeService.updateDiscountCode('c1', {});
    expect(dc.update).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'OLD',
        type: 'percent',
        value: 10,
        minOrderAmount: 100,
        maxDiscountAmount: 50,
        startDate: '2000-01-01',
        endDate: '2099-01-01',
        usageLimit: 5,
        isActive: true,
        description: 'old',
      }),
    );
  });
});

describe('deleteDiscountCode (giết ConditionalExpression L214)', () => {
  it('throw 404 khi không tồn tại', async () => {
    discountCodeRepository.findById.mockResolvedValue(null);
    await expect(discountCodeService.deleteDiscountCode('x')).rejects.toThrow(/Không tìm thấy/i);
  });
  it('gọi remove khi tồn tại', async () => {
    const dc = activeCode();
    discountCodeRepository.findById.mockResolvedValue(dc);
    discountCodeRepository.remove.mockResolvedValue();
    await discountCodeService.deleteDiscountCode('c1');
    expect(discountCodeRepository.remove).toHaveBeenCalledWith(dc);
  });
});

describe('applyDiscountCode — type fixed + cap orderAmount', () => {
  it('fixed: trả đúng value khi nhỏ hơn orderAmount', async () => {
    discountCodeRepository.findOne.mockResolvedValue(activeCode({ type: 'fixed', value: 30000 }));
    const r = await discountCodeService.applyDiscountCode('SALE', 1000000);
    expect(r.discountAmount).toBe(30000);
  });
  it('fixed: cap về orderAmount khi value lớn hơn (không giảm âm)', async () => {
    discountCodeRepository.findOne.mockResolvedValue(activeCode({ type: 'fixed', value: 5000000 }));
    const r = await discountCodeService.applyDiscountCode('SALE', 1000000);
    expect(r.discountAmount).toBe(1000000); // cap = orderAmount
  });
  it('throw khi mã không tồn tại / inactive', async () => {
    discountCodeRepository.findOne.mockResolvedValue(null);
    await expect(discountCodeService.applyDiscountCode('NONE', 1000000)).rejects.toThrow();
  });
  it('tìm mã đúng filter {code, isActive:true} (giết ObjectLiteral/Boolean L235)', async () => {
    discountCodeRepository.findOne.mockResolvedValue(activeCode());
    await discountCodeService.applyDiscountCode('SALE', 1000000);
    expect(discountCodeRepository.findOne).toHaveBeenCalledWith({ code: 'SALE', isActive: true });
  });
});

describe('getAllDiscountCodes — default sortBy/sortOrder (giết StringLiteral L38/39)', () => {
  it('dùng order mặc định [["createdAt","DESC"]] khi không truyền sortBy/sortOrder', async () => {
    discountCodeRepository.findAll.mockResolvedValue({ count: 0, rows: [] });
    await discountCodeService.getAllDiscountCodes({});
    expect(discountCodeRepository.findAll.mock.calls[0][0].order).toEqual([['createdAt', 'DESC']]);
  });
});

describe('getAvailableDiscountCodes — cấu trúc where Op.or/Op.and (giết Array/ObjectLiteral L78/79)', () => {
  it('where có Op.or (endDate null|>=now) và Op.and (startDate null|<=now)', async () => {
    discountCodeRepository.findAll.mockResolvedValue({ rows: [] });
    await discountCodeService.getAvailableDiscountCodes();
    const where = discountCodeRepository.findAll.mock.calls[0][0].where;
    const or = where[Op.or];
    expect(Array.isArray(or)).toBe(true);
    expect(or).toHaveLength(2);
    expect(or[0]).toEqual({ endDate: null });
    expect(or[1].endDate[Op.gte]).toBeInstanceOf(Date);
    const and = where[Op.and];
    expect(Array.isArray(and)).toBe(true);
    expect(and).toHaveLength(1);
    const innerOr = and[0][Op.or];
    expect(innerOr).toHaveLength(2);
    expect(innerOr[0]).toEqual({ startDate: null });
    expect(innerOr[1].startDate[Op.lte]).toBeInstanceOf(Date);
  });
});

describe('createDiscountCode — tìm trùng đúng {code} (giết ObjectLiteral L137)', () => {
  it('gọi findOne với { code } để kiểm trùng', async () => {
    discountCodeRepository.findOne.mockResolvedValue(null);
    discountCodeRepository.create.mockResolvedValue({ id: 'x' });
    await discountCodeService.createDiscountCode({ code: 'UNIQ', type: 'fixed', value: 1 });
    expect(discountCodeRepository.findOne).toHaveBeenCalledWith({ code: 'UNIQ' });
  });
});
