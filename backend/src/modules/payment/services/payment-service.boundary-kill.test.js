/**
 * Boundary-kill tests cho PaymentService
 * L172, L255, L319 là TRUE EQUIVALENT do floating-point:
 * `Math.abs(order.total - vnpAmount/100) > 0.01` tại diff=0.01 xu là 0.0100000009... > 0.01 → reject.
 * Cả `>` và `>=` cho cùng kết quả → disable comment đã thêm.
 * File này chỉ verify hành vi boundary amount đúng (không kill mutant).
 */

const PaymentService = require('./payment-service');

function buildMockRepo(overrides = {}) {
  return {
    findOrderByPk: jest.fn(),
    findOrderByNumber: jest.fn(),
    findOrderByPkWithItemsAndUser: jest.fn(),
    lockOrder: jest.fn(),
    saveOrder: jest.fn().mockResolvedValue(undefined),
    findActiveCartsByUser: jest.fn().mockResolvedValue([]),
    saveCart: jest.fn().mockResolvedValue(undefined),
    clearCartItems: jest.fn().mockResolvedValue(undefined),
    findOrderDiscountCode: jest.fn().mockResolvedValue(null),
    incrementDiscountCodeUsedCount: jest.fn().mockResolvedValue(undefined),
    runInTransaction: jest
      .fn()
      .mockImplementation(async (work) => work({ LOCK: { UPDATE: 'UPDATE' } })),
    ...overrides,
  };
}

function buildMockVnpayGateway(overrides = {}) {
  return {
    createPaymentUrl: jest.fn().mockReturnValue('https://vnpay.test/pay'),
    verifyReturnUrl: jest.fn().mockReturnValue(true),
    refund: jest.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

function buildMockMomoGateway(overrides = {}) {
  return {
    createPaymentUrl: jest.fn().mockResolvedValue({ payUrl: 'https://momo.test/pay' }),
    verifySignature: jest.fn().mockReturnValue(true),
    ...overrides,
  };
}

function buildService(overrides = {}) {
  return new PaymentService({
    paymentRepository: buildMockRepo(),
    momoGateway: buildMockMomoGateway(),
    vnpayGateway: buildMockVnpayGateway(),
    emailGateway: { sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined) },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    frontendUrl: 'https://shop.test',
    ordersService: { updateOrderStatus: jest.fn().mockResolvedValue(undefined) },
    ...overrides,
  });
}

function buildOrder(overrides = {}) {
  return {
    id: 42,
    number: 'ORD-2511-00042',
    userId: 7,
    total: 500000,
    paymentStatus: 'pending',
    paymentProvider: 'vnpay',
    paymentTransactionId: null,
    status: 'pending',
    updatedAt: new Date('2025-01-01T10:00:00Z'),
    createdAt: new Date('2025-01-01T09:00:00Z'),
    shippingFirstName: 'Minh',
    shippingLastName: 'Test',
    shippingAddress1: '123',
    shippingAddress2: null,
    shippingCity: 'TP.HCM',
    shippingState: 'TP.HCM',
    shippingZip: '70000',
    shippingCountry: 'VN',
    ...overrides,
  };
}

// ─── L172: handleMomoIPN amount boundary (verify behavior) ───────────────────

describe('PaymentService.handleMomoIPN — amount boundary behavior', () => {
  it('diff nhỏ (< 0.01) → xử lý bình thường', async () => {
    // Dùng amount = total để đảm bảo diff = 0
    const order = buildOrder({ total: 500000, paymentTransactionId: null });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-EXACT', amount: 500000 },
    });

    expect(repo.saveOrder).toHaveBeenCalled();
    expect(order.paymentStatus).toBe('paid');
  });

  it('diff lớn (> 0.1) → không mark paid', async () => {
    const order = buildOrder({ total: 500000, paymentTransactionId: null });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-MISMATCH', amount: 100000 },
    });

    expect(repo.saveOrder).not.toHaveBeenCalled();
    expect(order.paymentStatus).not.toBe('paid');
  });

  it('amount=0 (falsy) → bỏ qua check amount, xử lý bình thường', async () => {
    // body.amount = 0 → falsy → skip check → order được xử lý
    const order = buildOrder({ total: 500000, paymentTransactionId: null });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-NOAMT', amount: 0 },
    });

    // amount=0 falsy → skip → order vẫn được xử lý bình thường
    expect(repo.saveOrder).toHaveBeenCalled();
  });
});

// ─── L255: handleVnPayReturn amount boundary ─────────────────────────────────

describe('PaymentService.handleVnPayReturn — amount boundary behavior', () => {
  it('diff lớn rõ ràng (50%) → amount-mismatch, redirect failed', async () => {
    const order = buildOrder({ total: 500000, paymentTransactionId: null });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'VNP-MIS',
        vnp_Amount: '25000000', // 250000 ≠ 500000
      },
    });

    expect(redirectUrl).toContain('code=04');
    expect(order.paymentStatus).not.toBe('paid');
  });

  it('NaN amount (bỏ qua check) → xử lý bình thường', async () => {
    const order = buildOrder({ total: 500000, paymentTransactionId: null });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'VNP-NAN',
        // vnp_Amount không truyền → parseInt undefined → NaN → isFinite(NaN) = false → skip
      },
    });

    // NaN → isFinite false → bỏ qua check → success
    expect(redirectUrl).toContain('payment=success');
    expect(order.paymentStatus).toBe('paid');
  });
});

// ─── L319: handleVnPayIPN amount boundary ────────────────────────────────────

describe('PaymentService.handleVnPayIPN — amount boundary behavior', () => {
  it('diff lớn → RspCode 04', async () => {
    const order = buildOrder({ total: 500000, paymentStatus: 'pending' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_Amount: '10000000', // 100000 ≠ 500000
        vnp_TransactionNo: 'VNP-IPN-MIS',
      },
    });

    expect(result.RspCode).toBe('04');
  });

  it('exact match → RspCode 00, paid', async () => {
    const order = buildOrder({ total: 500000, paymentStatus: 'pending' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'VNP-IPN-OK',
      },
    });

    expect(result.RspCode).toBe('00');
    expect(order.paymentStatus).toBe('paid');
  });

  it('NaN amount (vnp_Amount không có) → bỏ qua check, xử lý bình thường (đồng nhất handleVnPayReturn)', async () => {
    // parseInt(undefined, 10) / 100 = NaN → Number.isFinite(NaN) = false → skip check → mark paid
    const order = buildOrder({ total: 500000, paymentStatus: 'pending' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        // vnp_Amount không truyền → NaN → isFinite false → skip
        vnp_TransactionNo: 'VNP-IPN-NAN',
      },
    });

    expect(result.RspCode).toBe('00');
    expect(order.paymentStatus).toBe('paid');
  });
});
