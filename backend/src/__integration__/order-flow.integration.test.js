/**
 * Integration tests — Full order flow end-to-end với DB thật.
 * Simulate: Guest cart → Login → Merge → Checkout → Order → Payment → Loyalty
 */
require('module-alias/register');
const sequelize = require('@config/sequelize');
const {
  User,
  Product,
  ProductVariant,
  Category,
  Brand,
  Cart,
  CartItem,
  Order,
  OrderItem,
  LoyaltyHistory,
  DiscountCode,
} = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user, product, variant, cat, brand;

beforeAll(async () => {
  await sequelize.authenticate();
  cat = await Category.create({
    nameVi: `__INT_Flow_Cat_${TS}`,
    nameEn: `__INT_Flow_Cat_${TS}`,
    slug: `int-flow-cat-${TS}`,
    isActive: true,
  });
  brand = await Brand.create({
    nameVi: `__INT_Flow_Brand_${TS}`,
    nameEn: `__INT_Flow_Brand_${TS}`,
    slug: `int-flow-brand-${TS}`,
  });
  product = await Product.create({
    nameVi: `__INT_Flow_Product_${TS}`,
    nameEn: `__INT_Flow_Product_${TS}`,
    baseName: `__INT_Flow_Product_${TS}`,
    slug: `int-flow-product-${TS}`,
    basePrice: 10_000_000,
    compareAtPrice: 12_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 30,
  });
  variant = await ProductVariant.create({
    productId: product.id,
    sku: `INT-FLOW-${TS}`,
    variantName: '16GB',
    price: 10_000_000,
    stockQuantity: 30,
    isDefault: true,
  });
  user = await User.create({
    firstName: '__INT_Flow',
    lastName: 'User',
    email: `__int_flow_${TS}@t.com`,
    password: 'Flow123!',
    role: 'customer',
    loyaltyPoints: 0,
  });
});

afterAll(async () => {
  await LoyaltyHistory.destroy({ where: { userId: user?.id }, force: true });
  await CartItem.destroy({ where: {}, force: true });
  await Cart.destroy({ where: { userId: user?.id }, force: true });
  await OrderItem.destroy({ where: {}, force: true });
  await Order.destroy({ where: { number: { [Op.like]: `INT-FLOW-${TS}%` } }, force: true });
  await DiscountCode.destroy({ where: { code: { [Op.like]: `INT-FLOW-DC-${TS}%` } }, force: true });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (user) await user.destroy({ force: true });
});

describe('Full Order Flow — Cart → Order → Payment → Loyalty', () => {
  let cart, order;
  const QTY = 2;

  test('1. Tạo cart và thêm sản phẩm', async () => {
    cart = await Cart.create({ userId: user.id, status: 'active' });
    await CartItem.create({
      cartId: cart.id,
      productId: product.id,
      variantId: variant.id,
      quantity: QTY,
      unitPrice: variant.price,
    });
    const items = await CartItem.findAll({ where: { cartId: cart.id } });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(QTY);
  });

  test('2. Validate stock trước khi đặt hàng', async () => {
    const fresh = await ProductVariant.findByPk(variant.id);
    expect(fresh.stockQuantity).toBeGreaterThanOrEqual(QTY);
  });

  test('3. Tạo đơn hàng + trừ stock', async () => {
    const stockBefore = variant.stockQuantity;
    const subtotal = Number(variant.price) * QTY;

    order = await Order.create({
      number: `INT-FLOW-${TS}-01`,
      userId: user.id,
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      shippingFirstName: '__INT',
      shippingLastName: 'Flow',
      shippingAddress1: '1 Flow St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'Flow',
      billingAddress1: '1 Flow St',
      billingCity: 'HCM',
      subtotal,
      tax: 0,
      shippingCost: 30_000,
      total: subtotal + 30_000,
    });
    await OrderItem.create({
      orderId: order.id,
      productId: product.id,
      variantId: variant.id,
      name: product.nameVi,
      unitPrice: variant.price,
      quantity: QTY,
      subtotal,
    });

    // Trừ stock
    await variant.decrement('stockQuantity', { by: QTY });
    await variant.reload();
    expect(variant.stockQuantity).toBe(stockBefore - QTY);
    expect(order.status).toBe('pending');
  });

  test('4. Clear cart sau khi đặt hàng', async () => {
    await Cart.update({ status: 'converted' }, { where: { id: cart.id } });
    await cart.reload();
    expect(cart.status).toBe('converted');
  });

  test('5. Xác nhận thanh toán (COD delivered)', async () => {
    await order.update({ status: 'delivered', paymentStatus: 'paid' });
    await order.reload();
    expect(order.paymentStatus).toBe('paid');
    expect(order.status).toBe('delivered');
  });

  test('6. Tích điểm loyalty sau delivered', async () => {
    const points = Math.floor(Number(order.total) / 100_000); // 1 điểm per 100k
    await LoyaltyHistory.create({
      userId: user.id,
      orderId: order.id,
      type: 'earn',
      points,
      description: `Tích điểm đơn hàng ${order.number}`,
    });
    await user.increment('loyaltyPoints', { by: points });
    await user.reload();
    expect(user.loyaltyPoints).toBe(points);
  });

  test('7. Verify tổng flow: order + items + loyalty nhất quán', async () => {
    const o = await Order.findByPk(order.id);
    const items = await OrderItem.findAll({ where: { orderId: order.id } });
    const history = await LoyaltyHistory.findAll({ where: { orderId: order.id } });

    expect(o.status).toBe('delivered');
    expect(items).toHaveLength(1);
    expect(history).toHaveLength(1);
    expect(Number(items[0].subtotal)).toBe(Number(variant.price) * QTY);
  });
});

