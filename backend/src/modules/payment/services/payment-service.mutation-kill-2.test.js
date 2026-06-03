/**
 * Mutation-kill tests bổ sung cho PaymentService — Round 2
 * Nhắm vào survivors còn lại:
 * - _canRefund string reasons (exact message check)
 * - _canProcessPayment: idempotency logic exact
 * - handleMomoIPN: logger strings, BooleanLiteral survivors
 * - handleVnPayReturn/IPN: logger strings, BooleanLiteral, BlockStatement
 * - _sendOrderConfirmationEmailSafe: LogicalOperator (order && order.User)
 * - _clearUserCart: exact log messages
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
    runInTransaction: jest.fn().mockImplementation(async (work) => {
      const tx = { LOCK: { UPDATE: 'UPDATE' } };
      return work(tx);
    }),
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

function buildMockVnpayGateway(overrides = {}) {
  return {
    createPaymentUrl: jest.fn().mockReturnValue('https://vnpay.test/pay'),
    verifyReturnUrl: jest.fn().mockReturnValue(true),
    refund: jest.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

function buildService(overrides = {}) {
  const defaults = {
    paymentRepository: buildMockRepo(),
    momoGateway: buildMockMomoGateway(),
    vnpayGateway: buildMockVnpayGateway(),
    emailGateway: { sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined) },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    frontendUrl: 'https://shop.test',
    ordersService: { updateOrderStatus: jest.fn().mockResolvedValue(undefined) },
  };
  return new PaymentService({ ...defaults, ...overrides });
}

function buildOrder(overrides = {}) {
  return {
    id: 42,
    number: 'ORD-2511-00042',
    userId: 7,
    total: 500000,
    subtotal: 480000,
    shippingCost: 20000,
    paymentStatus: 'pending',
    paymentProvider: 'vnpay',
    paymentTransactionId: null,
    status: 'pending',
    updatedAt: new Date('2025-01-01T10:00:00Z'),
    createdAt: new Date('2025-01-01T09:00:00Z'),
    shippingFirstName: 'Minh',
    shippingLastName: 'Test',
    shippingAddress1: '123 Đường Test',
    shippingAddress2: null,
    shippingCity: 'TP.HCM',
    shippingState: 'TP.HCM',
    shippingZip: '70000',
    shippingCountry: 'VN',
    discountCodeId: null,
    ...overrides,
  };
}

// ─── _canRefund: exact error message strings ────────────────────────────────

describe('PaymentService._canRefund — policyResult.reason exact strings (qua createRefund)', () => {
  it('order=null → AppError message = "Không tìm thấy đơn hàng"', async () => {
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(null) });
    const svc = buildService({ paymentRepository: repo });
    try {
      await svc.createRefund({ orderId: 99 });
      fail('Expected to throw');
    } catch (e) {
      expect(e.message).toBe('Không tìm thấy đơn hàng');
    }
  });

  it('paymentStatus=refunded → message = "Đơn hàng đã được hoàn tiền"', async () => {
    const order = buildOrder({
      paymentStatus: 'refunded',
      paymentTransactionId: 'TX',
      paymentProvider: 'vnpay',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    try {
      await svc.createRefund({ orderId: 42 });
      fail('Expected to throw');
    } catch (e) {
      expect(e.message).toBe('Đơn hàng đã được hoàn tiền');
    }
  });

  it('paymentStatus=pending (!=paid) → message chứa "thanh toán"', async () => {
    const order = buildOrder({ paymentStatus: 'pending' });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    try {
      await svc.createRefund({ orderId: 42 });
      fail('Expected to throw');
    } catch (e) {
      expect(e.message).toContain('thanh toán');
    }
  });

  it('paymentTransactionId=null + paid → message chứa "giao dịch"', async () => {
    const order = buildOrder({
      paymentStatus: 'paid',
      paymentTransactionId: null,
      paymentProvider: 'vnpay',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    try {
      await svc.createRefund({ orderId: 42 });
      fail('Expected to throw');
    } catch (e) {
      expect(e.message).toContain('giao dịch');
    }
  });

  it('provider không hỗ trợ → message chứa tên provider', async () => {
    const order = buildOrder({
      paymentStatus: 'paid',
      paymentTransactionId: 'TX',
      paymentProvider: 'momo',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    try {
      await svc.createRefund({ orderId: 42 });
      fail('Expected to throw');
    } catch (e) {
      expect(e.message).toContain('momo');
    }
  });
});

// ─── createMomoUrl: exact error messages ─────────────────────────────────────

describe('PaymentService.createMomoUrl — exact error message strings', () => {
  it('order không tồn tại → message = "payment.orderNotFound"', async () => {
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(null) });
    const svc = buildService({ paymentRepository: repo });
    await expect(svc.createMomoUrl({ orderId: 99, userId: 1 })).rejects.toMatchObject({
      message: 'payment.orderNotFound',
      statusCode: 404,
    });
  });

  it('userId không khớp → message = "payment.accessDenied"', async () => {
    const order = buildOrder({ userId: 7 });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(svc.createMomoUrl({ orderId: 42, userId: 999 })).rejects.toMatchObject({
      message: 'payment.accessDenied',
      statusCode: 403,
    });
  });
});

// ─── createVNPayUrl: exact error messages ─────────────────────────────────────

describe('PaymentService.createVNPayUrl — exact error message strings', () => {
  it('order không tồn tại → message = "payment.orderNotFound"', async () => {
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(null) });
    const svc = buildService({ paymentRepository: repo });
    await expect(
      svc.createVNPayUrl({ orderId: 99, userId: 1, ipAddr: '1.2.3.4' }),
    ).rejects.toMatchObject({ message: 'payment.orderNotFound', statusCode: 404 });
  });

  it('userId không khớp → message = "payment.accessDenied"', async () => {
    const order = buildOrder({ userId: 7 });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(
      svc.createVNPayUrl({ orderId: 42, userId: 888, ipAddr: '1.2.3.4' }),
    ).rejects.toMatchObject({ message: 'payment.accessDenied', statusCode: 403 });
  });
});

// ─── _canProcessPayment: idempotency logic ────────────────────────────────────

describe('PaymentService._canProcessPayment (qua handleMomoIPN/handleVnPayIPN) — idempotency', () => {
  it('transId khớp paymentTransactionId → return false (idempotent, KHÔNG save lại)', async () => {
    // _canProcessPayment: transactionId && order.paymentTransactionId === transactionId → false
    const order = buildOrder({ paymentStatus: 'paid', paymentTransactionId: 'TX-SAME' });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-SAME', amount: 500000 },
    });

    expect(repo.saveOrder).not.toHaveBeenCalled();
    expect(order.paymentStatus).toBe('paid'); // không thay đổi
  });

  it('transId khác → _canProcessPayment = true, xử lý bình thường', async () => {
    const order = buildOrder({ paymentStatus: 'pending', paymentTransactionId: 'TX-OLD' });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-NEW', amount: 500000 },
    });

    expect(repo.saveOrder).toHaveBeenCalled();
    expect(order.paymentStatus).toBe('paid');
  });

  it('transId = null → không check idempotency, xử lý nếu paymentStatus != paid', async () => {
    // transactionId = null → falsy → _canProcessPayment check chỉ paymentStatus
    const order = buildOrder({ paymentStatus: 'pending', paymentTransactionId: null });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: null, amount: 500000 },
    });

    // transId=null → falsy → skip first check → paymentStatus=pending != paid → process
    expect(repo.saveOrder).toHaveBeenCalled();
  });

  it('VNPay IPN: paymentStatus=paid → RspCode 02 (đã xử lý rồi)', async () => {
    const order = buildOrder({ total: 500000, paymentStatus: 'paid' });
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
        vnp_TransactionNo: 'VNP-DUP',
      },
    });

    expect(result.RspCode).toBe('02');
    expect(result.Message).toBe('Order already confirmed');
  });
});

// ─── handleMomoIPN: logger messages (logger.warn strings) ────────────────────

describe('PaymentService.handleMomoIPN — logger messages', () => {
  it('amount mismatch → logger.warn với expected và received', async () => {
    const order = buildOrder({ total: 500000 });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ paymentRepository: repo, logger });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX', amount: 100000 },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('mismatch'),
      expect.objectContaining({ expected: 500000, received: 100000 }),
    );
  });

  it('cancelled order → logger.warn với orderId và transId', async () => {
    const order = buildOrder({ status: 'cancelled' });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ paymentRepository: repo, logger });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-CXL', amount: 500000 },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ transId: 'TX-CXL' }),
    );
  });

  it('logger.info nhận resultCode, orderId, transId từ body', async () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ logger });

    await svc.handleMomoIPN({
      body: { resultCode: 9, extraData: 'orderId=1', transId: 'TX-LOG' },
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Đã nhận MoMo IPN:',
      expect.objectContaining({ resultCode: 9, transId: 'TX-LOG' }),
    );
  });
});

// ─── handleVnPayReturn: logger.warn với orderNumber và transNo ────────────────

describe('PaymentService.handleVnPayReturn — logger.warn args', () => {
  it('amount mismatch → logger.warn với expected, received, orderNumber', async () => {
    const order = buildOrder({ total: 500000, paymentTransactionId: null });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ paymentRepository: repo, logger });

    await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'VNP-AMT',
        vnp_Amount: '1000000000', // 10000000đ ≠ 500000đ
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('mismatch'),
      expect.objectContaining({ expected: 500000, orderNumber: order.number }),
    );
  });

  it('cancelled order → logger.warn với orderNumber và transNo', async () => {
    const order = buildOrder({ status: 'cancelled', number: 'ORD-C' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ paymentRepository: repo, logger });

    await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: 'ORD-C',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'VNP-CXL-TX',
        vnp_Amount: '50000000',
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ orderNumber: 'ORD-C', transNo: 'VNP-CXL-TX' }),
    );
  });
});

// ─── handleVnPayIPN: logger.warn args ─────────────────────────────────────────

describe('PaymentService.handleVnPayIPN — logger.warn args', () => {
  it('cancelled order → logger.warn với orderNumber và transNo', async () => {
    const order = buildOrder({ status: 'cancelled', total: 500000, number: 'ORD-CXL2' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ paymentRepository: repo, logger });

    await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: 'ORD-CXL2',
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'VNP-IPN-CXL',
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ orderNumber: 'ORD-CXL2', transNo: 'VNP-IPN-CXL' }),
    );
  });
});

// ─── _sendOrderConfirmationEmailSafe: !order || !order.User logic ────────────

describe('PaymentService._sendOrderConfirmationEmailSafe — !order || !order.User', () => {
  it('order = null → không gửi email (return sớm)', async () => {
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(null),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn() };
    const svc = buildService({ paymentRepository: repo, emailGateway });
    await svc._sendOrderConfirmationEmailSafe(999);
    expect(emailGateway.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it('order.User = null → không gửi email (return sớm)', async () => {
    const order = buildOrder({ User: null });
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(order),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn() };
    const svc = buildService({ paymentRepository: repo, emailGateway });
    await svc._sendOrderConfirmationEmailSafe(42);
    expect(emailGateway.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it('order tồn tại + User tồn tại → gửi email', async () => {
    const order = buildOrder({ User: { email: 'u@t.com' }, items: [] });
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(order),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined) };
    const svc = buildService({ paymentRepository: repo, emailGateway });
    await svc._sendOrderConfirmationEmailSafe(42);
    expect(emailGateway.sendOrderConfirmationEmail).toHaveBeenCalled();
  });

  it('emailGateway throw → logger.error ghi error message', async () => {
    const order = buildOrder({ User: { email: 'u@t.com' }, items: [] });
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(order),
    });
    const emailGateway = {
      sendOrderConfirmationEmail: jest.fn().mockRejectedValue(new Error('SMTP fail')),
    };
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ paymentRepository: repo, emailGateway, logger });
    await svc._sendOrderConfirmationEmailSafe(42);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('42'), expect.any(String));
  });
});

// ─── _clearUserCart: log messages ─────────────────────────────────────────────

describe('PaymentService._clearUserCart — log messages exact', () => {
  it('cart cleared → logger.info chứa cart.id và userId', async () => {
    const cart = { id: 15, status: 'active' };
    const repo = buildMockRepo({
      findActiveCartsByUser: jest.fn().mockResolvedValue([cart]),
    });
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ paymentRepository: repo, logger });

    await svc._clearUserCart(7);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringMatching(/15.*7|7.*15/), // chứa cả cart.id=15 và userId=7
    );
  });

  it('error → logger.error với userId trong message', async () => {
    const repo = buildMockRepo({
      findActiveCartsByUser: jest.fn().mockRejectedValue(new Error('DB err')),
    });
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ paymentRepository: repo, logger });

    await svc._clearUserCart(99);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('99'), expect.any(String));
  });
});

// ─── handleMomoIPN: BooleanLiteral survivors ─────────────────────────────────

describe('PaymentService.handleMomoIPN — return value false/true exact', () => {
  it('invalid signature → return { valid: false } (BooleanLiteral false)', async () => {
    const momoGateway = buildMockMomoGateway({ verifySignature: jest.fn().mockReturnValue(false) });
    const svc = buildService({ momoGateway });
    const result = await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=1', transId: 'TX' },
    });
    expect(result).toEqual({ valid: false });
    // false !== true
    expect(result.valid).toBe(false);
  });

  it('valid flow → return { valid: true } (BooleanLiteral true)', async () => {
    const svc = buildService();
    const result = await svc.handleMomoIPN({
      body: { resultCode: 9, extraData: 'orderId=1', transId: 'TX' },
    });
    expect(result).toEqual({ valid: true });
    expect(result.valid).toBe(true);
  });

  it('processPayment success → return { valid: true } không phải { valid: false }', async () => {
    const order = buildOrder({ paymentTransactionId: null });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX', amount: 500000 },
    });

    expect(result.valid).toBe(true);
  });
});

// ─── handleVnPayReturn: processed = null/cancelled/order ─────────────────────

describe('PaymentService.handleVnPayReturn — processed return values', () => {
  it('findOrderByNumber null → processed=null → redirect success (không saveOrder)', async () => {
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(null),
    });
    const svc = buildService({ paymentRepository: repo });

    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: 'ORD-NONE',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'TX',
        vnp_Amount: '50000000',
      },
    });

    expect(redirectUrl).toContain('payment=success');
    expect(repo.saveOrder).not.toHaveBeenCalled();
  });

  it('lockOrder null → processed=null → redirect success (không saveOrder)', async () => {
    const order = buildOrder();
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(null),
    });
    const svc = buildService({ paymentRepository: repo });

    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'TX',
        vnp_Amount: '50000000',
      },
    });

    expect(redirectUrl).toContain('payment=success');
    expect(repo.saveOrder).not.toHaveBeenCalled();
  });

  it('cancelled order → processed="cancelled" → redirect với payment=failed&code=cancelled', async () => {
    const order = buildOrder({ status: 'cancelled', number: 'ORD-CXL3' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: 'ORD-CXL3',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'TX',
        vnp_Amount: '50000000',
      },
    });

    expect(redirectUrl).toContain('payment=failed');
    expect(redirectUrl).toContain('code=cancelled');
  });

  it('amount mismatch → processed="amount-mismatch" → redirect với payment=failed&code=04', async () => {
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
        vnp_TransactionNo: 'TX',
        vnp_Amount: '99999900', // ≠ 500000
      },
    });

    expect(redirectUrl).toContain('payment=failed');
    expect(redirectUrl).toContain('code=04');
  });
});

// ─── handleVnPayIPN: RspCode message exact strings ───────────────────────────

describe('PaymentService.handleVnPayIPN — RspCode Message exact strings', () => {
  it('RspCode 97 → Message = "Checksum failed"', async () => {
    const vnpayGateway = buildMockVnpayGateway({
      verifyReturnUrl: jest.fn().mockReturnValue(false),
    });
    const svc = buildService({ vnpayGateway });
    const result = await svc.handleVnPayIPN({ vnp_Params: {} });
    expect(result.Message).toBe('Checksum failed');
  });

  it('RspCode 01 khi order không tìm thấy → Message = "Order not found"', async () => {
    const repo = buildMockRepo({ findOrderByNumber: jest.fn().mockResolvedValue(null) });
    const svc = buildService({ paymentRepository: repo });
    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: 'NOPE',
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'TX',
      },
    });
    expect(result.RspCode).toBe('01');
    expect(result.Message).toBe('Order not found');
  });

  it('lockOrder null → RspCode 01, Message = "Order not found"', async () => {
    const order = buildOrder();
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(null),
    });
    const svc = buildService({ paymentRepository: repo });
    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'TX',
      },
    });
    expect(result.RspCode).toBe('01');
    expect(result.Message).toBe('Order not found');
  });

  it('order cancelled → RspCode 02, Message = "Order cancelled"', async () => {
    const order = buildOrder({ status: 'cancelled', total: 500000 });
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
        vnp_TransactionNo: 'TX',
      },
    });
    expect(result.RspCode).toBe('02');
    expect(result.Message).toBe('Order cancelled');
  });

  it('amount mismatch → RspCode 04, Message = "Invalid amount"', async () => {
    const order = buildOrder({ total: 500000 });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });
    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_Amount: '100000000',
        vnp_TransactionNo: 'TX',
      },
    });
    expect(result.RspCode).toBe('04');
    expect(result.Message).toBe('Invalid amount');
  });

  it('paymentStatus=paid → RspCode 02, Message = "Order already confirmed"', async () => {
    const order = buildOrder({ total: 500000, paymentStatus: 'paid' });
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
        vnp_TransactionNo: 'TX',
      },
    });
    expect(result.RspCode).toBe('02');
    expect(result.Message).toBe('Order already confirmed');
  });

  it('success → RspCode 00, Message = "Confirm Success"', async () => {
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
        vnp_TransactionNo: 'VNP-OK',
      },
    });
    expect(result.RspCode).toBe('00');
    expect(result.Message).toBe('Confirm Success');
  });

  it('failed (responseCode != 00) → RspCode 00, Message = "Confirm Success"', async () => {
    const order = buildOrder({ total: 500000, paymentStatus: 'pending' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });
    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '24',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'VNP-FAIL',
      },
    });
    expect(result.RspCode).toBe('00');
    expect(result.Message).toBe('Confirm Success');
  });
});

// ─── handleVnPayReturn: checksum-failed message ────────────────────────────────

describe('PaymentService.handleVnPayReturn — checksum-failed redirect', () => {
  it('invalid signature → redirectUrl = frontendUrl/orders?payment=checksum-failed', async () => {
    const vnpayGateway = buildMockVnpayGateway({
      verifyReturnUrl: jest.fn().mockReturnValue(false),
    });
    const svc = buildService({ vnpayGateway });
    const { redirectUrl } = await svc.handleVnPayReturn({ vnp_Params: {} });
    expect(redirectUrl).toBe('https://shop.test/orders?payment=checksum-failed');
  });
});

// ─── _incrementDiscountCodeUsage: với options ────────────────────────────────

describe('PaymentService._incrementDiscountCodeUsage — options truyền vào repo', () => {
  it('gọi findOrderDiscountCode với orderId và options', async () => {
    const discountCode = { id: 5 };
    const repo = buildMockRepo({
      findOrderDiscountCode: jest.fn().mockResolvedValue(discountCode),
      incrementDiscountCodeUsedCount: jest.fn().mockResolvedValue(undefined),
    });
    const svc = buildService({ paymentRepository: repo });

    const customOptions = { transaction: 'tx' };
    await svc._incrementDiscountCodeUsage(42, customOptions);

    expect(repo.findOrderDiscountCode).toHaveBeenCalledWith(42, customOptions);
    expect(repo.incrementDiscountCodeUsedCount).toHaveBeenCalledWith(5, customOptions);
  });

  it('không có discount code → không gọi incrementDiscountCodeUsedCount', async () => {
    const repo = buildMockRepo({
      findOrderDiscountCode: jest.fn().mockResolvedValue(null),
    });
    const svc = buildService({ paymentRepository: repo });
    await svc._incrementDiscountCodeUsage(42);
    expect(repo.incrementDiscountCodeUsedCount).not.toHaveBeenCalled();
  });
});
