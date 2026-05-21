/**
 * Unit tests cho PaymentController class
 * (src/modules/payment/controllers/paymentController.js)
 *
 * Strategy: inject mock paymentService và logger, test từng method
 * trực tiếp (không qua supertest) — nhanh hơn và isolate hoàn toàn.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'https://shop.test';

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ── Load class ────────────────────────────────────────────────────────────────
const PaymentController = require('./payment-controller');

// ── Helper builders ───────────────────────────────────────────────────────────
function buildController(serviceOverrides = {}) {
  const paymentService = {
    createRefund: jest.fn(),
    createMomoUrl: jest.fn(),
    handleMomoReturn: jest.fn(),
    handleMomoIPN: jest.fn(),
    createVNPayUrl: jest.fn(),
    handleVnPayReturn: jest.fn(),
    handleVnPayIPN: jest.fn(),
    ...serviceOverrides,
  };

  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const controller = new PaymentController({ paymentService, logger });
  return { controller, paymentService, logger };
}

function buildReq(overrides = {}) {
  return {
    body: {},
    query: {},
    headers: {},
    user: { id: 1 },
    connection: { remoteAddress: '127.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  };
}

function buildRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// createRefund
// ─────────────────────────────────────────────────────────────────────────────
describe('PaymentController.createRefund', () => {
  it('trả về 200 với refund data khi service thành công', async () => {
    const { controller, paymentService } = buildController();
    paymentService.createRefund.mockResolvedValue({ id: 'REF-1', amount: 100000 });

    const req = buildReq({
      body: { orderId: 42, amount: 100000, reason: 'Hoàn hàng' },
      headers: { 'x-forwarded-for': '203.0.113.1' },
    });
    const res = buildRes();
    const next = jest.fn();

    await controller.createRefund(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: { refund: { id: 'REF-1', amount: 100000 } },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('chuyển ipAddr từ x-forwarded-for header vào service', async () => {
    const { controller, paymentService } = buildController();
    paymentService.createRefund.mockResolvedValue({});

    const req = buildReq({
      body: { orderId: 1 },
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    await controller.createRefund(req, buildRes(), jest.fn());

    expect(paymentService.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddr: '10.0.0.1' }),
    );
  });

  it('chuyển ipAddr từ connection.remoteAddress khi không có x-forwarded-for', async () => {
    const { controller, paymentService } = buildController();
    paymentService.createRefund.mockResolvedValue({});

    const req = buildReq({ body: { orderId: 1 }, headers: {} });
    await controller.createRefund(req, buildRes(), jest.fn());

    expect(paymentService.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddr: '127.0.0.1' }),
    );
  });

  it('chuyển ipAddr từ socket.remoteAddress khi không có x-forwarded-for và không có connection.remoteAddress', async () => {
    const { controller, paymentService } = buildController();
    paymentService.createRefund.mockResolvedValue({});

    const req = buildReq({
      body: { orderId: 1 },
      headers: {},
      connection: {},
      socket: { remoteAddress: '192.168.1.1' },
    });
    await controller.createRefund(req, buildRes(), jest.fn());

    expect(paymentService.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddr: '192.168.1.1' }),
    );
  });

  it('gọi next(err) khi service throw', async () => {
    const { controller, paymentService } = buildController();
    const err = new Error('Service error');
    paymentService.createRefund.mockRejectedValue(err);

    const next = jest.fn();
    await controller.createRefund(buildReq(), buildRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createMomoUrl
// ─────────────────────────────────────────────────────────────────────────────
describe('PaymentController.createMomoUrl', () => {
  it('trả về 200 với data từ service', async () => {
    const { controller, paymentService } = buildController();
    paymentService.createMomoUrl.mockResolvedValue({ payUrl: 'https://momo.test/pay' });

    const req = buildReq({ body: { orderId: 42 }, user: { id: 7 } });
    const res = buildRes();

    await controller.createMomoUrl(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: { payUrl: 'https://momo.test/pay' },
    });
  });

  it('truyền userId từ req.user.id vào service', async () => {
    const { controller, paymentService } = buildController();
    paymentService.createMomoUrl.mockResolvedValue({});

    const req = buildReq({ body: { orderId: 10 }, user: { id: 99 } });
    await controller.createMomoUrl(req, buildRes(), jest.fn());

    expect(paymentService.createMomoUrl).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 10, userId: 99 }),
    );
  });

  it('gọi next(err) khi service throw', async () => {
    const { controller, paymentService } = buildController();
    const err = new Error('MoMo unavailable');
    paymentService.createMomoUrl.mockRejectedValue(err);

    const next = jest.fn();
    await controller.createMomoUrl(buildReq(), buildRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// momoReturn
// ─────────────────────────────────────────────────────────────────────────────
describe('PaymentController.momoReturn', () => {
  it('redirect về URL trả về từ service', async () => {
    const { controller, paymentService } = buildController();
    paymentService.handleMomoReturn.mockResolvedValue('https://shop.test/orders?payment=success');

    const req = buildReq({ query: { resultCode: '0', orderId: 'ORD-1' } });
    const res = buildRes();

    await controller.momoReturn(req, res);

    expect(res.redirect).toHaveBeenCalledWith('https://shop.test/orders?payment=success');
  });

  it('redirect về /orders?payment=error khi service throw', async () => {
    const { controller, paymentService, logger } = buildController();
    paymentService.handleMomoReturn.mockRejectedValue(new Error('fail'));

    const res = buildRes();
    await controller.momoReturn(buildReq(), res);

    expect(res.redirect).toHaveBeenCalledWith('https://shop.test/orders?payment=error');
    expect(logger.error).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// momoIPN
// ─────────────────────────────────────────────────────────────────────────────
describe('PaymentController.momoIPN', () => {
  it('trả về 204 khi IPN hợp lệ (result.valid = true)', async () => {
    const { controller, paymentService } = buildController();
    paymentService.handleMomoIPN.mockResolvedValue({ valid: true });

    const res = buildRes();
    await controller.momoIPN(buildReq({ body: { resultCode: 0 } }), res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it('trả về 400 khi chữ ký không hợp lệ (result.valid = false)', async () => {
    const { controller, paymentService } = buildController();
    paymentService.handleMomoIPN.mockResolvedValue({ valid: false });

    const res = buildRes();
    await controller.momoIPN(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Chữ ký không hợp lệ' });
  });

  it('trả về 500 khi service throw', async () => {
    const { controller, paymentService, logger } = buildController();
    paymentService.handleMomoIPN.mockRejectedValue(new Error('crash'));

    const res = buildRes();
    await controller.momoIPN(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    expect(logger.error).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createVNPayUrl
// ─────────────────────────────────────────────────────────────────────────────
describe('PaymentController.createVNPayUrl', () => {
  it('trả về 200 với payment URL', async () => {
    const { controller, paymentService } = buildController();
    paymentService.createVNPayUrl.mockResolvedValue({ payUrl: 'https://vnpay.test/pay' });

    const req = buildReq({
      body: { orderId: 5 },
      user: { id: 3 },
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    const res = buildRes();

    await controller.createVNPayUrl(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });

  it('truyền ipAddr và userId đúng vào service', async () => {
    const { controller, paymentService } = buildController();
    paymentService.createVNPayUrl.mockResolvedValue({});

    const req = buildReq({
      body: { orderId: 5 },
      user: { id: 42 },
      headers: { 'x-forwarded-for': '5.6.7.8' },
    });
    await controller.createVNPayUrl(req, buildRes(), jest.fn());

    expect(paymentService.createVNPayUrl).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddr: '5.6.7.8', userId: 42 }),
    );
  });

  it('chuyển ipAddr từ socket.remoteAddress khi không có x-forwarded-for và không có connection.remoteAddress', async () => {
    const { controller, paymentService } = buildController();
    paymentService.createVNPayUrl.mockResolvedValue({});

    const req = buildReq({
      body: { orderId: 5 },
      user: { id: 1 },
      headers: {},
      connection: {},
      socket: { remoteAddress: '10.10.10.10' },
    });
    await controller.createVNPayUrl(req, buildRes(), jest.fn());

    expect(paymentService.createVNPayUrl).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddr: '10.10.10.10' }),
    );
  });

  it('gọi next(err) khi service throw', async () => {
    const { controller, paymentService } = buildController();
    const err = new Error('VNPay down');
    paymentService.createVNPayUrl.mockRejectedValue(err);

    const next = jest.fn();
    await controller.createVNPayUrl(buildReq(), buildRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// vnpayReturn
// ─────────────────────────────────────────────────────────────────────────────
describe('PaymentController.vnpayReturn', () => {
  it('redirect về URL trả về từ service', async () => {
    const { controller, paymentService } = buildController();
    paymentService.handleVnPayReturn.mockResolvedValue({
      redirectUrl: 'https://shop.test/orders?payment=success',
    });

    const req = buildReq({ query: { vnp_ResponseCode: '00' } });
    const res = buildRes();

    await controller.vnpayReturn(req, res, jest.fn());

    expect(res.redirect).toHaveBeenCalledWith('https://shop.test/orders?payment=success');
  });

  it('gọi next(err) và log lỗi khi service throw', async () => {
    const { controller, paymentService, logger } = buildController();
    const err = new Error('vnpay fail');
    paymentService.handleVnPayReturn.mockRejectedValue(err);

    const next = jest.fn();
    await controller.vnpayReturn(buildReq(), buildRes(), next);

    expect(next).toHaveBeenCalledWith(err);
    expect(logger.error).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// vnpayIPN
// ─────────────────────────────────────────────────────────────────────────────
describe('PaymentController.vnpayIPN', () => {
  it('trả về 200 với result từ service', async () => {
    const { controller, paymentService } = buildController();
    paymentService.handleVnPayIPN.mockResolvedValue({ RspCode: '00', Message: 'OK' });

    const res = buildRes();
    await controller.vnpayIPN(buildReq({ query: { vnp_TxnRef: 'ORD-1' } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ RspCode: '00', Message: 'OK' });
  });

  it('trả về 200 với RspCode 99 khi service throw', async () => {
    const { controller, paymentService, logger } = buildController();
    paymentService.handleVnPayIPN.mockRejectedValue(new Error('crash'));

    const res = buildRes();
    await controller.vnpayIPN(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ RspCode: '99', Message: 'Lỗi không xác định' });
    expect(logger.error).toHaveBeenCalled();
  });
});
