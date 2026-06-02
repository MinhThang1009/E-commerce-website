/**
 * Integration tests — PaymentService gọi SERVICE THẬT + MySQL thật (assert OUTCOME).
 *
 * Khác `payment.integration.test.js` (thao tác Model trực tiếp — tautological): file này
 * dựng PaymentService với SequelizePaymentRepository thật + gateway stub (bỏ qua chữ ký HMAC,
 * vì crypto đã có unit test riêng), rồi gọi handleVnPayIPN/handleVnPayReturn/handleMomoIPN/
 * createRefund và kiểm tra trạng thái DB. Bắt được bug logic mà unit mock bỏ lọt (bài học F1/F2).
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
} = require('@models');
const { Op } = require('sequelize');

const PaymentService = require('@modules/payment/services/payment-service');
const SequelizePaymentRepository = require('@modules/payment/repositories/sequelize-payment-repository');

const TS = Date.now();
const TOTAL = 5_000_000;
let user, product, variant, svc, repo;
const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };

const makeOrder = async (num, extra = {}) =>
  Order.create({
    number: `INT-PAYE-${TS}-${num}`,
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
    subtotal: TOTAL,
    tax: 0,
    shippingCost: 0,
    total: TOTAL,
    ...extra,
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
  product = await Product.create({
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
  variant = await ProductVariant.create({
    productId: product.id,
    sku: `INT-PAYE-${TS}`,
    variantName: 'Base',
    price: TOTAL,
    stockQuantity: 50,
    isDefault: true,
  });
  user = await User.create({
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
  svc = new PaymentService({
    paymentRepository: repo,
    momoGateway,
    vnpayGateway,
    emailGateway,
    logger: silentLogger,
    frontendUrl: 'http://test.local',
  });
});

afterAll(async () => {
  await OrderItem.destroy({ where: {}, force: true });
  await Order.destroy({ where: { number: { [Op.like]: `INT-PAYE-${TS}%` } }, force: true });
  await DiscountCode.destroy({ where: { code: { [Op.like]: `INTPAYE${TS}%` } }, force: true });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (user) await user.destroy({ force: true });
});

const vnpParams = (order, overrides = {}) => ({
  vnp_TxnRef: order.number,
  vnp_ResponseCode: '00',
  vnp_TransactionNo: `VNP-${order.number}`,
  vnp_Amount: String(TOTAL * 100),
  ...overrides,
});

describe('PaymentService.handleVnPayIPN — service thật + DB', () => {
  test('IPN thành công → order paid + processing + transId (assert DB)', async () => {
    const order = await makeOrder('ipn-ok');
    const res = await svc.handleVnPayIPN({ vnp_Params: vnpParams(order) });

    expect(res.RspCode).toBe('00');
    const fresh = await Order.findByPk(order.id);
    expect(fresh.paymentStatus).toBe('paid');
    expect(fresh.status).toBe('processing');
    expect(fresh.paymentTransactionId).toBe(`VNP-${order.number}`);
  });

  test('IPN lặp lại (cùng order đã paid) → RspCode 02, không đổi thêm', async () => {
    const order = await makeOrder('ipn-dup');
    await svc.handleVnPayIPN({ vnp_Params: vnpParams(order) });
    const res2 = await svc.handleVnPayIPN({ vnp_Params: vnpParams(order) });
    expect(res2.RspCode).toBe('02'); // already confirmed
  });

  test('IPN lệch số tiền → RspCode 04, order KHÔNG paid', async () => {
    const order = await makeOrder('ipn-amt');
    const res = await svc.handleVnPayIPN({
      vnp_Params: vnpParams(order, { vnp_Amount: String(TOTAL * 100 + 100000) }),
    });
    expect(res.RspCode).toBe('04');
    const fresh = await Order.findByPk(order.id);
    expect(fresh.paymentStatus).toBe('pending');
  });

  test('IPN responseCode != 00 → paymentStatus=failed', async () => {
    const order = await makeOrder('ipn-fail');
    const res = await svc.handleVnPayIPN({
      vnp_Params: vnpParams(order, { vnp_ResponseCode: '24' }),
    });
    expect(res.RspCode).toBe('00'); // VNPay vẫn nhận ACK
    const fresh = await Order.findByPk(order.id);
    expect(fresh.paymentStatus).toBe('failed');
  });
});

describe('PaymentService.handleVnPayReturn — service thật + DB', () => {
  test('Return thành công → order paid (assert DB)', async () => {
    const order = await makeOrder('ret-ok');
    const { redirectUrl } = await svc.handleVnPayReturn({ vnp_Params: vnpParams(order) });
    expect(redirectUrl).toContain('payment=success');
    const fresh = await Order.findByPk(order.id);
    expect(fresh.paymentStatus).toBe('paid');
  });

  test('Return lệch số tiền → redirect failed + order KHÔNG paid (P-1)', async () => {
    const order = await makeOrder('ret-amt');
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
    const order = await makeOrder('momo-ok');
    const res = await svc.handleMomoIPN({ body: momoBody(order) });
    expect(res.valid).toBe(true);
    const fresh = await Order.findByPk(order.id);
    expect(fresh.paymentStatus).toBe('paid');
    expect(fresh.paymentProvider).toBe('momo');
  });

  test('MoMo IPN thất bại (resultCode != 0) → paymentStatus=failed', async () => {
    const order = await makeOrder('momo-fail');
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
    const order = await makeOrder('disc', { discountCodeId: code.id });

    await svc.handleVnPayIPN({ vnp_Params: vnpParams(order) });
    await svc.handleVnPayIPN({ vnp_Params: vnpParams(order) }); // lặp → idempotent

    const fresh = await code.reload();
    expect(fresh.usedCount).toBe(1);
  });

  test('createRefund đơn đã paid (vnpay) → paymentStatus=refunded (assert DB)', async () => {
    const order = await makeOrder('refund', {
      paymentStatus: 'paid',
      paymentProvider: 'vnpay',
      paymentTransactionId: `VNP-REF-${TS}`,
    });
    await svc.createRefund({ orderId: order.id, amount: TOTAL, ipAddr: '1.2.3.4' });
    const fresh = await Order.findByPk(order.id);
    expect(fresh.paymentStatus).toBe('refunded');
  });
});
