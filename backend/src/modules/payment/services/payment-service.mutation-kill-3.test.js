/**
 * Mutation-kill tests Round 3 cho PaymentService
 * Nhắm vào các survivors money/logic còn sót:
 * - L169 (BooleanLiteral→true): return false khi order.status === 'cancelled' trong MoMo IPN
 * - L179 (BooleanLiteral→true): return false khi amount mismatch trong MoMo IPN
 * - L182 (BooleanLiteral→true): return false khi _canProcessPayment trả false trong MoMo IPN
 * - L193 (ConditionalExpression→true): if(processed) guard — post-processing chỉ chạy khi success
 * - L15 (ConditionalExpression→false): _canProcessPayment — duplicate transId → return false
 * - L61 (ConditionalExpression→false + LogicalOperator): _sendOrderConfirmationEmailSafe guard
 * - L112 (ConditionalExpression→true): _incrementDiscountCodeUsage — có code mới gọi increment
 * - L159 (BooleanLiteral→true): handleMomoIPN return { valid: false } khi sig invalid
 *
 * Mỗi test dùng jest.spyOn để assert OUTCOME: các hàm post-processing
 * (_incrementDiscountCodeUsage, _clearUserCart, _sendOrderConfirmationEmailSafe)
 * KHÔNG được gọi khi payment bị từ chối, PHẢI được gọi khi payment thành công.
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
