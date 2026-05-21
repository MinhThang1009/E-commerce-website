// Unit tests cho LoyaltyController
// Chiến lược: mock loyaltyService hoàn toàn, kiểm tra response shape + status code + error forwarding

const LoyaltyController = require('./loyalty-controller');

// ---------- Helpers ----------

function makeRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  return res;
}

function makeReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 1 },
    ...overrides,
  };
}

// ---------- Setup ----------

let loyaltyService;
let controller;

beforeEach(() => {
  loyaltyService = {
    getLoyaltyInfo: jest.fn(),
    redeemPoints: jest.fn(),
  };
  controller = new LoyaltyController({ loyaltyService });
});

// ============================================================
// getLoyaltyInfo
// ============================================================

describe('LoyaltyController.getLoyaltyInfo', () => {
  it('trả 200 với { status: success, data } khi service thành công', async () => {
    const serviceData = { points: 500, tier: 'silver', history: [] };
    loyaltyService.getLoyaltyInfo.mockResolvedValue(serviceData);

    const req = makeReq({ user: { id: 7 }, query: { page: '1' } });
    const res = makeRes();
    const next = jest.fn();

    await controller.getLoyaltyInfo(req, res, next);

    expect(loyaltyService.getLoyaltyInfo).toHaveBeenCalledWith({
      userId: 7,
      page: '1',
    });
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ status: 'success', data: serviceData });
    expect(next).not.toHaveBeenCalled();
  });

  it('spread req.query vào tham số service cùng với userId', async () => {
    loyaltyService.getLoyaltyInfo.mockResolvedValue({ points: 0 });

    const req = makeReq({
      user: { id: 3 },
      query: { includeHistory: 'true', limit: '5' },
    });

    await controller.getLoyaltyInfo(req, makeRes(), jest.fn());

    expect(loyaltyService.getLoyaltyInfo).toHaveBeenCalledWith({
      userId: 3,
      includeHistory: 'true',
      limit: '5',
    });
  });

  it('gọi next(err) khi service ném lỗi 404 (user không tồn tại)', async () => {
    const err = Object.assign(new Error('Không tìm thấy user'), { statusCode: 404 });
    loyaltyService.getLoyaltyInfo.mockRejectedValue(err);

    const next = jest.fn();
    await controller.getLoyaltyInfo(makeReq({ user: { id: 99 } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('gọi next(err) khi service ném lỗi 500', async () => {
    const err = new Error('DB lỗi');
    loyaltyService.getLoyaltyInfo.mockRejectedValue(err);

    const next = jest.fn();
    await controller.getLoyaltyInfo(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ============================================================
// redeemPoints
// ============================================================

describe('LoyaltyController.redeemPoints', () => {
  it('trả 200 với { status, message, data } khi đổi điểm thành công', async () => {
    const serviceResult = {
      message: 'Đổi thành công 100 điểm',
      data: { remainingPoints: 400, discountAmount: 10000 },
    };
    loyaltyService.redeemPoints.mockResolvedValue(serviceResult);

    const req = makeReq({ user: { id: 2 }, body: { points: 100 } });
    const res = makeRes();
    const next = jest.fn();

    await controller.redeemPoints(req, res, next);

    expect(loyaltyService.redeemPoints).toHaveBeenCalledWith({
      userId: 2,
      points: 100,
    });
    expect(res._status).toBe(200);
    expect(res._body).toEqual({
      status: 'success',
      message: serviceResult.message,
      data: serviceResult.data,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('truyền points từ body tới service', async () => {
    loyaltyService.redeemPoints.mockResolvedValue({
      message: 'OK',
      data: { remainingPoints: 0 },
    });

    const req = makeReq({ user: { id: 5 }, body: { points: 200 } });
    await controller.redeemPoints(req, makeRes(), jest.fn());

    expect(loyaltyService.redeemPoints).toHaveBeenCalledWith(
      expect.objectContaining({ points: 200, userId: 5 }),
    );
  });

  it('gọi next(err) khi điểm không đủ → service ném lỗi 400', async () => {
    const err = Object.assign(new Error('Số điểm không đủ'), { statusCode: 400 });
    loyaltyService.redeemPoints.mockRejectedValue(err);

    const next = jest.fn();
    await controller.redeemPoints(
      makeReq({ user: { id: 1 }, body: { points: 99999 } }),
      makeRes(),
      next,
    );

    expect(next).toHaveBeenCalledWith(err);
  });

  it('gọi next(err) khi service ném lỗi không phân loại', async () => {
    const err = new Error('Lỗi không xác định');
    loyaltyService.redeemPoints.mockRejectedValue(err);

    const next = jest.fn();
    await controller.redeemPoints(makeReq({ body: { points: 50 } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
