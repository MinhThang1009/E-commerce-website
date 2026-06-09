/**
 * Integration tests — Payment module với DB thật.
 * Test: IPN webhook DB operations, idempotency, order status transition.
 * KHÔNG test gateway thật (VNPay/MoMo cần signature + sandbox).
 */
require('module-alias/register');
const sequelize = require('@config/sequelize');
const {
  User,
  Product,
  ProductVariant,
  Category,
  Brand,
  Order,
  OrderItem,
  Cart,
  CartItem,
  DiscountCode,
  InventoryLog,
} = require('@models');
const { Op } = require('sequelize');
const PaymentService = require('@modules/payment/services/payment-service');
const SequelizePaymentRepository = require('@modules/payment/repositories/sequelize-payment-repository');
const OrdersService = require('@modules/orders/services/orders-service');
const SequelizeOrdersRepository = require('@modules/orders/repositories/sequelize-orders-repository');

const TS = Date.now();
let user, product, variant;

const makeOrder = async (num, extra = {}) =>
  Order.create({
    number: `INT-PAY-${TS}-${num}`,
    userId: user.id,
    status: 'pending',
    paymentMethod: 'vnpay',
    paymentStatus: 'pending',
    shippingFirstName: '__INT',
    shippingLastName: 'Pay',
    shippingAddress1: '1 Pay St',
    shippingCity: 'HCM',
    billingFirstName: '__INT',
    billingLastName: 'Pay',
    billingAddress1: '1 Pay St',
    billingCity: 'HCM',
    subtotal: 5_000_000,
    tax: 0,
    shippingCost: 0,
    total: 5_000_000,
    ...extra,
  });

beforeAll(async () => {
  await sequelize.authenticate();
  const cat = await Category.create({
    nameVi: `__INT_Pay_Cat_${TS}`,
    nameEn: `__INT_Pay_Cat_${TS}`,
    slug: `int-pay-cat-${TS}`,
    isActive: true,
  });
  const brand = await Brand.create({
    nameVi: `__INT_Pay_Brand_${TS}`,
    nameEn: `__INT_Pay_Brand_${TS}`,
    slug: `int-pay-brand-${TS}`,
  });
  product = await Product.create({
    nameVi: `__INT_Pay_Product_${TS}`,
    nameEn: `__INT_Pay_Product_${TS}`,
    baseName: `__INT_Pay_Product_${TS}`,
    slug: `int-pay-product-${TS}`,
    basePrice: 5_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 20,
  });
  variant = await ProductVariant.create({
    productId: product.id,
    sku: `INT-PAY-${TS}`,
    variantName: 'Base',
    price: 5_000_000,
    stockQuantity: 20,
    isDefault: true,
  });
  user = await User.create({
    firstName: '__INT_Pay',
    lastName: 'User',
    email: `__int_pay_${TS}@t.com`,
    password: 'Pay123!',
    role: 'customer',
  });
});

afterAll(async () => {
  await CartItem.destroy({ where: {}, force: true });
  await Cart.destroy({ where: { userId: user?.id }, force: true });
  await OrderItem.destroy({ where: {}, force: true });
  await Order.destroy({ where: { number: { [Op.like]: `INT-PAY-${TS}%` } }, force: true });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (user) await user.destroy({ force: true });
});

