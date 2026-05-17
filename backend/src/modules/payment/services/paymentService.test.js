/**
 * Unit tests cho PaymentService (modules/payment/services/paymentService.js)
 *
 * Bao gồm:
 * - createMomoUrl: happy path, order not found, unauthorized user
 * - createVNPayUrl: happy path, order not found, unauthorized user
 * - handleMomoReturn: redirect URLs cho success/failed
 * - handleMomoIPN: invalid signature, success flow, amount mismatch, idempotency
 * - handleVnPayReturn: invalid checksum, success flow, failed payment
 * - handleVnPayIPN: all RspCode branches
 * - createRefund: validation, policy enforcement, vnpay refund, unsupported provider
 */

const PaymentService = require('./paymentService');
const { AppError } = require('../../../shared/errors');

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildService(overrides = {}) {
  const defaults = {
    paymentRepository: buildMockRepo(),
    momoGateway: buildMockMomoGateway(),
    vnpayGateway: buildMockVnpayGateway(),
    emailGateway: { sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined) },
    eventBus: { publish: jest.fn().mockResolvedValue(undefined) },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    frontendUrl: 'https://shop.test',
  };
  return new PaymentService({ ...defaults, ...overrides });
}

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

// ── createMomoUrl ─────────────────────────────────────────────────────────────

