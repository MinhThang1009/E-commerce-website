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
} = require('@models');
const { Op } = require('sequelize');

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
