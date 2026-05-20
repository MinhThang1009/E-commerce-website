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
  Review,
  ReviewFeedback,
} = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user, user2, product, variant, order;

beforeAll(async () => {
  await sequelize.authenticate();
  const cat = await Category.create({
    nameVi: `__INT_Rev_Cat_${TS}`,
    nameEn: `__INT_Rev_Cat_${TS}`,
    slug: `int-rev-cat-${TS}`,
    isActive: true,
  });
  const brand = await Brand.create({
    nameVi: `__INT_Rev_Brand_${TS}`,
    nameEn: `__INT_Rev_Brand_${TS}`,
    slug: `int-rev-brand-${TS}`,
  });
  product = await Product.create({
    nameVi: `__INT_Rev_Product_${TS}`,
    nameEn: `__INT_Rev_Product_${TS}`,
    baseName: `__INT_Rev_Product_${TS}`,
    slug: `int-rev-product-${TS}`,
    basePrice: 1_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 10,
  });
  variant = await ProductVariant.create({
    productId: product.id,
    sku: `INT-REV-${TS}`,
    variantName: 'Default',
    price: 1_000_000,
    stockQuantity: 10,
    isDefault: true,
  });
  user = await User.create({
    firstName: '__INT_Rev',
    lastName: 'User1',
    email: `__int_rev1_${TS}@t.com`,
    password: 'Rev123!',
    role: 'customer',
  });
  user2 = await User.create({
    firstName: '__INT_Rev2',
    lastName: 'User2',
    email: `__int_rev2_${TS}@t.com`,
    password: 'Rev123!',
    role: 'customer',
  });
  order = await Order.create({
    number: `INT-REV-ORD-${TS}`,
    userId: user.id,
    status: 'delivered',
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    shippingFirstName: '__INT',
    shippingLastName: 'Rev',
    shippingAddress1: '1 Rev St',
    shippingCity: 'HCM',
    billingFirstName: '__INT',
    billingLastName: 'Rev',
    billingAddress1: '1 Rev St',
    billingCity: 'HCM',
    subtotal: 1_000_000,
    tax: 0,
    shippingCost: 0,
    total: 1_000_000,
  });
  await OrderItem.create({
    orderId: order.id,
    productId: product.id,
    variantId: variant.id,
    name: product.nameVi,
    unitPrice: 1_000_000,
    quantity: 1,
    subtotal: 1_000_000,
  });
});

afterAll(async () => {
  await ReviewFeedback.destroy({ where: {}, force: true });
  await Review.destroy({ where: { productId: product?.id }, force: true });
  await OrderItem.destroy({ where: { orderId: order?.id }, force: true });
  await Order.destroy({ where: { id: order?.id }, force: true });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (user) await user.destroy({ force: true });
  if (user2) await user2.destroy({ force: true });
});

describe('Reviews Integration', () => {
  let review;

  test('Tạo review — user đã mua hàng', async () => {
    // Verify user đã có order chứa product
    // Tìm OrderItem của product trong đơn hàng delivered của user
    const deliveredOrder = await Order.findOne({ where: { userId: user.id, status: 'delivered' } });
    expect(deliveredOrder).not.toBeNull();
    const hasOrder = await OrderItem.findOne({
      where: { orderId: deliveredOrder.id, productId: product.id },
    });
    expect(hasOrder).not.toBeNull();

    review = await Review.create({
      userId: user.id,
      productId: product.id,
      rating: 5,
      content: '__INT review content',
    });
    expect(review.id).toBeDefined();
    expect(review.rating).toBe(5);
  });

  test('User2 chưa mua — không có order', async () => {
    const user2Order = await Order.findOne({ where: { userId: user2.id } });
    expect(user2Order).toBeNull(); // user2 chưa có order nào
  });

  test('Cập nhật review', async () => {
    await review.update({ rating: 4, content: '__INT updated content' });
    await review.reload();
    expect(review.rating).toBe(4);
    expect(review.content).toBe('__INT updated content');
  });

  test('Helpful feedback', async () => {
    const feedback = await ReviewFeedback.create({
      reviewId: review.id,
      userId: user2.id,
      isHelpful: true,
    });
    expect(feedback.isHelpful).toBe(true);
  });

  test('Lấy reviews theo productId', async () => {
    const reviews = await Review.findAll({ where: { productId: product.id } });
    expect(reviews.length).toBeGreaterThanOrEqual(1);
  });
});