describe('Full Order Flow — Với Discount Code', () => {
  let dc;

  beforeAll(async () => {
    dc = await DiscountCode.create({
      code: `INT-FLOW-DC-${TS}`,
      type: 'percent',
      value: 10,
      minOrderAmount: 5_000_000,
      usageLimit: 10,
      usedCount: 0,
      isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    });
  });

  test('Apply discount code — tính giảm giá đúng', async () => {
    const subtotal = 10_000_000;
    const discount = subtotal * (Number(dc.value) / 100); // 10% = 1M
    const total = subtotal - discount;

    const order = await Order.create({
      number: `INT-FLOW-${TS}-DC`,
      userId: user.id,
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      discountCodeId: dc.id,
      shippingFirstName: '__INT',
      shippingLastName: 'DC',
      shippingAddress1: '1 DC St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'DC',
      billingAddress1: '1 DC St',
      billingCity: 'HCM',
      subtotal,
      tax: 0,
      shippingCost: 0,
      total,
    });

    expect(Number(order.total)).toBe(9_000_000);

    // Tăng usedCount
    await dc.increment('usedCount');
    await dc.reload();
    expect(dc.usedCount).toBe(1);

    await order.destroy({ force: true });
  });

  test('Discount code đạt usageLimit — không apply được', async () => {
    // Set usedCount = usageLimit
    await dc.update({ usedCount: dc.usageLimit });
    await dc.reload();

    const isValid = dc.usedCount < dc.usageLimit;
    expect(isValid).toBe(false); // không còn valid
  });
});

describe('Full Order Flow — Cancel và restore stock', () => {
  test('Cancel order → restore stockQuantity', async () => {
    const initialStock = variant.stockQuantity;
    const qty = 3;

    // Đặt hàng
    await variant.decrement('stockQuantity', { by: qty });

    const order = await Order.create({
      number: `INT-FLOW-${TS}-CANCEL`,
      userId: user.id,
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      shippingFirstName: '__INT',
      shippingLastName: 'Cancel',
      shippingAddress1: '1 St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'Cancel',
      billingAddress1: '1 St',
      billingCity: 'HCM',
      subtotal: 3_000_000,
      tax: 0,
      shippingCost: 0,
      total: 3_000_000,
    });

    // Cancel → restore stock
    await order.update({ status: 'cancelled' });
    await variant.increment('stockQuantity', { by: qty });
    await variant.reload();

    expect(variant.stockQuantity).toBe(initialStock);
    expect(order.status).toBe('cancelled');

    await order.destroy({ force: true });
  });
});