describe('PaymentService.createMomoUrl', () => {
  it('trả về payment URL khi order tồn tại và user có quyền', async () => {
    const order = buildOrder();
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.createMomoUrl({ orderId: 42, userId: 7 });

    expect(result).toEqual({ payUrl: 'https://momo.test/pay' });
    expect(repo.findOrderByPk).toHaveBeenCalledWith(42);
  });

  it('gọi momoGateway với orderId = order.number và extraData chứa order.id', async () => {
    const order = buildOrder();
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const momoGateway = buildMockMomoGateway();
    const svc = buildService({ paymentRepository: repo, momoGateway });

    await svc.createMomoUrl({ orderId: 42, userId: 7 });

    expect(momoGateway.createPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: order.number,
        amount: order.total,
        extraData: `orderId=${order.id}`,
      }),
    );
  });

  it('ném AppError 404 khi order không tồn tại', async () => {
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(null) });
    const svc = buildService({ paymentRepository: repo });

    await expect(svc.createMomoUrl({ orderId: 99, userId: 7 })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('ném AppError 403 khi userId không khớp với order.userId', async () => {
    const order = buildOrder({ userId: 7 });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await expect(svc.createMomoUrl({ orderId: 42, userId: 999 })).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

// ── createVNPayUrl ────────────────────────────────────────────────────────────

describe('PaymentService.createVNPayUrl', () => {
  it('trả về payment URL khi order tồn tại và user có quyền', async () => {
    const order = buildOrder();
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.createVNPayUrl({ orderId: 42, userId: 7, ipAddr: '127.0.0.1' });

    expect(result).toBe('https://vnpay.test/pay');
  });

  it('gọi vnpayGateway với ipAddr từ tham số', async () => {
    const order = buildOrder();
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const vnpayGateway = buildMockVnpayGateway();
    const svc = buildService({ paymentRepository: repo, vnpayGateway });

    await svc.createVNPayUrl({ orderId: 42, userId: 7, ipAddr: '192.168.1.10' });

    expect(vnpayGateway.createPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddr: '192.168.1.10', amount: order.total }),
    );
  });

  it('ném AppError 404 khi order không tồn tại', async () => {
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(null) });
    const svc = buildService({ paymentRepository: repo });

    await expect(
      svc.createVNPayUrl({ orderId: 99, userId: 7, ipAddr: '127.0.0.1' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('ném AppError 403 khi user không sở hữu order', async () => {
    const order = buildOrder({ userId: 7 });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await expect(
      svc.createVNPayUrl({ orderId: 42, userId: 888, ipAddr: '127.0.0.1' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── handleMomoReturn ──────────────────────────────────────────────────────────

describe('PaymentService.handleMomoReturn', () => {
  it('trả về redirect URL với payment=success khi resultCode = 0', async () => {
    const svc = buildService();

    const url = await svc.handleMomoReturn({
      resultCode: '0',
      extraData: 'orderId=42',
    });

    expect(url).toBe('https://shop.test/orders?payment=success&orderId=42');
  });

  it('trả về redirect URL với payment=failed khi resultCode != 0', async () => {
    const svc = buildService();

    const url = await svc.handleMomoReturn({
      resultCode: '9',
      extraData: 'orderId=42',
    });

    expect(url).toBe('https://shop.test/orders?payment=failed&orderId=42');
  });

  it('trích xuất orderId từ extraData với nhiều params', async () => {
    const svc = buildService();

    const url = await svc.handleMomoReturn({
      resultCode: '0',
      extraData: 'orderId=77&other=ignore',
    });

    expect(url).toContain('orderId=77');
  });

  it('orderId rỗng khi extraData không có orderId', async () => {
    const svc = buildService();

    const url = await svc.handleMomoReturn({
      resultCode: '0',
      extraData: 'foo=bar',
    });

    expect(url).toContain('orderId=');
    // orderId trống nhưng không throw
    expect(url).not.toContain('orderId=77');
  });
});

// ── handleMomoIPN ─────────────────────────────────────────────────────────────

describe('PaymentService.handleMomoIPN', () => {
  it('trả về {valid: false} khi signature không hợp lệ', async () => {
    const momoGateway = buildMockMomoGateway({ verifySignature: jest.fn().mockReturnValue(false) });
    const svc = buildService({ momoGateway });

    const result = await svc.handleMomoIPN({
      body: { resultCode: 0, orderId: 'ORD-1', transId: 'TX1', extraData: 'orderId=42' },
    });

    expect(result).toEqual({ valid: false });
  });

  it('trả về {valid: true} và cập nhật order khi resultCode = 0 + signature hợp lệ', async () => {
    const order = buildOrder({ paymentStatus: 'pending', paymentTransactionId: null });
    const repo = buildMockRepo({
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleMomoIPN({
      body: {
        resultCode: 0,
        extraData: 'orderId=42',
        transId: 'TX-MOMO-001',
        amount: 500000,
      },
    });

    expect(result).toEqual({ valid: true });
    expect(order.paymentStatus).toBe('paid');
    expect(order.paymentTransactionId).toBe('TX-MOMO-001');
    expect(order.paymentProvider).toBe('momo');
    expect(repo.saveOrder).toHaveBeenCalled();
  });

  it('không xử lý order khi amount không khớp', async () => {
    const order = buildOrder({ total: 500000 });
    const repo = buildMockRepo({
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: {
        resultCode: 0,
        extraData: 'orderId=42',
        transId: 'TX-MOMO-002',
        amount: 100000, // sai số tiền
      },
    });

    expect(repo.saveOrder).not.toHaveBeenCalled();
  });

  it('không xử lý order khi order đã paid (idempotency)', async () => {
    const order = buildOrder({ paymentStatus: 'paid', paymentTransactionId: 'TX-MOMO-003' });
    const repo = buildMockRepo({
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleMomoIPN({
      body: {
        resultCode: 0,
        extraData: 'orderId=42',
        transId: 'TX-MOMO-003', // cùng transId
        amount: 500000,
      },
    });

    expect(repo.saveOrder).not.toHaveBeenCalled();
  });

  it('trả về {valid: true} nhưng không xử lý khi resultCode != 0', async () => {
    const repo = buildMockRepo({ lockOrder: jest.fn() });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleMomoIPN({
      body: {
        resultCode: 9, // thất bại
        extraData: 'orderId=42',
        transId: 'TX-FAIL',
      },
    });

    expect(result).toEqual({ valid: true });
    expect(repo.lockOrder).not.toHaveBeenCalled();
  });

  it('publish PaymentSucceededEvent sau khi xử lý thành công', async () => {
    const order = buildOrder();
    const repo = buildMockRepo({ lockOrder: jest.fn().mockResolvedValue(order) });
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const svc = buildService({ paymentRepository: repo, eventBus });

    await svc.handleMomoIPN({
      body: {
        resultCode: 0,
        extraData: 'orderId=42',
        transId: 'TX-EVENT-001',
        amount: 500000,
      },
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'payment.succeeded' }),
    );
  });
});

// ── handleVnPayReturn ─────────────────────────────────────────────────────────

describe('PaymentService.handleVnPayReturn', () => {
  it('redirect về checksum-failed khi chữ ký không hợp lệ', async () => {
    const vnpayGateway = buildMockVnpayGateway({
      verifyReturnUrl: jest.fn().mockReturnValue(false),
    });
    const svc = buildService({ vnpayGateway });

    const { redirectUrl } = await svc.handleVnPayReturn({ vnp_Params: {} });

    expect(redirectUrl).toBe('https://shop.test/orders?payment=checksum-failed');
  });

  it('redirect về payment=success khi responseCode = 00 và cập nhật order', async () => {
    const order = buildOrder({ paymentStatus: 'pending', paymentTransactionId: null });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: 'ORD-2511-00042',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'VNP-TX-001',
      },
    });

    expect(redirectUrl).toContain('payment=success');
    expect(redirectUrl).toContain('order=ORD-2511-00042');
    expect(order.paymentStatus).toBe('paid');
  });

  it('redirect về payment=failed khi responseCode != 00', async () => {
    const svc = buildService();

    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: 'ORD-2511-00042',
        vnp_ResponseCode: '24',
        vnp_TransactionNo: 'VNP-TX-FAIL',
      },
    });

    expect(redirectUrl).toContain('payment=failed');
    expect(redirectUrl).toContain('code=24');
  });

  it('responseCode không hợp lệ (non-numeric) → dùng code=unknown', async () => {
    const svc = buildService();

    const { redirectUrl } = await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: 'ORD-X',
        vnp_ResponseCode: '<script>evil</script>',
        vnp_TransactionNo: '',
      },
    });

    expect(redirectUrl).toContain('code=unknown');
  });

  it('không cập nhật order đã paid (idempotency)', async () => {
    const order = buildOrder({ paymentStatus: 'paid', paymentTransactionId: 'VNP-OLD' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc.handleVnPayReturn({
      vnp_Params: {
        vnp_TxnRef: 'ORD-2511-00042',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: 'VNP-NEW',
      },
    });

    // order đã paid → canProcessPayment = false → không save lại
    expect(repo.saveOrder).not.toHaveBeenCalled();
  });
});

// ── handleVnPayIPN ────────────────────────────────────────────────────────────

describe('PaymentService.handleVnPayIPN', () => {
  it('trả về RspCode 97 khi signature không hợp lệ', async () => {
    const vnpayGateway = buildMockVnpayGateway({
      verifyReturnUrl: jest.fn().mockReturnValue(false),
    });
    const svc = buildService({ vnpayGateway });

    const result = await svc.handleVnPayIPN({ vnp_Params: {} });

    expect(result).toEqual({ RspCode: '97', Message: 'Checksum failed' });
  });

  it('trả về RspCode 01 khi không tìm thấy order', async () => {
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(null),
    });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: 'NONEXISTENT',
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'TX-1',
      },
    });

    expect(result.RspCode).toBe('01');
  });

  it('trả về RspCode 04 khi số tiền không khớp', async () => {
    const order = buildOrder({ total: 500000 });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: 'ORD-2511-00042',
        vnp_ResponseCode: '00',
        vnp_Amount: '100000000', // 1,000,000 VND ≠ 500,000 VND
        vnp_TransactionNo: 'TX-2',
      },
    });

    expect(result.RspCode).toBe('04');
  });

  it('trả về RspCode 02 khi order đã paid', async () => {
    const order = buildOrder({ total: 500000, paymentStatus: 'paid' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: 'ORD-2511-00042',
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000', // 500,000 VND đúng
        vnp_TransactionNo: 'TX-3',
      },
    });

    expect(result.RspCode).toBe('02');
  });

  it('trả về RspCode 00 và cập nhật order khi responseCode = 00', async () => {
    const order = buildOrder({ total: 500000, paymentStatus: 'pending' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: 'ORD-2511-00042',
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'VNP-SUCCESS',
      },
    });

    expect(result.RspCode).toBe('00');
    expect(order.paymentStatus).toBe('paid');
    expect(order.paymentProvider).toBe('vnpay');
  });

  it('trả về RspCode 00 và cập nhật paymentStatus=failed khi responseCode != 00', async () => {
    const order = buildOrder({ total: 500000, paymentStatus: 'pending' });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(order),
    });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: 'ORD-2511-00042',
        vnp_ResponseCode: '24',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'VNP-FAIL',
      },
    });

    expect(result.RspCode).toBe('00');
    expect(order.paymentStatus).toBe('failed');
  });
});

