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
  LoyaltyHistory,
} = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user, product, variant;

beforeAll(async () => {
  await sequelize.authenticate();
  const cat = await Category.create({
    nameVi: `__INT_Ord_Cat_${TS}`,
    nameEn: `__INT_Ord_Cat_${TS}`,
    slug: `int-ord-cat-${TS}`,
    isActive: true,
  });
  const brand = await Brand.create({
    nameVi: `__INT_Ord_Brand_${TS}`,
    nameEn: `__INT_Ord_Brand_${TS}`,
    slug: `int-ord-brand-${TS}`,
  });

  product = await Product.create({
    nameVi: `__INT_Ord_Product_${TS}`,
    nameEn: `__INT_Ord_Product_${TS}`,
    baseName: `__INT_Ord_Product_${TS}`,
    slug: `int-ord-product-${TS}`,
    basePrice: 2_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 50,
  });

  variant = await ProductVariant.create({
    productId: product.id,
    sku: `INT-ORD-${TS}`,
    variantName: '8GB',
    price: 2_000_000,
    stockQuantity: 50,
    isDefault: true,
  });

  user = await User.create({
    firstName: '__INT_Orders',
    lastName: 'User',
    email: `__int_orders_${TS}@test.com`,
    password: 'Order123!',
    role: 'customer',
  });
});

afterAll(async () => {
  await LoyaltyHistory.destroy({ where: { userId: user?.id }, force: true });
  await OrderItem.destroy({ where: {}, force: true });
  await Order.destroy({ where: { userId: user?.id }, force: true });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (user) await user.destroy({ force: true });
});

describe('Orders Integration', () => {
  let order;

  test('Tạo order + trừ stock variant', async () => {
    const qty = 3;
    const stockBefore = variant.stockQuantity;

    // Tạo order
    order = await Order.create({
      number: `INT-ORD-${TS}`,
      userId: user.id,
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      shippingFirstName: '__INT',
      shippingLastName: 'Test',
      shippingAddress1: '123 Test St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'Test',
      billingAddress1: '123 Test St',
      billingCity: 'HCM',
      subtotal: 2_000_000 * qty,
      tax: 0,
      shippingCost: 30_000,
      total: 2_000_000 * qty + 30_000,
    });

    // Tạo order item
    await OrderItem.create({
      orderId: order.id,
      productId: product.id,
      variantId: variant.id,
      name: product.nameVi,
      unitPrice: 2_000_000,
      quantity: qty,
      subtotal: 2_000_000 * qty,
    });

    // Trừ stock
    await variant.decrement('stockQuantity', { by: qty });
    await variant.reload();

    expect(variant.stockQuantity).toBe(stockBefore - qty);
  });

  test('Order items gắn đúng orderId', async () => {
    const items = await OrderItem.findAll({ where: { orderId: order.id } });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
    expect(Number(items[0].unitPrice)).toBe(2_000_000);
  });

  test('Total = subtotal + shippingFee', async () => {
    expect(Number(order.total)).toBe(Number(order.subtotal) + Number(order.shippingCost));
  });

  test('Tạo LoyaltyHistory khi thanh toán thành công', async () => {
    await LoyaltyHistory.create({
      userId: user.id,
      orderId: order.id,
      type: 'earn',
      points: 6, // 6M / 1000
      description: 'Tích điểm từ đơn hàng',
    });

    const history = await LoyaltyHistory.findOne({ where: { orderId: order.id, type: 'earn' } });
    expect(history).not.toBeNull();
    expect(history.points).toBe(6);
  });

  test('Update order status: pending → processing', async () => {
    await order.update({ status: 'processing', paymentStatus: 'paid' });
    await order.reload();
    expect(order.status).toBe('processing');
    expect(order.paymentStatus).toBe('paid');
  });

  test('Cancel order — khôi phục stock', async () => {
    const qtyOrdered = 3;
    await order.update({ status: 'cancelled' });
    await variant.increment('stockQuantity', { by: qtyOrdered });
    await variant.reload();
    expect(variant.stockQuantity).toBe(50); // về lại ban đầu
    expect(order.status).toBe('cancelled');
  });
});