describe('Payment Integration — IPN webhook DB operations', () => {
  let order;

  beforeEach(async () => {
    order = await makeOrder(Date.now());
    await OrderItem.create({
      orderId: order.id,
      productId: product.id,
      variantId: variant.id,
      name: product.nameVi,
      unitPrice: 5_000_000,
      quantity: 1,
      subtotal: 5_000_000,
    });
  });

  afterEach(async () => {
    await OrderItem.destroy({ where: { orderId: order.id }, force: true });
    await order.destroy({ force: true });
  });

  test('IPN thành công: update paymentStatus=paid, status=processing', async () => {
    const txId = `VNP-${TS}-001`;
    await order.update({ paymentStatus: 'paid', status: 'processing', paymentTransactionId: txId });
    await order.reload();
    expect(order.paymentStatus).toBe('paid');
    expect(order.status).toBe('processing');
    expect(order.paymentTransactionId).toBe(txId);
  });

  test('Idempotency: IPN cùng transactionId không process lại', async () => {
    const txId = `VNP-${TS}-002`;
    await order.update({ paymentStatus: 'paid', paymentTransactionId: txId });

    // Simulate: kiểm tra trước khi process
    const existing = await Order.findOne({ where: { paymentTransactionId: txId } });
    expect(existing).not.toBeNull();
    // Nếu đã có txId → skip (idempotency check)
    expect(existing.paymentTransactionId).toBe(txId);
  });

  test('IPN thất bại: update paymentStatus=failed', async () => {
    await order.update({ paymentStatus: 'failed' });
    await order.reload();
    expect(order.paymentStatus).toBe('failed');
    expect(order.status).toBe('pending'); // status không đổi khi failed
  });

  test('Order amount khớp với IPN amount', async () => {
    await order.reload();
    const items = await OrderItem.findAll({ where: { orderId: order.id } });
    const calculatedTotal = items.reduce((s, i) => s + Number(i.subtotal), 0);
    expect(calculatedTotal).toBe(Number(order.subtotal));
  });
});

describe('Payment Integration — Order status transitions', () => {
  test('pending → processing → shipped → delivered', async () => {
    const order = await makeOrder('flow');
    const transitions = ['processing', 'shipped', 'delivered'];
    for (const status of transitions) {
      await order.update({ status });
      await order.reload();
      expect(order.status).toBe(status);
    }
    await order.destroy({ force: true });
  });

  test('pending → cancelled', async () => {
    const order = await makeOrder('cancel');
    await order.update({ status: 'cancelled' });
    await order.reload();
    expect(order.status).toBe('cancelled');
    await order.destroy({ force: true });
  });

  test('Repay: failed order có thể tạo transaction mới', async () => {
    const order = await makeOrder('repay');
    await order.update({ paymentStatus: 'failed' });

    // Repay: reset payment info để thử lại
    await order.update({ paymentStatus: 'pending', paymentTransactionId: null });
    await order.reload();
    expect(order.paymentStatus).toBe('pending');
    expect(order.paymentTransactionId).toBeNull();
    await order.destroy({ force: true });
  });
});

describe('Payment Integration — Cart clear sau thanh toán', () => {
  test('Clear cart khi IPN thành công', async () => {
    // Tạo cart + items
    const cart = await Cart.create({ userId: user.id, status: 'active' });
    await CartItem.create({
      cartId: cart.id,
      productId: product.id,
      variantId: variant.id,
      quantity: 2,
      unitPrice: 5_000_000,
    });

    const order = await makeOrder('cart-clear');

    // Simulate IPN success: mark cart as converted
    await Cart.update({ status: 'converted' }, { where: { userId: user.id, status: 'active' } });
    await order.update({ paymentStatus: 'paid', status: 'processing' });

    const updatedCart = await Cart.findByPk(cart.id);
    expect(updatedCart.status).toBe('converted');

    await CartItem.destroy({ where: { cartId: cart.id }, force: true });
    await cart.destroy({ force: true });
    await order.destroy({ force: true });
  });
});

