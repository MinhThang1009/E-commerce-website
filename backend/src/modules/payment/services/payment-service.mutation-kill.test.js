/**
 * Mutation-kill tests cho PaymentService
 * Mục tiêu: giết các LIKELY-KILLABLE survivors từ Stryker mutation report.
 * Mỗi test assert OUTCOME thực sự (giá trị trả về, state thay đổi, args được gọi).
 */

const PaymentService = require('./payment-service');
const { AppError } = require('@shared/errors');

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─── _canRefund: kiểm tra đủ các nhánh string và return value ────────────────

describe('PaymentService._canRefund (qua createRefund) — kiểm tra tất cả nhánh', () => {
  it('order null → AppError 404 (order not found)', async () => {
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(null) });
    const svc = buildService({ paymentRepository: repo });
    await expect(svc.createRefund({ orderId: 99 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('paymentStatus=refunded → AppError 400 (đã hoàn tiền rồi)', async () => {
    const order = buildOrder({
      paymentStatus: 'refunded',
      paymentTransactionId: 'TX',
      paymentProvider: 'vnpay',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(svc.createRefund({ orderId: 42 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('paymentStatus=pending (chưa paid) → AppError 400', async () => {
    const order = buildOrder({ paymentStatus: 'pending' });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(svc.createRefund({ orderId: 42 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('paymentStatus=failed → AppError 400 (không phải paid)', async () => {
    const order = buildOrder({
      paymentStatus: 'failed',
      paymentTransactionId: 'TX',
      paymentProvider: 'vnpay',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(svc.createRefund({ orderId: 42 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('paymentTransactionId=null + paid → AppError 400 (không tìm thấy giao dịch)', async () => {
    const order = buildOrder({
      paymentStatus: 'paid',
      paymentTransactionId: null,
      paymentProvider: 'vnpay',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(svc.createRefund({ orderId: 42 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('paymentProvider=momo → AppError 400 (chưa hỗ trợ)', async () => {
    const order = buildOrder({
      paymentStatus: 'paid',
      paymentTransactionId: 'TX',
      paymentProvider: 'momo',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(svc.createRefund({ orderId: 42 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('paymentProvider=cod → AppError 400 (chưa hỗ trợ)', async () => {
    const order = buildOrder({
      paymentStatus: 'paid',
      paymentTransactionId: 'TX',
      paymentProvider: 'cod',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(svc.createRefund({ orderId: 42 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('vnpay + paid + transactionId → cho phép hoàn tiền (allowed=true)', async () => {
    const order = buildOrder({
      status: 'delivered',
      paymentStatus: 'paid',
      paymentTransactionId: 'VNP-TX',
      paymentProvider: 'vnpay',
      total: 500000,
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(
      svc.createRefund({ orderId: 42, amount: 100000, ipAddr: '1.2.3.4' }),
    ).resolves.toBeDefined();
  });
});

// ─── createRefund: refundAmount validation ────────────────────────────────────

describe('PaymentService.createRefund — refundAmount validation', () => {
  function buildVnpayPaidOrder(totalOverride = 500000) {
    return buildOrder({
      status: 'delivered',
      paymentStatus: 'paid',
      paymentTransactionId: 'VNP-TX',
      paymentProvider: 'vnpay',
      total: totalOverride,
    });
  }

  it('amount = order.total → hợp lệ (không throw)', async () => {
    const order = buildVnpayPaidOrder(500000);
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(
      svc.createRefund({ orderId: 42, amount: 500000, ipAddr: '1.2.3.4' }),
    ).resolves.toBeDefined();
  });

  it('amount > order.total → throw 400', async () => {
    const order = buildVnpayPaidOrder(500000);
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(svc.createRefund({ orderId: 42, amount: 500001 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('amount = 0 → throw 400 (phải > 0)', async () => {
    const order = buildVnpayPaidOrder(500000);
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(svc.createRefund({ orderId: 42, amount: 0 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('amount = -1 → throw 400 (âm không hợp lệ)', async () => {
    const order = buildVnpayPaidOrder(500000);
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(svc.createRefund({ orderId: 42, amount: -1 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('amount = null → dùng order.total làm refundAmount', async () => {
    const order = buildVnpayPaidOrder(500000);
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const vnpayGateway = buildMockVnpayGateway();
    const svc = buildService({ paymentRepository: repo, vnpayGateway });
    await svc.createRefund({ orderId: 42, amount: null, ipAddr: '1.2.3.4' });
    expect(vnpayGateway.refund).toHaveBeenCalledWith(expect.objectContaining({ amount: 500000 }));
  });

  it('amount = undefined → dùng order.total làm refundAmount', async () => {
    const order = buildVnpayPaidOrder(300000);
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const vnpayGateway = buildMockVnpayGateway();
    const svc = buildService({ paymentRepository: repo, vnpayGateway });
    await svc.createRefund({ orderId: 42, ipAddr: '1.2.3.4' });
    expect(vnpayGateway.refund).toHaveBeenCalledWith(expect.objectContaining({ amount: 300000 }));
  });
});

// ─── createRefund: transDate format và vnpayGateway.refund args ──────────────

describe('PaymentService.createRefund — vnpayGateway.refund args (transDate format)', () => {
  it('refund được gọi với transDate format YYYYMMDDHHmmss', async () => {
    const order = buildOrder({
      status: 'delivered',
      paymentStatus: 'paid',
      paymentTransactionId: 'VNP-TX',
      paymentProvider: 'vnpay',
      total: 200000,
      updatedAt: new Date('2025-06-01T14:30:00Z'),
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const vnpayGateway = buildMockVnpayGateway();
    const svc = buildService({ paymentRepository: repo, vnpayGateway });

    await svc.createRefund({ orderId: 42, amount: 100000, ipAddr: '1.2.3.4' });

    expect(vnpayGateway.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: order.number,
        amount: 100000,
        ipAddr: '1.2.3.4',
        transDate: expect.stringMatching(/^\d{14}$/), // YYYYMMDDHHmmss
      }),
    );
  });

  it('refund trả về kết quả từ vnpayGateway.refund', async () => {
    const order = buildOrder({
      status: 'delivered',
      paymentStatus: 'paid',
      paymentTransactionId: 'VNP-TX',
      paymentProvider: 'vnpay',
      total: 100000,
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const vnpayGateway = buildMockVnpayGateway({
      refund: jest.fn().mockResolvedValue({ refundId: 'REF-001', success: true }),
    });
    const svc = buildService({ paymentRepository: repo, vnpayGateway });

    const result = await svc.createRefund({ orderId: 42, amount: 50000, ipAddr: '1.2.3.4' });
    expect(result).toEqual({ refundId: 'REF-001', success: true });
  });
});

// ─── handleMomoReturn: redirect URL logic ────────────────────────────────────

describe('PaymentService.handleMomoReturn — redirect URL chính xác', () => {
  it('resultCode == 0 → redirectStatus = success', async () => {
    const svc = buildService();
    const url = await svc.handleMomoReturn({ resultCode: 0, extraData: 'orderId=5' });
    expect(url).toContain('payment=success');
    expect(url).toContain('orderId=5');
  });

  it('resultCode == "0" (string) → cũng là success (loose ==)', async () => {
    const svc = buildService();
    const url = await svc.handleMomoReturn({ resultCode: '0', extraData: 'orderId=10' });
    expect(url).toContain('payment=success');
  });

  it('resultCode = 1 → payment=failed', async () => {
    const svc = buildService();
    const url = await svc.handleMomoReturn({ resultCode: 1, extraData: 'orderId=5' });
    expect(url).toContain('payment=failed');
    expect(url).not.toContain('payment=success');
  });

  it('orderId trích xuất đúng từ extraData', async () => {
    const svc = buildService();
    const url = await svc.handleMomoReturn({ resultCode: 0, extraData: 'foo=bar&orderId=99&x=1' });
    expect(url).toContain('orderId=99');
  });

  it('extraData = null/undefined → orderId rỗng nhưng không throw', async () => {
    const svc = buildService();
    // extraData undefined → match trả null → orderId = ''
    await expect(svc.handleMomoReturn({ resultCode: 0, extraData: undefined })).resolves.toContain(
      'orderId=',
    );
  });

  it('URL bắt đầu bằng frontendUrl', async () => {
    const svc = buildService();
    const url = await svc.handleMomoReturn({ resultCode: 0, extraData: 'orderId=1' });
    expect(url).toMatch(/^https:\/\/shop\.test/);
  });
});

// ─── handleMomoIPN: xử lý đầy đủ success flow ───────────────────────────────

describe('PaymentService.handleMomoIPN — success flow state changes', () => {
  it('order.status = processing sau IPN success', async () => {
    const order = buildOrder({ paymentStatus: 'pending', paymentTransactionId: null });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-1', amount: 500000 },
    });

    expect(order.status).toBe('processing');
    expect(order.paymentStatus).toBe('paid');
    expect(order.paymentProvider).toBe('momo');
    expect(order.paymentTransactionId).toBe('TX-1');
  });

  it('order.updatedAt được set sau IPN success', async () => {
    const beforeTime = new Date();
    const order = buildOrder({ paymentTransactionId: null });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-UPD', amount: 500000 },
    });

    expect(order.updatedAt).toBeInstanceOf(Date);
    expect(order.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
  });

  it('IPN success → _incrementDiscountCodeUsage được gọi', async () => {
    const order = buildOrder({ paymentTransactionId: null });
    const repo = buildMockRepo({
      lockOrder: jest.fn().mockResolvedValue(order),
      findOrderDiscountCode: jest.fn().mockResolvedValue({ id: 3 }),
      incrementDiscountCodeUsedCount: jest.fn().mockResolvedValue(undefined),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-DISC', amount: 500000 },
    });

    expect(repo.incrementDiscountCodeUsedCount).toHaveBeenCalledWith(3, expect.anything());
  });

  it('IPN success → _clearUserCart được gọi cho userId', async () => {
    const order = buildOrder({ userId: 7, paymentTransactionId: null });
    const cart = { id: 5, status: 'active' };
    const repo = buildMockRepo({
      lockOrder: jest.fn().mockResolvedValue(order),
      findActiveCartsByUser: jest.fn().mockResolvedValue([cart]),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-CART', amount: 500000 },
    });

    expect(repo.findActiveCartsByUser).toHaveBeenCalledWith(7);
    expect(cart.status).toBe('converted');
  });

  it('resultCode != 0 và paymentStatus=failed → không gọi _clearUserCart/_incrementDiscount', async () => {
    const order = buildOrder({ paymentStatus: 'pending' });
    const repo = buildMockRepo({
      lockOrder: jest.fn().mockResolvedValue(order),
      findActiveCartsByUser: jest.fn().mockResolvedValue([]),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 9, extraData: 'orderId=42', transId: 'TX-FAIL' },
    });

    // Không gọi findActiveCartsByUser (không clear cart cho payment failure)
    expect(repo.findActiveCartsByUser).not.toHaveBeenCalled();
    expect(order.paymentStatus).toBe('failed');
  });

  it('saveOrder được gọi với transaction khi IPN success', async () => {
    const order = buildOrder({ paymentTransactionId: null });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-SAVE', amount: 500000 },
    });

    expect(repo.saveOrder).toHaveBeenCalledWith(order, { transaction: expect.anything() });
  });

  it('IPN logger.info được gọi với resultCode và orderId', async () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ logger });

    await svc.handleMomoIPN({
      body: { resultCode: 9, extraData: 'orderId=1', transId: 'TX' },
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ resultCode: 9 }),
    );
  });
});

// ─── handleVnPayReturn: success flow ─────────────────────────────────────────

describe('PaymentService.handleVnPayReturn — success flow state changes', () => {
  it('order.status = processing và paymentProvider = vnpay sau return success', async () => {
    const order = buildOrder({ paymentStatus: 'pending', paymentTransactionId: null });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'VNP-TX',
        vnp_Amount: '50000000',
      },
    });

    expect(order.status).toBe('processing');
    expect(order.paymentProvider).toBe('vnpay');
    expect(order.paymentTransactionId).toBe('VNP-TX');
  });

  it('order.updatedAt được set sau return success', async () => {
    const order = buildOrder({ paymentTransactionId: null });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });
    const before = new Date();

    await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'VNP-TX-UPD',
        vnp_Amount: '50000000',
      },
    });

    expect(order.updatedAt).toBeInstanceOf(Date);
    expect(order.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('VnPay return success → _incrementDiscountCodeUsage được gọi', async () => {
    const order = buildOrder({ paymentTransactionId: null });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
      findOrderDiscountCode: jest.fn().mockResolvedValue({ id: 9 }),
      incrementDiscountCodeUsedCount: jest.fn().mockResolvedValue(undefined),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'VNP-TX-D',
        vnp_Amount: '50000000',
      },
    });

    expect(repo.incrementDiscountCodeUsedCount).toHaveBeenCalledWith(9, expect.anything());
  });

  it('VnPay return success → _clearUserCart được gọi', async () => {
    const order = buildOrder({ userId: 7, paymentTransactionId: null });
    const cart = { id: 3, status: 'active' };
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
      findActiveCartsByUser: jest.fn().mockResolvedValue([cart]),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'VNP-TX-CART',
        vnp_Amount: '50000000',
      },
    });

    expect(repo.findActiveCartsByUser).toHaveBeenCalledWith(7);
    expect(cart.status).toBe('converted');
  });

  it('vnp_Amount không truyền (NaN) → không check amount mismatch', async () => {
    const order = buildOrder({ paymentTransactionId: null });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'VNP-TX-NOAMT',
        // vnp_Amount không truyền → parseInt undefined → NaN → isFinite(NaN) = false → skip
      },
    });

    expect(redirectUrl).toContain('payment=success');
    expect(order.paymentStatus).toBe('paid');
  });

  it('redirectUrl chứa order number sau success', async () => {
    const order = buildOrder({ number: 'ORD-REDIR', paymentTransactionId: null });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: 'ORD-REDIR',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'VNP-TX',
        vnp_Amount: '50000000',
      },
    });

    expect(redirectUrl).toContain('order=ORD-REDIR');
    expect(redirectUrl).toMatch(/^https:\/\/shop\.test/);
  });
});

// ─── handleVnPayReturn: regex safeCode ────────────────────────────────────────

describe('PaymentService.handleVnPayReturn — safeCode regex', () => {
  it('responseCode chính xác 2 chữ số (DD) → dùng code thật', async () => {
    const svc = buildService();
    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: { vnp_TxnRef: 'ORD', vnp_ResponseCode: '24', vnp_TransactionNo: '' },
    });
    expect(redirectUrl).toContain('code=24');
  });

  it('responseCode 1 chữ số → code=unknown (không match /^\\d{2}$/)', async () => {
    const svc = buildService();
    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: { vnp_TxnRef: 'ORD', vnp_ResponseCode: '9', vnp_TransactionNo: '' },
    });
    expect(redirectUrl).toContain('code=unknown');
  });

  it('responseCode 3 chữ số → code=unknown (vượt 2 chữ số)', async () => {
    const svc = buildService();
    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: { vnp_TxnRef: 'ORD', vnp_ResponseCode: '123', vnp_TransactionNo: '' },
    });
    expect(redirectUrl).toContain('code=unknown');
  });

  it('responseCode "00" → không đi vào nhánh failed (vì xử lý riêng ở trên)', async () => {
    // responseCode='00' xử lý ở nhánh success → nhánh safeCode không reach
    // Test này verify nhánh failed không xảy ra khi responseCode='00'
    const svc = buildService();
    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: { vnp_TxnRef: 'ORD-NONE', vnp_ResponseCode: '00', vnp_TransactionNo: '' },
    });
    expect(redirectUrl).not.toContain('payment=failed');
  });
});

// ─── handleVnPayIPN: RspCode chính xác ────────────────────────────────────────

describe('PaymentService.handleVnPayIPN — RspCode và state changes', () => {
  it('success: order.status=processing, paymentStatus=paid, provider=vnpay', async () => {
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
    expect(result.Message).toBe('Confirm Success');
    expect(order.status).toBe('processing');
    expect(order.paymentStatus).toBe('paid');
    expect(order.paymentProvider).toBe('vnpay');
    expect(order.paymentTransactionId).toBe('VNP-IPN-OK');
  });

  it('IPN success → result.order có id và userId cho post-processing', async () => {
    const order = buildOrder({ id: 55, userId: 3, total: 500000, paymentStatus: 'pending' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'VNP-R',
      },
    });

    // Post-processing: _incrementDiscountCodeUsage và _clearUserCart
    expect(repo.findOrderDiscountCode).toHaveBeenCalledWith(55, expect.anything());
  });

  it('IPN success → _clearUserCart được gọi cho userId', async () => {
    const order = buildOrder({ id: 55, userId: 3, total: 500000, paymentStatus: 'pending' });
    const cart = { id: 7, status: 'active' };
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
      findActiveCartsByUser: jest.fn().mockResolvedValue([cart]),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'VNP-CART',
      },
    });

    expect(repo.findActiveCartsByUser).toHaveBeenCalledWith(3);
    expect(cart.status).toBe('converted');
  });

  it('IPN success → saveOrder gọi với transaction', async () => {
    const order = buildOrder({ total: 500000, paymentStatus: 'pending' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'VNP-IPN-SAVE',
      },
    });

    expect(repo.saveOrder).toHaveBeenCalledWith(order, { transaction: expect.anything() });
  });

  it('IPN failed (responseCode != 00): order.paymentStatus = failed, saveOrder gọi', async () => {
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
        vnp_TransactionNo: 'VNP-IPN-FAIL',
      },
    });

    expect(result.RspCode).toBe('00');
    expect(order.paymentStatus).toBe('failed');
    expect(repo.saveOrder).toHaveBeenCalledWith(order, { transaction: expect.anything() });
  });

  it('IPN success → không gọi post-processing khi result.order undefined', async () => {
    // Khi order không tìm thấy → result.order không có → không gọi _increment/_clear
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(null),
    });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: 'NONEXISTENT',
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'VNP',
      },
    });

    expect(result.RspCode).toBe('01');
    expect(repo.findOrderDiscountCode).not.toHaveBeenCalled();
  });

  it('IPN: order.updatedAt được set sau success', async () => {
    const order = buildOrder({ total: 500000, paymentStatus: 'pending' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });
    const before = new Date();

    await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'VNP-IPN-TIME',
      },
    });

    expect(order.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('IPN failed: order.updatedAt được set', async () => {
    const order = buildOrder({ total: 500000, paymentStatus: 'pending' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });
    const before = new Date();

    await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '99',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'TX-FAIL-TIME',
      },
    });

    expect(order.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('IPN cancelled guard: RspCode 02 khi order.status = cancelled', async () => {
    const order = buildOrder({ status: 'cancelled', total: 500000, paymentStatus: 'pending' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ paymentRepository: repo, logger });

    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'VNP-CXL',
      },
    });

    expect(result.RspCode).toBe('02');
    expect(logger.warn).toHaveBeenCalled();
    expect(order.paymentStatus).not.toBe('paid');
  });
});

// ─── handleVnPayIPN: BlockStatement post-processing ──────────────────────────

describe('PaymentService.handleVnPayIPN — post-processing block (L342)', () => {
  it('IPN success → _sendOrderConfirmationEmailSafe được gọi với orderId', async () => {
    const order = buildOrder({ id: 55, total: 500000, paymentStatus: 'pending' });
    const detailedOrder = buildOrder({
      id: 55,
      User: { email: 'cust@test.com' },
      items: [],
    });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(detailedOrder),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined) };
    const svc = buildService({ paymentRepository: repo, emailGateway });

    await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'VNP-EMAIL',
      },
    });

    expect(repo.findOrderByPkWithItemsAndUser).toHaveBeenCalledWith(55);
  });
});

// ─── createRefund: nhánh pending/processing delegate ordersService ────────────

describe('PaymentService.createRefund — nhánh status (pending/processing) vs (shipped/delivered)', () => {
  it('status=pending → delegate ordersService.updateOrderStatus', async () => {
    const order = buildOrder({
      status: 'pending',
      paymentStatus: 'paid',
      paymentTransactionId: 'VNP-TX',
      paymentProvider: 'vnpay',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const ordersService = { updateOrderStatus: jest.fn().mockResolvedValue(undefined) };
    const svc = buildService({ paymentRepository: repo, ordersService });

    await svc.createRefund({ orderId: 42, amount: 100000, ipAddr: '1.2.3.4' });

    expect(ordersService.updateOrderStatus).toHaveBeenCalledWith({
      id: order.id,
      status: 'cancelled',
      paymentStatus: 'refunded',
    });
    expect(repo.saveOrder).not.toHaveBeenCalled();
  });

  it('status=processing → delegate ordersService.updateOrderStatus', async () => {
    const order = buildOrder({
      status: 'processing',
      paymentStatus: 'paid',
      paymentTransactionId: 'VNP-TX',
      paymentProvider: 'vnpay',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const ordersService = { updateOrderStatus: jest.fn().mockResolvedValue(undefined) };
    const svc = buildService({ paymentRepository: repo, ordersService });

    await svc.createRefund({ orderId: 42, amount: 100000, ipAddr: '1.2.3.4' });

    expect(ordersService.updateOrderStatus).toHaveBeenCalled();
    expect(repo.saveOrder).not.toHaveBeenCalled();
  });

  it('status=shipped → đi nhánh else: saveOrder, paymentStatus=refunded', async () => {
    const order = buildOrder({
      status: 'shipped',
      paymentStatus: 'paid',
      paymentTransactionId: 'VNP-TX',
      paymentProvider: 'vnpay',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const ordersService = { updateOrderStatus: jest.fn() };
    const svc = buildService({ paymentRepository: repo, ordersService });

    await svc.createRefund({ orderId: 42, amount: 100000, ipAddr: '1.2.3.4' });

    expect(ordersService.updateOrderStatus).not.toHaveBeenCalled();
    expect(order.paymentStatus).toBe('refunded');
    expect(repo.saveOrder).toHaveBeenCalledWith(order);
  });

  it('status=delivered → đi nhánh else: saveOrder, paymentStatus=refunded', async () => {
    const order = buildOrder({
      status: 'delivered',
      paymentStatus: 'paid',
      paymentTransactionId: 'VNP-TX',
      paymentProvider: 'vnpay',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const ordersService = { updateOrderStatus: jest.fn() };
    const svc = buildService({ paymentRepository: repo, ordersService });

    await svc.createRefund({ orderId: 42, amount: 200000, ipAddr: '1.2.3.4' });

    expect(ordersService.updateOrderStatus).not.toHaveBeenCalled();
    expect(order.paymentStatus).toBe('refunded');
    expect(repo.saveOrder).toHaveBeenCalledWith(order);
  });
});

// ─── _sendOrderConfirmationEmailSafe: branches ────────────────────────────────

describe('PaymentService._sendOrderConfirmationEmailSafe — tất cả nhánh', () => {
  it('order không tồn tại (findOrderByPkWithItemsAndUser null) → return sớm', async () => {
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(null),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn() };
    const svc = buildService({ paymentRepository: repo, emailGateway });

    await svc._sendOrderConfirmationEmailSafe(999);

    expect(emailGateway.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it('email được gửi với đầy đủ fields (subtotal, shippingCost, total)', async () => {
    const order = buildOrder({
      User: { email: 'cust@test.com' },
      items: [{ name: 'Test', quantity: 1, unitPrice: '100000', subtotal: '100000' }],
      subtotal: 480000,
      shippingCost: 20000,
      total: 500000,
    });
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(order),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined) };
    const svc = buildService({ paymentRepository: repo, emailGateway });

    await svc._sendOrderConfirmationEmailSafe(42);

    expect(emailGateway.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      'cust@test.com',
      expect.objectContaining({
        subtotal: 480000,
        shippingCost: 20000,
        total: 500000,
        orderNumber: order.number,
      }),
    );
  });

  it('email có shippingAddress với name = firstName + lastName', async () => {
    const order = buildOrder({
      User: { email: 'u@t.com' },
      items: [],
      shippingFirstName: 'Nguyen',
      shippingLastName: 'Van A',
    });
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(order),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined) };
    const svc = buildService({ paymentRepository: repo, emailGateway });

    await svc._sendOrderConfirmationEmailSafe(42);

    expect(emailGateway.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      'u@t.com',
      expect.objectContaining({
        shippingAddress: expect.objectContaining({ name: 'Nguyen Van A' }),
      }),
    );
  });
});

// ─── MoMo IPN: orderId = null khi extraData khớp ─────────────────────────────

describe('PaymentService.handleMomoIPN — orderId extraction', () => {
  it('extraData có orderId → orderId được trích xuất đúng, lockOrder được gọi với orderId đó', async () => {
    const order = buildOrder({ paymentTransactionId: null });
    const repo = buildMockRepo({
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=77', transId: 'TX', amount: 500000 },
    });

    expect(repo.lockOrder).toHaveBeenCalledWith('77', expect.anything());
  });
});

// ─── createRefund: paymentMethod COD (không có transactionId) ─────────────────

describe('PaymentService.createRefund — orderId validation', () => {
  it('orderId = 0 (falsy) → throw AppError 400', async () => {
    const svc = buildService();
    await expect(svc.createRefund({ orderId: 0 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('orderId = "" → throw AppError 400', async () => {
    const svc = buildService();
    await expect(svc.createRefund({ orderId: '' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('orderId = undefined → throw AppError 400', async () => {
    const svc = buildService();
    await expect(svc.createRefund({ orderId: undefined })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('orderId hợp lệ (truthy) → không throw ở bước orderId check', async () => {
    const order = buildOrder({
      status: 'delivered',
      paymentStatus: 'paid',
      paymentTransactionId: 'TX',
      paymentProvider: 'vnpay',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    await expect(
      svc.createRefund({ orderId: 42, amount: 100000, ipAddr: '1.2.3.4' }),
    ).resolves.toBeDefined();
  });
});

// ─── createVNPayUrl: args chính xác ──────────────────────────────────────────

describe('PaymentService.createVNPayUrl — args truyền vào vnpayGateway', () => {
  it('gọi createPaymentUrl với orderId=order.number, amount=order.total', async () => {
    const order = buildOrder({ number: 'ORD-VNP', total: 750000 });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const vnpayGateway = buildMockVnpayGateway();
    const svc = buildService({ paymentRepository: repo, vnpayGateway });

    await svc.createVNPayUrl({ orderId: 42, userId: 7, ipAddr: '10.0.0.1' });

    expect(vnpayGateway.createPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ORD-VNP',
        amount: 750000,
        ipAddr: '10.0.0.1',
        orderInfo: expect.stringContaining('ORD-VNP'),
      }),
    );
  });
});

// ─── createMomoUrl: args chính xác ───────────────────────────────────────────

describe('PaymentService.createMomoUrl — args truyền vào momoGateway', () => {
  it('gọi createPaymentUrl với orderInfo chứa order.number', async () => {
    const order = buildOrder({ number: 'ORD-MOMO-001', total: 300000 });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const momoGateway = buildMockMomoGateway();
    const svc = buildService({ paymentRepository: repo, momoGateway });

    await svc.createMomoUrl({ orderId: 42, userId: 7 });

    expect(momoGateway.createPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ORD-MOMO-001',
        amount: 300000,
        orderInfo: expect.stringContaining('ORD-MOMO-001'),
        extraData: 'orderId=42',
      }),
    );
  });
});

// ─── handleMomoIPN: logger.warn khi order cancelled ──────────────────────────

describe('PaymentService.handleMomoIPN — logger.warn cho cancelled order', () => {
  it('logger.warn được gọi khi IPN success trên đơn cancelled', async () => {
    const order = buildOrder({ status: 'cancelled' });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ paymentRepository: repo, logger });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-CXL', amount: 500000 },
    });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('HỦY'), expect.anything());
    expect(order.paymentStatus).not.toBe('paid');
  });
});

// ─── handleVnPayReturn: logger.warn khi order cancelled ──────────────────────

describe('PaymentService.handleVnPayReturn — logger.warn cho cancelled order', () => {
  it('logger.warn được gọi khi VNPay return success trên đơn cancelled', async () => {
    const order = buildOrder({ status: 'cancelled', number: 'ORD-CXL' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ paymentRepository: repo, logger });

    await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: 'ORD-CXL',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'VNP-CXL',
        vnp_Amount: '50000000',
      },
    });

    expect(logger.warn).toHaveBeenCalled();
  });
});

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

// ─── handleMomoIPN: post-processing KHÔNG chạy khi payment bị từ chối ──────────
// Kill L169 (return false → true), L179 (return false → true), L182 (return false → true), L193 (if(processed)→true)

describe('PaymentService.handleMomoIPN — post-processing KHÔNG chạy khi payment bị từ chối', () => {
  it('đơn cancelled → _incrementDiscountCodeUsage KHÔNG được gọi (kill L169 BooleanLiteral→true)', async () => {
    const order = buildOrder({ status: 'cancelled', paymentTransactionId: null });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    const spyIncrement = jest
      .spyOn(svc, '_incrementDiscountCodeUsage')
      .mockResolvedValue(undefined);
    const spyClear = jest.spyOn(svc, '_clearUserCart').mockResolvedValue(undefined);
    const spyEmail = jest
      .spyOn(svc, '_sendOrderConfirmationEmailSafe')
      .mockResolvedValue(undefined);

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-CXL', amount: 500000 },
    });

    // Đơn cancelled → processed = false → post-processing block KHÔNG chạy
    expect(spyIncrement).not.toHaveBeenCalled();
    expect(spyClear).not.toHaveBeenCalled();
    expect(spyEmail).not.toHaveBeenCalled();
    // order.paymentStatus KHÔNG thay đổi thành 'paid'
    expect(order.paymentStatus).not.toBe('paid');
  });

  it('amount mismatch → _incrementDiscountCodeUsage KHÔNG được gọi (kill L179 BooleanLiteral→true)', async () => {
    const order = buildOrder({ total: 500000, paymentTransactionId: null });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    const spyIncrement = jest
      .spyOn(svc, '_incrementDiscountCodeUsage')
      .mockResolvedValue(undefined);
    const spyClear = jest.spyOn(svc, '_clearUserCart').mockResolvedValue(undefined);
    const spyEmail = jest
      .spyOn(svc, '_sendOrderConfirmationEmailSafe')
      .mockResolvedValue(undefined);

    await svc.handleMomoIPN({
      body: {
        resultCode: 0,
        extraData: 'orderId=42',
        transId: 'TX-AMT',
        amount: 100000, // khác 500000 → mismatch
      },
    });

    // Amount mismatch → processed = false → post-processing KHÔNG chạy
    expect(spyIncrement).not.toHaveBeenCalled();
    expect(spyClear).not.toHaveBeenCalled();
    expect(spyEmail).not.toHaveBeenCalled();
    expect(order.paymentStatus).not.toBe('paid');
  });

  it('trùng transId (đã paid) → _incrementDiscountCodeUsage KHÔNG được gọi (kill L182 BooleanLiteral→true)', async () => {
    // _canProcessPayment: transId khớp paymentTransactionId → return false → processed = false
    const order = buildOrder({ paymentStatus: 'paid', paymentTransactionId: 'TX-DUPE' });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    const spyIncrement = jest
      .spyOn(svc, '_incrementDiscountCodeUsage')
      .mockResolvedValue(undefined);
    const spyClear = jest.spyOn(svc, '_clearUserCart').mockResolvedValue(undefined);
    const spyEmail = jest
      .spyOn(svc, '_sendOrderConfirmationEmailSafe')
      .mockResolvedValue(undefined);

    await svc.handleMomoIPN({
      body: {
        resultCode: 0,
        extraData: 'orderId=42',
        transId: 'TX-DUPE', // trùng với paymentTransactionId → _canProcessPayment = false
        amount: 500000,
      },
    });

    // Idempotent: _canProcessPayment = false → processed = false → post-processing KHÔNG chạy
    expect(spyIncrement).not.toHaveBeenCalled();
    expect(spyClear).not.toHaveBeenCalled();
    expect(spyEmail).not.toHaveBeenCalled();
  });

  it('IPN success hợp lệ → _incrementDiscountCodeUsage, _clearUserCart, _sendEmail ĐỀU được gọi (kill L193 if(processed)→true)', async () => {
    const order = buildOrder({ paymentTransactionId: null });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });
    const spyIncrement = jest
      .spyOn(svc, '_incrementDiscountCodeUsage')
      .mockResolvedValue(undefined);
    const spyClear = jest.spyOn(svc, '_clearUserCart').mockResolvedValue(undefined);
    const spyEmail = jest
      .spyOn(svc, '_sendOrderConfirmationEmailSafe')
      .mockResolvedValue(undefined);

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-OK', amount: 500000 },
    });

    // processed = order object → if(processed) = true → tất cả 3 hàm phải được gọi
    expect(spyIncrement).toHaveBeenCalledWith(order.id);
    expect(spyClear).toHaveBeenCalledWith(order.userId);
    expect(spyEmail).toHaveBeenCalledWith(order.id);
    // Và order đã được set paid
    expect(order.paymentStatus).toBe('paid');
  });
});

// ─── _canProcessPayment: idempotency boundary — duplicate transId → return false (kill L15) ──

describe('PaymentService._canProcessPayment — idempotency via handleMomoIPN (kill L15 ConditionalExpression→false)', () => {
  it('transId trùng paymentTransactionId → saveOrder KHÔNG gọi lần 2 (không mark paid lại)', async () => {
    // L15: if (transactionId && order.paymentTransactionId === transactionId) return false;
    // Mutant→false: bỏ check → luôn xử lý → double-process → mark paid lần 2
    const order = buildOrder({ paymentStatus: 'pending', paymentTransactionId: 'TX-SAME' });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-SAME', amount: 500000 },
    });

    // paymentTransactionId === transId → _canProcessPayment → false → KHÔNG saveOrder
    expect(repo.saveOrder).not.toHaveBeenCalled();
    // status KHÔNG thay đổi (vẫn như ban đầu, không set 'processing')
    expect(order.status).not.toBe('processing');
  });

  it('transId khác nhau → _canProcessPayment → true → xử lý bình thường (saveOrder được gọi)', async () => {
    const order = buildOrder({ paymentStatus: 'pending', paymentTransactionId: 'TX-OLD' });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-NEW', amount: 500000 },
    });

    expect(repo.saveOrder).toHaveBeenCalled();
    expect(order.paymentStatus).toBe('paid');
  });

  it('paymentStatus đã paid (không transId match) → saveOrder KHÔNG được gọi (paymentStatus !== paid guard)', async () => {
    // _canProcessPayment: paymentStatus === 'paid' → return false
    const order = buildOrder({ paymentStatus: 'paid', paymentTransactionId: null });
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=42', transId: 'TX-XYZ', amount: 500000 },
    });

    // paymentStatus === 'paid' → _canProcessPayment returns false → không saveOrder
    expect(repo.saveOrder).not.toHaveBeenCalled();
    expect(order.status).not.toBe('processing');
  });
});

// ─── _sendOrderConfirmationEmailSafe: !order || !order.User guard (kill L61) ───

describe('PaymentService._sendOrderConfirmationEmailSafe — guard !order || !order.User (kill L61)', () => {
  it('order.User = undefined → email KHÔNG được gửi (ConditionalExpression→false sẽ bỏ qua guard)', async () => {
    // L61: if (!order || !order.User) return;
    // Mutant ConditionalExpression→false: bỏ qua guard → gọi email dù User undefined → crash
    const order = buildOrder({ User: undefined, items: [] });
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(order),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn() };
    const svc = buildService({ paymentRepository: repo, emailGateway });

    await svc._sendOrderConfirmationEmailSafe(42);

    expect(emailGateway.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it('order.User = null → email KHÔNG được gửi (LogicalOperator !order && !order.User)', async () => {
    // LogicalOperator: !order || !order.User mutated to !order && !order.User
    // Khi order != null nhưng User = null: !order=false, !User=true
    // Original (||): false || true = true → return (đúng)
    // Mutant (&&): false && true = false → KHÔNG return → crash khi gọi email với user.email=undefined
    const order = buildOrder({ User: null, items: [] });
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(order),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn() };
    const svc = buildService({ paymentRepository: repo, emailGateway });

    await svc._sendOrderConfirmationEmailSafe(42);

    // Với original code: !order.User = true → return sớm → không gọi email
    expect(emailGateway.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it('order = null → email KHÔNG được gửi (cả 2 phía của guard)', async () => {
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(null),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn() };
    const svc = buildService({ paymentRepository: repo, emailGateway });

    await svc._sendOrderConfirmationEmailSafe(999);

    expect(emailGateway.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it('order có User hợp lệ → email ĐƯỢC gửi (phân biệt với 2 case trên)', async () => {
    // Đây là "hai phía" của điều kiện — phải có test cho cả true và false branch
    const order = buildOrder({ User: { email: 'user@test.com' }, items: [] });
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(order),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined) };
    const svc = buildService({ paymentRepository: repo, emailGateway });

    await svc._sendOrderConfirmationEmailSafe(42);

    expect(emailGateway.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      'user@test.com',
      expect.objectContaining({ orderNumber: order.number }),
    );
  });
});

// ─── _incrementDiscountCodeUsage: code=null → KHÔNG gọi increment (kill L112) ──

describe('PaymentService._incrementDiscountCodeUsage — conditional guard code (kill L112 ConditionalExpression→true)', () => {
  it('findOrderDiscountCode trả null → incrementDiscountCodeUsedCount KHÔNG gọi (null là falsy)', async () => {
    // L112: if (code) await this.repo.incrementDiscountCodeUsedCount(code.id, options);
    // Mutant→true: bỏ guard → gọi increment dù code=null → crash code.id
    const repo = buildMockRepo({
      findOrderDiscountCode: jest.fn().mockResolvedValue(null),
      incrementDiscountCodeUsedCount: jest.fn().mockResolvedValue(undefined),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc._incrementDiscountCodeUsage(42);

    expect(repo.incrementDiscountCodeUsedCount).not.toHaveBeenCalled();
  });

  it('findOrderDiscountCode trả về code object → incrementDiscountCodeUsedCount ĐƯỢC gọi với code.id', async () => {
    // Two-sided: code !== null → increment PHẢI được gọi
    const discountCode = { id: 99 };
    const repo = buildMockRepo({
      findOrderDiscountCode: jest.fn().mockResolvedValue(discountCode),
      incrementDiscountCodeUsedCount: jest.fn().mockResolvedValue(undefined),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc._incrementDiscountCodeUsage(42);

    expect(repo.incrementDiscountCodeUsedCount).toHaveBeenCalledWith(99, expect.anything());
  });
});

// ─── handleMomoIPN: return { valid: false } khi sig invalid (kill L159 BooleanLiteral→true) ─

describe('PaymentService.handleMomoIPN — return { valid: false } khi signature invalid (kill L159)', () => {
  it('verifySignature = false → return { valid: false } (không phải { valid: true })', async () => {
    // L159: return { valid: false }; — Mutant→true: return { valid: true }
    // Test assert EXACT value = false, bắt được mutant→true
    const momoGateway = buildMockMomoGateway({
      verifySignature: jest.fn().mockReturnValue(false),
    });
    const svc = buildService({ momoGateway });

    const result = await svc.handleMomoIPN({
      body: { resultCode: 0, extraData: 'orderId=1', transId: 'TX' },
    });

    expect(result).toEqual({ valid: false });
    expect(result.valid).toBe(false); // Không phải true
    expect(result.valid).not.toBe(true);
  });

  it('verifySignature = true và resultCode thất bại → return { valid: true } (đảm bảo false vs true không mix)', async () => {
    const momoGateway = buildMockMomoGateway({
      verifySignature: jest.fn().mockReturnValue(true),
    });
    const svc = buildService({ momoGateway });

    const result = await svc.handleMomoIPN({
      body: { resultCode: 9, extraData: 'orderId=1', transId: 'TX' },
    });

    expect(result).toEqual({ valid: true });
    expect(result.valid).toBe(true);
    expect(result.valid).not.toBe(false);
  });
});

// ─── handleVnPayReturn: post-processing KHÔNG chạy khi payment bị từ chối ──────
// (Cùng pattern với MoMo nhưng cho VNPay Return)

describe('PaymentService.handleVnPayReturn — post-processing KHÔNG chạy khi payment bị từ chối', () => {
  it('đơn cancelled → post-processing KHÔNG chạy (processed = "cancelled")', async () => {
    const order = buildOrder({ status: 'cancelled', number: 'ORD-CXL-R' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });
    const spyIncrement = jest
      .spyOn(svc, '_incrementDiscountCodeUsage')
      .mockResolvedValue(undefined);
    const spyClear = jest.spyOn(svc, '_clearUserCart').mockResolvedValue(undefined);
    const spyEmail = jest
      .spyOn(svc, '_sendOrderConfirmationEmailSafe')
      .mockResolvedValue(undefined);

    await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: 'ORD-CXL-R',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'TX-R-CXL',
        vnp_Amount: '50000000',
      },
    });

    // processed = 'cancelled' (string falsy? no — string truthy!)
    // Kiểm tra: post-processing chỉ chạy nếu processed là order object
    // processed === 'cancelled' (non-null, non-false) NHƯNG check 'if (processed)' là truthy
    // → logic đúng là check 'processed === "amount-mismatch"' và 'processed === "cancelled"' trước
    // → post-processing KHÔNG chạy (chỉ chạy với order object thật)
    expect(spyIncrement).not.toHaveBeenCalled();
    expect(spyClear).not.toHaveBeenCalled();
    expect(spyEmail).not.toHaveBeenCalled();
    expect(order.paymentStatus).not.toBe('paid');
  });

  it('amount mismatch → post-processing KHÔNG chạy (processed = "amount-mismatch")', async () => {
    const order = buildOrder({ total: 500000, paymentTransactionId: null });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });
    const spyIncrement = jest
      .spyOn(svc, '_incrementDiscountCodeUsage')
      .mockResolvedValue(undefined);
    const spyClear = jest.spyOn(svc, '_clearUserCart').mockResolvedValue(undefined);
    const spyEmail = jest
      .spyOn(svc, '_sendOrderConfirmationEmailSafe')
      .mockResolvedValue(undefined);

    await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'TX-AMT-R',
        vnp_Amount: '99999900', // ≠ 500000
      },
    });

    expect(spyIncrement).not.toHaveBeenCalled();
    expect(spyClear).not.toHaveBeenCalled();
    expect(spyEmail).not.toHaveBeenCalled();
    expect(order.paymentStatus).not.toBe('paid');
  });

  it('VNPay return success hợp lệ → tất cả 3 post-processing ĐỀU được gọi', async () => {
    const order = buildOrder({ paymentTransactionId: null });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });
    const spyIncrement = jest
      .spyOn(svc, '_incrementDiscountCodeUsage')
      .mockResolvedValue(undefined);
    const spyClear = jest.spyOn(svc, '_clearUserCart').mockResolvedValue(undefined);
    const spyEmail = jest
      .spyOn(svc, '_sendOrderConfirmationEmailSafe')
      .mockResolvedValue(undefined);

    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'TX-VNP-OK',
        vnp_Amount: '50000000', // 500000đ
      },
    });

    expect(spyIncrement).toHaveBeenCalledWith(order.id);
    expect(spyClear).toHaveBeenCalledWith(order.userId);
    expect(spyEmail).toHaveBeenCalledWith(order.id);
    expect(redirectUrl).toContain('payment=success');
    expect(order.paymentStatus).toBe('paid');
  });

  it('trùng transId (idempotent) → post-processing KHÔNG chạy', async () => {
    // _canProcessPayment: transId trùng → return null → processed = null (falsy)
    const order = buildOrder({ paymentStatus: 'pending', paymentTransactionId: 'TX-DUPE-VNP' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });
    const spyIncrement = jest
      .spyOn(svc, '_incrementDiscountCodeUsage')
      .mockResolvedValue(undefined);
    const spyClear = jest.spyOn(svc, '_clearUserCart').mockResolvedValue(undefined);
    const spyEmail = jest
      .spyOn(svc, '_sendOrderConfirmationEmailSafe')
      .mockResolvedValue(undefined);

    await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: order.number,
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'TX-DUPE-VNP', // trùng → _canProcessPayment → null → không process
        vnp_Amount: '50000000',
      },
    });

    expect(spyIncrement).not.toHaveBeenCalled();
    expect(spyClear).not.toHaveBeenCalled();
    expect(spyEmail).not.toHaveBeenCalled();
  });
});