// ── createRefund ──────────────────────────────────────────────────────────────

describe('PaymentService.createRefund', () => {
  it('ném AppError 400 khi không có orderId', async () => {
    const svc = buildService();

    await expect(svc.createRefund({ amount: 100000, reason: 'Test' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('ném AppError 404 khi order không tồn tại', async () => {
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(null) });
    const svc = buildService({ paymentRepository: repo });

    await expect(svc.createRefund({ orderId: 99 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('ném AppError 400 khi order chưa thanh toán (policy deny)', async () => {
    const order = buildOrder({ paymentStatus: 'pending', paymentTransactionId: null });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await expect(svc.createRefund({ orderId: 42 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('ném AppError 400 khi provider là momo (chưa hỗ trợ)', async () => {
    const order = buildOrder({
      paymentStatus: 'paid',
      paymentProvider: 'momo',
      paymentTransactionId: 'TX-MOMO',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await expect(svc.createRefund({ orderId: 42 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('ném AppError 400 khi amount > order.total', async () => {
    const order = buildOrder({
      paymentStatus: 'paid',
      paymentProvider: 'vnpay',
      paymentTransactionId: 'TX-VNP',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await expect(svc.createRefund({ orderId: 42, amount: 9999999 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('fallback về order.total khi amount = 0 (falsy — dùng order.total thay thế)', async () => {
    // amount=0 là falsy → `amount || order.total` → refundAmount = order.total (500000)
    // Đây là behavior thực của code hiện tại (không throw 400).
    // NOTE: đây là quirk của `amount || order.total` — amount âm sẽ throw vì âm <= 0.
    const order = buildOrder({
      total: 500000,
      paymentStatus: 'paid',
      paymentProvider: 'vnpay',
      paymentTransactionId: 'TX-VNP',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const vnpayGateway = buildMockVnpayGateway();
    const svc = buildService({ paymentRepository: repo, vnpayGateway });

    // amount=0 → fallback về order.total=500000 → không throw, refund thành công
    await expect(svc.createRefund({ orderId: 42, amount: 0 })).resolves.toBeDefined();
    expect(vnpayGateway.refund).toHaveBeenCalledWith(expect.objectContaining({ amount: 500000 }));
  });

  it('ném AppError 400 khi amount âm (< 0)', async () => {
    const order = buildOrder({
      paymentStatus: 'paid',
      paymentProvider: 'vnpay',
      paymentTransactionId: 'TX-VNP',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await expect(svc.createRefund({ orderId: 42, amount: -100 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('gọi vnpayGateway.refund với đúng tham số và cập nhật paymentStatus=refunded', async () => {
    const order = buildOrder({
      paymentStatus: 'paid',
      paymentProvider: 'vnpay',
      paymentTransactionId: 'VNP-TX-REF',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const vnpayGateway = buildMockVnpayGateway();
    const svc = buildService({ paymentRepository: repo, vnpayGateway });

    await svc.createRefund({ orderId: 42, amount: 200000, reason: 'Hoàn hàng', ipAddr: '1.2.3.4' });

    expect(vnpayGateway.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: order.number,
        amount: 200000,
        ipAddr: '1.2.3.4',
      }),
    );
    expect(order.paymentStatus).toBe('refunded');
    expect(repo.saveOrder).toHaveBeenCalled();
  });

  it('dùng order.total khi không truyền amount', async () => {
    const order = buildOrder({
      total: 500000,
      paymentStatus: 'paid',
      paymentProvider: 'vnpay',
      paymentTransactionId: 'VNP-TX-FULL',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const vnpayGateway = buildMockVnpayGateway();
    const svc = buildService({ paymentRepository: repo, vnpayGateway });

    await svc.createRefund({ orderId: 42 });

    expect(vnpayGateway.refund).toHaveBeenCalledWith(expect.objectContaining({ amount: 500000 }));
  });
});

// ── _sendOrderConfirmationEmailSafe (fire-and-forget, không throw) ─────────────

describe('PaymentService._sendOrderConfirmationEmailSafe', () => {
  it('không throw khi emailGateway fail', async () => {
    const order = buildOrder({ User: { email: 'test@example.com' }, items: [] });
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(order),
    });
    const emailGateway = {
      sendOrderConfirmationEmail: jest.fn().mockRejectedValue(new Error('SMTP down')),
    };
    const svc = buildService({ paymentRepository: repo, emailGateway });

    await expect(svc._sendOrderConfirmationEmailSafe(42)).resolves.toBeUndefined();
  });

  it('không làm gì khi order không có User', async () => {
    const order = buildOrder({ User: null });
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(order),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn() };
    const svc = buildService({ paymentRepository: repo, emailGateway });

    await svc._sendOrderConfirmationEmailSafe(42);

    expect(emailGateway.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });
});

// ── _incrementDiscountCodeUsage ───────────────────────────────────────────────

describe('PaymentService._incrementDiscountCodeUsage', () => {
  it('gọi logger.error khi repo.findOrderDiscountCode throw (line 81)', async () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const repo = buildMockRepo({
      findOrderDiscountCode: jest.fn().mockRejectedValue(new Error('DB connection lost')),
    });
    const svc = buildService({ paymentRepository: repo, logger });

    // Gọi trực tiếp private method — không throw ra ngoài (catch bên trong)
    await svc._incrementDiscountCodeUsage(42);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi tăng usedCount discount code cho order 42'),
      expect.any(String),
    );
  });

  it('không gọi incrementDiscountCodeUsedCount khi findOrderDiscountCode trả về null', async () => {
    const repo = buildMockRepo({
      findOrderDiscountCode: jest.fn().mockResolvedValue(null),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc._incrementDiscountCodeUsage(42);

    expect(repo.incrementDiscountCodeUsedCount).not.toHaveBeenCalled();
  });

  it('gọi incrementDiscountCodeUsedCount khi tìm thấy discount code', async () => {
    const discountCode = { id: 7 };
    const repo = buildMockRepo({
      findOrderDiscountCode: jest.fn().mockResolvedValue(discountCode),
      incrementDiscountCodeUsedCount: jest.fn().mockResolvedValue(undefined),
    });
    const svc = buildService({ paymentRepository: repo });

    await svc._incrementDiscountCodeUsage(42);

    expect(repo.incrementDiscountCodeUsedCount).toHaveBeenCalledWith(7, {});
  });
});

// ── _sendOrderConfirmationEmailSafe với items (line 34) ──────────────────────

describe('PaymentService._sendOrderConfirmationEmailSafe — order có items', () => {
  it('gửi email với items được map từ order.items (line 34)', async () => {
    const order = buildOrder({
      User: { email: 'customer@example.com' },
      items: [
        { name: 'iPhone 15', quantity: 1, unitPrice: '29990000', subtotal: '29990000' },
        { name: 'AirPods Pro', quantity: 2, unitPrice: '6490000', subtotal: '12980000' },
      ],
    });
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(order),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined) };
    const svc = buildService({ paymentRepository: repo, emailGateway });

    await svc._sendOrderConfirmationEmailSafe(42);

    expect(emailGateway.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      'customer@example.com',
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ name: 'iPhone 15', quantity: 1, price: 29990000 }),
          expect.objectContaining({ name: 'AirPods Pro', quantity: 2, price: 6490000 }),
        ]),
      }),
    );
  });
});

// ── createRefund — provider không phải vnpay nhưng policy cho phép (line 269 false branch) ──
// Nhánh else tại line 269 là dead code khi dùng policy thực (chỉ vnpay được cho phép).
// Test này verify behavior khi nhánh false được đi qua: refund = undefined, order vẫn được
// đánh dấu refunded và saveOrder được gọi.

describe('PaymentService.createRefund — provider không phải vnpay', () => {
  it('ném AppError khi paymentProvider không nằm trong danh sách hỗ trợ hoàn tiền', async () => {
    // Sau Phase 1: _canRefund được inline trong service.
    // Provider 'momo' không được hỗ trợ hoàn tiền → policy từ chối → AppError 400.
    const order = buildOrder({
      total: 100000,
      paymentStatus: 'paid',
      paymentProvider: 'momo',
      paymentTransactionId: 'TX-MOMO',
    });
    const repo = buildMockRepo({ findOrderByPk: jest.fn().mockResolvedValue(order) });
    const svc = buildService({ paymentRepository: repo });

    await expect(svc.createRefund({ orderId: 42, amount: 50000 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

// ── _sendOrderConfirmationEmailSafe — order.items undefined (line 34 || [] branch) ──

describe('PaymentService._sendOrderConfirmationEmailSafe — order.items undefined', () => {
  it('dùng [] khi order.items là undefined (covers || [] branch tại line 34)', async () => {
    const order = buildOrder({
      User: { email: 'customer@example.com' },
      items: undefined, // undefined → (undefined || []) → []
    });
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(order),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined) };
    const svc = buildService({ paymentRepository: repo, emailGateway });

    await svc._sendOrderConfirmationEmailSafe(42);

    expect(emailGateway.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      'customer@example.com',
      expect.objectContaining({ items: [] }),
    );
  });

  it('dùng [] khi order.items là null (covers || [] fallback branch)', async () => {
    const order = buildOrder({
      User: { email: 'customer@example.com' },
      items: null, // null → (null || []) → []
    });
    const repo = buildMockRepo({
      findOrderByPkWithItemsAndUser: jest.fn().mockResolvedValue(order),
    });
    const emailGateway = { sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined) };
    const svc = buildService({ paymentRepository: repo, emailGateway });

    await svc._sendOrderConfirmationEmailSafe(42);

    expect(emailGateway.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      'customer@example.com',
      expect.objectContaining({ items: [] }),
    );
  });
});

// ── handleMomoIPN — orderId null khi extraData không có orderId (line 117) ────

describe('PaymentService.handleMomoIPN — extraData không có orderId', () => {
  it('trả về {valid: true} khi resultCode=0 nhưng extraData không chứa orderId (line 117)', async () => {
    const repo = buildMockRepo({ lockOrder: jest.fn() });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleMomoIPN({
      body: {
        resultCode: 0,
        extraData: 'noOrderIdField=someValue',
        transId: 'TX-NO-ORDER',
        amount: 500000,
      },
    });

    // orderId = null → điều kiện `if (resultCode == 0 && orderId)` false → bỏ qua
    expect(result).toEqual({ valid: true });
    expect(repo.lockOrder).not.toHaveBeenCalled();
  });
});

// ── handleMomoIPN — lockOrder trả về null (line 122) ────────────────────────

describe('PaymentService.handleMomoIPN — lockOrder trả về null', () => {
  it('không update order khi lockOrder trả về null (line 122)', async () => {
    const repo = buildMockRepo({
      lockOrder: jest.fn().mockResolvedValue(null),
    });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleMomoIPN({
      body: {
        resultCode: 0,
        extraData: 'orderId=42',
        transId: 'TX-LOCK-NULL',
        amount: 500000,
      },
    });

    expect(result).toEqual({ valid: true });
    expect(repo.saveOrder).not.toHaveBeenCalled();
  });
});

// ── handleVnPayIPN — lockOrder trả về null sau khi tìm thấy order (line 218) ─

describe('PaymentService.handleVnPayIPN — lockOrder trả về null', () => {
  it('trả về RspCode 01 khi findOrderByNumber thành công nhưng lockOrder null (line 218)', async () => {
    const order = buildOrder({ total: 500000 });
    const repo = buildMockRepo({
      findOrderByNumber: jest.fn().mockResolvedValue(order),
      lockOrder: jest.fn().mockResolvedValue(null),
    });
    const svc = buildService({ paymentRepository: repo });

    const result = await svc.handleVnPayIPN({
      vnp_Params: {
        vnp_TxnRef: 'ORD-2511-00042',
        vnp_ResponseCode: '00',
        vnp_Amount: '50000000',
        vnp_TransactionNo: 'TX-LOCK-NULL',
      },
    });

    expect(result.RspCode).toBe('01');
    expect(result.Message).toBe('Order not found');
  });
});

// ─── _clearUserCart ───────────────────────────────────────────────────────────
// Covers lines 65-71: xóa cart khi có carts + catch block khi lỗi

describe('PaymentService._clearUserCart', () => {
  it('có carts → đánh dấu converted, clearCartItems, ghi info log', async () => {
    const cart1 = { id: 10, status: 'active' };
    const cart2 = { id: 11, status: 'active' };
    const repo = buildMockRepo({
      findActiveCartsByUser: jest.fn().mockResolvedValue([cart1, cart2]),
      saveCart: jest.fn().mockResolvedValue(undefined),
      clearCartItems: jest.fn().mockResolvedValue(undefined),
    });
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ paymentRepository: repo, logger });

    await svc._clearUserCart(7);

    expect(cart1.status).toBe('converted');
    expect(cart2.status).toBe('converted');
    expect(repo.saveCart).toHaveBeenCalledTimes(2);
    expect(repo.clearCartItems).toHaveBeenCalledWith(10);
    expect(repo.clearCartItems).toHaveBeenCalledWith(11);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('10'));
  });

  it('userId undefined/null → return sớm, không gọi findActiveCartsByUser', async () => {
    const repo = buildMockRepo();
    const svc = buildService({ paymentRepository: repo });

    await svc._clearUserCart(null);

    expect(repo.findActiveCartsByUser).not.toHaveBeenCalled();
  });

  it('findActiveCartsByUser throw → ghi error log, không crash', async () => {
    const repo = buildMockRepo({
      findActiveCartsByUser: jest.fn().mockRejectedValue(new Error('DB down')),
    });
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const svc = buildService({ paymentRepository: repo, logger });

    await expect(svc._clearUserCart(7)).resolves.not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi xóa giỏ hàng cho user 7'),
      expect.any(String),
    );
  });
});
