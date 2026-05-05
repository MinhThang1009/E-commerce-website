// Phase 42.12 — Unit tests cho PaymentService (DDD-lite).
const PaymentService = require('../modules/payment/services/paymentService');

describe('PaymentService', () => {
  let repo;
  let stripeGateway;
  let momoGateway;
  let vnpayGateway;
  let emailGateway;
  let eventBus;
  let service;

  beforeEach(() => {
    repo = {
      findOrderByPk: jest.fn(),
      findOrderByNumber: jest.fn(),
      findOrderByPkWithItemsAndUser: jest.fn(),
      lockOrder: jest.fn(),
      updateOrderPayment: jest.fn().mockResolvedValue(),
      saveOrder: jest.fn(async (o) => o),
      findUserById: jest.fn(),
      saveUser: jest.fn(async (u) => u),
      findOrderDiscountCode: jest.fn(),
      incrementDiscountCodeUsedCount: jest.fn(),
      findActiveCartsByUser: jest.fn().mockResolvedValue([]),
      saveCart: jest.fn(),
      clearCartItems: jest.fn(),
      runInTransaction: jest.fn(async (work) => work({ LOCK: { UPDATE: 'X' } })),
    };
    stripeGateway = {
      createPaymentIntent: jest.fn(),
      confirmPaymentIntent: jest.fn(),
      createCustomer: jest.fn(),
      getCustomer: jest.fn(),
      getPaymentMethods: jest.fn(),
      createSetupIntent: jest.fn(),
      handleWebhook: jest.fn(),
      createRefund: jest.fn(),
    };
    momoGateway = {
      createPaymentUrl: jest.fn(),
      verifySignature: jest.fn(),
    };
    vnpayGateway = {
      createPaymentUrl: jest.fn(),
      verifyReturnUrl: jest.fn(),
      refund: jest.fn(),
    };
    emailGateway = { sendOrderConfirmationEmail: jest.fn().mockResolvedValue() };
    eventBus = { publish: jest.fn().mockResolvedValue() };

    service = new PaymentService({
      paymentRepository: repo,
      stripeGateway, momoGateway, vnpayGateway,
      emailGateway, eventBus,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
      frontendUrl: 'http://shop',
    });
  });

  describe('createPaymentIntent', () => {
    test('amount <= 0 → 400', async () => {
      await expect(
        service.createPaymentIntent({ amount: 0, userId: 1 })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('amount valid → call stripeGateway', async () => {
      stripeGateway.createPaymentIntent.mockResolvedValue({ paymentIntentId: 'pi-1', metadata: {} });
      await service.createPaymentIntent({ amount: 1000, userId: 5, orderId: 10 });
      expect(stripeGateway.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1000, metadata: { userId: 5, orderId: 10 } })
      );
    });
  });

  describe('confirmPayment', () => {
    test('thiếu paymentIntentId → 400', async () => {
      await expect(service.confirmPayment({})).rejects.toMatchObject({ statusCode: 400 });
    });

    test('succeeded + order chưa paid → updateOrderPayment + publish event', async () => {
      stripeGateway.confirmPaymentIntent.mockResolvedValue({
        id: 'pi-1', status: 'succeeded', amount: 5000,
        currency: 'usd', metadata: { orderId: 10 },
      });
      const order = { id: 10, number: 'ORD-X', userId: 1, paymentStatus: 'pending', paymentTransactionId: null };
      repo.findOrderByPk.mockResolvedValue(order);

      await service.confirmPayment({ paymentIntentId: 'pi-1' });

      expect(repo.updateOrderPayment).toHaveBeenCalledWith(10, expect.objectContaining({
        paymentStatus: 'paid', paymentProvider: 'stripe',
      }));
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'payment.succeeded' })
      );
    });

    test('order đã paid → idempotent skip', async () => {
      stripeGateway.confirmPaymentIntent.mockResolvedValue({
        id: 'pi-1', status: 'succeeded', metadata: { orderId: 10 }, currency: 'usd', amount: 1000,
      });
      repo.findOrderByPk.mockResolvedValue({ paymentStatus: 'paid' });

      await service.confirmPayment({ paymentIntentId: 'pi-1' });

      expect(repo.updateOrderPayment).not.toHaveBeenCalled();
    });
  });

  describe('createCustomer', () => {
    test('user không tồn tại → 404', async () => {
      repo.findUserById.mockResolvedValue(null);
      await expect(
        service.createCustomer({ userId: 99 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('đã có stripeCustomerId → reuse, isNew=false', async () => {
      repo.findUserById.mockResolvedValue({ stripeCustomerId: 'cus-1' });
      stripeGateway.getCustomer.mockResolvedValue({ id: 'cus-1' });

      const result = await service.createCustomer({ userId: 1 });

      expect(result.isNew).toBe(false);
      expect(stripeGateway.createCustomer).not.toHaveBeenCalled();
    });

    test('chưa có → tạo + save user, isNew=true', async () => {
      const user = { stripeCustomerId: null, email: 'a@b', firstName: 'A', lastName: 'B', id: 1 };
      repo.findUserById.mockResolvedValue(user);
      stripeGateway.createCustomer.mockResolvedValue({ id: 'cus-new' });

      const result = await service.createCustomer({ userId: 1 });

      expect(result.isNew).toBe(true);
      expect(user.stripeCustomerId).toBe('cus-new');
      expect(repo.saveUser).toHaveBeenCalledWith(user);
    });
  });

  describe('getPaymentMethods', () => {
    test('không có stripeCustomerId → []', async () => {
      repo.findUserById.mockResolvedValue({ stripeCustomerId: null });
      const result = await service.getPaymentMethods({ userId: 1 });
      expect(result.paymentMethods).toEqual([]);
    });

    test('có customerId → query gateway', async () => {
      repo.findUserById.mockResolvedValue({ stripeCustomerId: 'cus-1' });
      stripeGateway.getPaymentMethods.mockResolvedValue([{ id: 'pm-1' }]);
      const result = await service.getPaymentMethods({ userId: 1 });
      expect(result.paymentMethods).toHaveLength(1);
    });
  });

  describe('handleStripeWebhook sandbox', () => {
    test('hasSecret=false → received:true sandbox mode', async () => {
      const result = await service.handleStripeWebhook({ payload: {}, signature: 'x', hasSecret: false });
      expect(result).toEqual({ received: true });
      expect(stripeGateway.handleWebhook).not.toHaveBeenCalled();
    });
  });

  describe('createMomoUrl', () => {
    test('order không tồn tại → 404', async () => {
      repo.findOrderByPk.mockResolvedValue(null);
      await expect(
        service.createMomoUrl({ orderId: 99 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('order tồn tại → call momoGateway với extraData', async () => {
      repo.findOrderByPk.mockResolvedValue({ id: 10, number: 'ORD-X', total: 1000 });
      momoGateway.createPaymentUrl.mockResolvedValue({ payUrl: 'http://momo' });

      await service.createMomoUrl({ orderId: 10 });

      expect(momoGateway.createPaymentUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ORD-X', amount: 1000, extraData: 'orderId=10',
        })
      );
    });
  });

  describe('handleMomoReturn', () => {
    test('resultCode=0 + order chưa paid → mark paid + redirect success', async () => {
      const order = {
        id: 10, userId: 1, paymentStatus: 'pending', paymentTransactionId: null,
      };
      repo.findOrderByPk.mockResolvedValue(order);

      const url = await service.handleMomoReturn({ resultCode: '0', extraData: 'orderId=10' });

      expect(url).toBe('http://shop/orders?payment=success');
      expect(order.paymentStatus).toBe('paid');
    });

    test('resultCode != 0 → redirect failed, không touch order', async () => {
      const url = await service.handleMomoReturn({ resultCode: '1', extraData: 'orderId=10' });
      expect(url).toBe('http://shop/orders?payment=failed');
      expect(repo.findOrderByPk).not.toHaveBeenCalled();
    });
  });

  describe('handleMomoIPN', () => {
    test('signature invalid → valid:false', async () => {
      momoGateway.verifySignature.mockReturnValue(false);
      const result = await service.handleMomoIPN({ body: {} });
      expect(result.valid).toBe(false);
    });

    test('signature valid + resultCode=0 + new tx → process + publish event', async () => {
      momoGateway.verifySignature.mockReturnValue(true);
      const order = {
        id: 10, number: 'ORD-X', userId: 1, total: 1000,
        paymentStatus: 'pending', paymentTransactionId: null,
      };
      repo.findOrderByPk.mockResolvedValue(order);

      await service.handleMomoIPN({
        body: { resultCode: '0', extraData: 'orderId=10', transId: 'tx-mm' },
      });

      expect(order.paymentStatus).toBe('paid');
      expect(order.paymentProvider).toBe('momo');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'payment.succeeded' })
      );
    });
  });

  describe('handleVnPayReturn', () => {
    test('checksum failed → redirect checksum-failed', async () => {
      vnpayGateway.verifyReturnUrl.mockReturnValue(false);
      const result = await service.handleVnPayReturn({ vnp_Params: {} });
      expect(result.redirectUrl).toBe('http://shop/orders?payment=checksum-failed');
    });

    test('responseCode=00 + order chưa paid → mark paid', async () => {
      vnpayGateway.verifyReturnUrl.mockReturnValue(true);
      const order = { paymentStatus: 'pending', paymentTransactionId: null };
      repo.findOrderByNumber.mockResolvedValue(order);

      await service.handleVnPayReturn({
        vnp_Params: { vnp_TxnRef: 'ORD-1', vnp_ResponseCode: '00', vnp_TransactionNo: 'tx-vn' },
      });

      expect(order.paymentStatus).toBe('paid');
      expect(order.paymentProvider).toBe('vnpay');
    });

    test('responseCode != 00 → redirect failed', async () => {
      vnpayGateway.verifyReturnUrl.mockReturnValue(true);
      const result = await service.handleVnPayReturn({
        vnp_Params: { vnp_TxnRef: 'X', vnp_ResponseCode: '24' },
      });
      expect(result.redirectUrl).toBe('http://shop/orders?payment=failed&code=24');
    });
  });

  describe('handleVnPayIPN', () => {
    test('checksum failed → RspCode 97', async () => {
      vnpayGateway.verifyReturnUrl.mockReturnValue(false);
      const result = await service.handleVnPayIPN({ vnp_Params: {} });
      expect(result.RspCode).toBe('97');
    });

    test('order not found → 01', async () => {
      vnpayGateway.verifyReturnUrl.mockReturnValue(true);
      repo.findOrderByNumber.mockResolvedValue(null);
      const result = await service.handleVnPayIPN({
        vnp_Params: { vnp_TxnRef: 'X', vnp_Amount: '100000' },
      });
      expect(result.RspCode).toBe('01');
    });

    test('amount mismatch → 04', async () => {
      vnpayGateway.verifyReturnUrl.mockReturnValue(true);
      repo.findOrderByNumber.mockResolvedValue({ total: 5000 });
      const result = await service.handleVnPayIPN({
        vnp_Params: { vnp_TxnRef: 'X', vnp_Amount: '999999900' },
      });
      expect(result.RspCode).toBe('04');
    });

    test('order already paid → 02', async () => {
      vnpayGateway.verifyReturnUrl.mockReturnValue(true);
      repo.findOrderByNumber.mockResolvedValue({ total: 1000, paymentStatus: 'paid' });
      const result = await service.handleVnPayIPN({
        vnp_Params: { vnp_TxnRef: 'X', vnp_Amount: '100000' },
      });
      expect(result.RspCode).toBe('02');
    });

    test('responseCode 00 → RspCode 00 success', async () => {
      vnpayGateway.verifyReturnUrl.mockReturnValue(true);
      const order = { total: 1000, paymentStatus: 'pending' };
      repo.findOrderByNumber.mockResolvedValue(order);
      const result = await service.handleVnPayIPN({
        vnp_Params: { vnp_TxnRef: 'X', vnp_Amount: '100000', vnp_ResponseCode: '00' },
      });
      expect(result.RspCode).toBe('00');
      expect(order.paymentStatus).toBe('paid');
    });
  });

  describe('createRefund', () => {
    test('thiếu orderId → 400', async () => {
      await expect(service.createRefund({})).rejects.toMatchObject({ statusCode: 400 });
    });

    test('order null → 404', async () => {
      repo.findOrderByPk.mockResolvedValue(null);
      await expect(
        service.createRefund({ orderId: 99 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('provider=momo → 400 (không support)', async () => {
      repo.findOrderByPk.mockResolvedValue({
        paymentTransactionId: 'tx', paymentProvider: 'momo',
      });
      await expect(
        service.createRefund({ orderId: 1 })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('momo') });
    });

    test('provider=stripe → call stripeGateway.createRefund', async () => {
      const order = {
        paymentTransactionId: 'pi-1', paymentProvider: 'stripe',
        paymentStatus: 'paid',
      };
      repo.findOrderByPk.mockResolvedValue(order);
      stripeGateway.createRefund.mockResolvedValue({ id: 're-1' });

      const refund = await service.createRefund({ orderId: 1, amount: 500 });

      expect(stripeGateway.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({ paymentIntentId: 'pi-1', amount: 500 })
      );
      expect(order.paymentStatus).toBe('refunded');
      expect(refund.id).toBe('re-1');
    });

    test('provider=vnpay → call vnpayGateway.refund', async () => {
      const order = {
        paymentTransactionId: 'tx-vn', paymentProvider: 'vnpay',
        paymentStatus: 'paid', total: 1000, number: 'X', updatedAt: new Date(),
      };
      repo.findOrderByPk.mockResolvedValue(order);
      vnpayGateway.refund.mockResolvedValue({ id: 're-vn' });

      await service.createRefund({ orderId: 1, ipAddr: '127.0.0.1' });

      expect(vnpayGateway.refund).toHaveBeenCalled();
    });
  });
});
