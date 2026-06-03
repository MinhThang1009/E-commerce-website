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