describe('PaymentService.handleVnPayIPN — service thật + DB', () => {
  /**
   * Integration tests — PaymentService gọi SERVICE THẬT + MySQL thật (assert OUTCOME).
   *
   * Khác `payment.integration.test.js` (thao tác Model trực tiếp — tautological): file này
   * dựng PaymentService với SequelizePaymentRepository thật + gateway stub (bỏ qua chữ ký HMAC,
   * vì crypto đã có unit test riêng), rồi gọi handleVnPayIPN/handleVnPayReturn/handleMomoIPN/
   * createRefund và kiểm tra trạng thái DB. Bắt được bug logic mà unit mock bỏ lọt (bài học F1/F2).
   */
  const TOTAL = 5_000_000;
  let user2, product2, variant2, svc, repo;
  const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };

  const makeOrder2 = async (num, extra = {}) =>
    Order.create({
      number: `INT-PAYE-${TS}-${num}`,
      userId: user2.id,
      status: 'pending',
      paymentMethod: 'vnpay',
      paymentStatus: 'pending',
      shippingFirstName: '__INT',
      shippingLastName: 'Pay',
      shippingAddress1: '1 Pay St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'Pay',
      billingAddress1: '1 Pay St',
      billingCity: 'HCM',
      subtotal: TOTAL,
      tax: 0,
      shippingCost: 0,
      total: TOTAL,
      ...extra,
    });

  const vnpParams = (order, overrides = {}) => ({
    vnp_TxnRef: order.number,
    vnp_ResponseCode: '00',
    vnp_TransactionNo: `VNP-${order.number}`,
    vnp_Amount: String(TOTAL * 100),
    ...overrides,
  });

  beforeAll(async () => {
    await sequelize.authenticate();
    const cat = await Category.create({
      nameVi: `__INT_PayE_Cat_${TS}`,
      nameEn: `__INT_PayE_Cat_${TS}`,
      slug: `int-paye-cat-${TS}`,
      isActive: true,
    });
    const brand = await Brand.create({
      nameVi: `__INT_PayE_Brand_${TS}`,
      nameEn: `__INT_PayE_Brand_${TS}`,
      slug: `int-paye-brand-${TS}`,
    });
    product2 = await Product.create({
      nameVi: `__INT_PayE_Product_${TS}`,
      nameEn: `__INT_PayE_Product_${TS}`,
      baseName: `__INT_PayE_Product_${TS}`,
      slug: `int-paye-product-${TS}`,
      basePrice: TOTAL,
      categoryId: cat.id,
      brandId: brand.id,
      status: 'active',
      stockQuantity: 50,
    });
    variant2 = await ProductVariant.create({
      productId: product2.id,
      sku: `INT-PAYE-${TS}`,
      variantName: 'Base',
      price: TOTAL,
      stockQuantity: 50,
      isDefault: true,
    });
    user2 = await User.create({
      firstName: '__INT_PayE',
      lastName: 'User',
      email: `__int_paye_${TS}@t.com`,
      password: 'Pay123!',
      role: 'customer',
    });

    repo = new SequelizePaymentRepository({
      Order,
      OrderItem,
      User,
      Cart,
      CartItem,
      DiscountCode,
      sequelize,
    });
    // Gateway stub: bỏ qua verify chữ ký (đã có unit test crypto riêng); refund trả fake.
    const vnpayGateway = {
      verifyReturnUrl: () => true,
      createPaymentUrl: () => ({}),
      refund: async () => ({ vnp_ResponseCode: '00' }),
    };
    const momoGateway = { verifySignature: () => true, createPaymentUrl: () => ({}) };
    const emailGateway = { sendOrderConfirmationEmail: async () => {} };

    // ordersService THẬT (DB thật) để refund đơn chưa giao hoàn kho qua path chung (INV-PAY-4 / H).
    const ordersRepo = new SequelizeOrdersRepository({
      Order,
      OrderItem,
      Cart,
      CartItem,
      Product,
      ProductVariant,
      User,
      DiscountCode,
      InventoryLog,
      sequelize,
    });
    const ordersService = new OrdersService({
      ordersRepository: ordersRepo,
      emailGateway: {
        sendOrderConfirmationEmail: async () => {},
        sendOrderCancellationEmail: async () => {},
        sendOrderStatusUpdateEmail: async () => {},
      },
      eventBus: { publish: async () => {} },
      logger: silentLogger,
      constants: { SHIPPING_FREE_THRESHOLD: 500_000 },
    });

    svc = new PaymentService({
      paymentRepository: repo,
      momoGateway,
      vnpayGateway,
      emailGateway,
      logger: silentLogger,
      frontendUrl: 'http://test.local',
      ordersService,
    });
  });

  afterAll(async () => {
    await OrderItem.destroy({ where: {}, force: true });
    await Order.destroy({ where: { number: { [Op.like]: `INT-PAYE-${TS}%` } }, force: true });
    await DiscountCode.destroy({ where: { code: { [Op.like]: `INTPAYE${TS}%` } }, force: true });
    if (variant2) await variant2.destroy({ force: true });
    if (product2) await product2.destroy({ force: true });
    if (user2) await user2.destroy({ force: true });
  });

  test('IPN thành công → order paid + processing + transId (assert DB)', async () => {
    const order = await makeOrder2('ipn-ok');
    const res = await svc.handleVnPayIPN({ vnp_Params: vnpParams(order) });

    expect(res.RspCode).toBe('00');
    const fresh = await Order.findByPk(order.id);
    expect(fresh.paymentStatus).toBe('paid');
    expect(fresh.status).toBe('processing');
    expect(fresh.paymentTransactionId).toBe(`VNP-${order.number}`);
  });

  test('IPN lặp lại (cùng order đã paid) → RspCode 02, không đổi thêm', async () => {
    const order = await makeOrder2('ipn-dup');
    await svc.handleVnPayIPN({ vnp_Params: vnpParams(order) });
    const res2 = await svc.handleVnPayIPN({ vnp_Params: vnpParams(order) });
    expect(res2.RspCode).toBe('02'); // already confirmed
  });

  test('IPN lệch số tiền → RspCode 04, order KHÔNG paid', async () => {
    const order = await makeOrder2('ipn-amt');
    const res = await svc.handleVnPayIPN({
      vnp_Params: vnpParams(order, { vnp_Amount: String(TOTAL * 100 + 100000) }),
    });
    expect(res.RspCode).toBe('04');
    const fresh = await Order.findByPk(order.id);
    expect(fresh.paymentStatus).toBe('pending');
  });

  test('IPN responseCode != 00 → paymentStatus=failed', async () => {
    const order = await makeOrder2('ipn-fail');
    const res = await svc.handleVnPayIPN({
      vnp_Params: vnpParams(order, { vnp_ResponseCode: '24' }),
    });
    expect(res.RspCode).toBe('00'); // VNPay vẫn nhận ACK
    const fresh = await Order.findByPk(order.id);
    expect(fresh.paymentStatus).toBe('failed');
  });

  describe('PaymentService.handleVnPayReturn — service thật + DB', () => {
    test('Return thành công → order paid (assert DB)', async () => {
      const order = await makeOrder2('ret-ok');
      const { redirectUrl } = await svc.handleVnPayReturn({ vnp_Params: vnpParams(order) });
      expect(redirectUrl).toContain('payment=success');
      const fresh = await Order.findByPk(order.id);
      expect(fresh.paymentStatus).toBe('paid');
    });

    test('Return lệch số tiền → redirect failed + order KHÔNG paid (P-1)', async () => {
      const order = await makeOrder2('ret-amt');
      const { redirectUrl } = await svc.handleVnPayReturn({
        vnp_Params: vnpParams(order, { vnp_Amount: String(TOTAL * 100 + 100000) }),
      });
      expect(redirectUrl).toContain('payment=failed');
      const fresh = await Order.findByPk(order.id);
      expect(fresh.paymentStatus).toBe('pending'); // FAIL nếu revert P-1
    });
  });

  describe('PaymentService.handleMomoIPN — service thật + DB', () => {
    const momoBody = (order, overrides = {}) => ({
      resultCode: 0,
      orderId: order.number,
      transId: `MOMO-${order.number}`,
      amount: TOTAL,
      extraData: `orderId=${order.id}`,
      ...overrides,
    });

    test('MoMo IPN thành công → order paid + provider=momo', async () => {
      const order = await makeOrder2('momo-ok');
      const res = await svc.handleMomoIPN({ body: momoBody(order) });
      expect(res.valid).toBe(true);
      const fresh = await Order.findByPk(order.id);
      expect(fresh.paymentStatus).toBe('paid');
      expect(fresh.paymentProvider).toBe('momo');
    });

    test('MoMo IPN thất bại (resultCode != 0) → paymentStatus=failed', async () => {
      const order = await makeOrder2('momo-fail');
      await svc.handleMomoIPN({ body: momoBody(order, { resultCode: 1 }) });
      const fresh = await Order.findByPk(order.id);
      expect(fresh.paymentStatus).toBe('failed');
    });
  });

  describe('PaymentService — discount usedCount + refund (service thật + DB)', () => {
    test('Thanh toán thành công tăng usedCount discount đúng 1 lần (idempotent)', async () => {
      const code = await DiscountCode.create({
        code: `INTPAYE${TS}A`,
        type: 'percent',
        value: 10,
        minOrderAmount: 0,
        usageLimit: 100,
        usedCount: 0,
        isActive: true,
      });
      const order = await makeOrder2('disc', { discountCodeId: code.id });

      await svc.handleVnPayIPN({ vnp_Params: vnpParams(order) });
      await svc.handleVnPayIPN({ vnp_Params: vnpParams(order) }); // lặp → idempotent

      const fresh = await code.reload();
      expect(fresh.usedCount).toBe(1);
    });

    const makeItem = (order, qty) =>
      OrderItem.create({
        orderId: order.id,
        productId: product2.id,
        variantId: variant2.id,
        name: product2.nameVi,
        unitPrice: TOTAL,
        quantity: qty,
        subtotal: TOTAL * qty,
      });

    test('INV-PAY-4 (H): refund đơn processing (CHƯA giao) → hoàn kho + cancelled + refunded', async () => {
      await variant2.update({ stockQuantity: 48 }); // giả lập đã bán 2
      const order = await makeOrder2('refund-proc', {
        status: 'processing',
        paymentStatus: 'paid',
        paymentProvider: 'vnpay',
        paymentTransactionId: `VNP-REFP-${TS}`,
      });
      await makeItem(order, 2);

      await svc.createRefund({ orderId: order.id, amount: TOTAL, ipAddr: '1.2.3.4' });

      const fresh = await Order.findByPk(order.id);
      expect(fresh.paymentStatus).toBe('refunded');
      expect(fresh.status).toBe('cancelled'); // chưa giao → cancel
      await variant2.reload();
      expect(variant2.stockQuantity).toBe(50); // 48 + 2 hoàn (FAIL nếu revert H)
    });

    test('INV-PAY-4 (H): refund đơn delivered (ĐÃ giao) → CHỈ refunded, KHÔNG hoàn kho, giữ status', async () => {
      await variant2.update({ stockQuantity: 48 });
      const order = await makeOrder2('refund-deliv', {
        status: 'delivered',
        paymentStatus: 'paid',
        paymentProvider: 'vnpay',
        paymentTransactionId: `VNP-REFD-${TS}`,
      });
      await makeItem(order, 2);

      await svc.createRefund({ orderId: order.id, amount: TOTAL, ipAddr: '1.2.3.4' });

      const fresh = await Order.findByPk(order.id);
      expect(fresh.paymentStatus).toBe('refunded');
      expect(fresh.status).toBe('delivered'); // đã giao → KHÔNG cancel
      await variant2.reload();
      expect(variant2.stockQuantity).toBe(48); // KHÔNG hoàn (hàng đã rời kho)
    });
  });

  describe('INV-PAY-3 (F10) — payment success KHÔNG hồi sinh đơn đã HỦY', () => {
    // Kịch bản: đơn online pending bị hủy (kho đã hoàn). IPN/return success tới muộn.
    // Đúng nghiệp vụ: GIỮ cancelled, KHÔNG mark paid (nếu revive → oversell). FAIL nếu revert F10.
    test('VNPay IPN success trên đơn cancelled → RspCode 02, GIỮ cancelled, KHÔNG paid', async () => {
      const order = await makeOrder2('cxl-ipn', { status: 'cancelled' });
      const res = await svc.handleVnPayIPN({ vnp_Params: vnpParams(order) });
      expect(res.RspCode).toBe('02');
      const fresh = await Order.findByPk(order.id);
      expect(fresh.status).toBe('cancelled');
      expect(fresh.paymentStatus).not.toBe('paid');
    });

    test('VNPay return success trên đơn cancelled → redirect KHÔNG success, GIỮ cancelled', async () => {
      const order = await makeOrder2('cxl-ret', { status: 'cancelled' });
      const { redirectUrl } = await svc.handleVnPayReturn({ vnp_Params: vnpParams(order) });
      expect(redirectUrl).not.toContain('payment=success');
      const fresh = await Order.findByPk(order.id);
      expect(fresh.status).toBe('cancelled');
      expect(fresh.paymentStatus).not.toBe('paid');
    });

    test('MoMo IPN success trên đơn cancelled → GIỮ cancelled, KHÔNG paid', async () => {
      const order = await makeOrder2('cxl-momo', { status: 'cancelled' });
      await svc.handleMomoIPN({
        body: {
          resultCode: 0,
          orderId: order.number,
          transId: `MOMO-CXL-${order.number}`,
          amount: TOTAL,
          extraData: `orderId=${order.id}`,
        },
      });
      const fresh = await Order.findByPk(order.id);
      expect(fresh.status).toBe('cancelled');
      expect(fresh.paymentStatus).not.toBe('paid');
    });
  });
});
