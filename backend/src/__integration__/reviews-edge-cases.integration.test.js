/**
 * Integration tests — Reviews edge cases với real DB.
 * Kiểm tra: chưa có đơn hàng delivered, unique constraint (userId, productId),
 * và admin verify review.
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
  Review,
} = require('@models');

const SequelizeReviewsRepository = require('@modules/reviews/repositories/sequelize-reviews-repository');
const ReviewsService = require('@modules/reviews/services/reviews-service');

const TS = Date.now();
let userWithPurchase, userWithoutPurchase, product, variant, cat, brand, deliveredOrder;

function makeService() {
  const repo = new SequelizeReviewsRepository({
    Review,
    Product,
    User,
    Order,
    OrderItem,
  });
  return new ReviewsService({
    reviewsRepository: repo,
    eventBus: { publish: jest.fn().mockResolvedValue(undefined) },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  });
}

beforeAll(async () => {
  await sequelize.authenticate();

  cat = await Category.create({
    nameVi: `__INT_RevEdge_Cat_${TS}`,
    nameEn: `__INT_RevEdge_Cat_${TS}`,
    slug: `int-rev-edge-cat-${TS}`,
    isActive: true,
  });
  brand = await Brand.create({
    nameVi: `__INT_RevEdge_Brand_${TS}`,
    nameEn: `__INT_RevEdge_Brand_${TS}`,
    slug: `int-rev-edge-brand-${TS}`,
  });
  product = await Product.create({
    nameVi: `__INT_RevEdge_Product_${TS}`,
    nameEn: `__INT_RevEdge_Product_${TS}`,
    baseName: `__INT_RevEdge_Product_${TS}`,
    slug: `int-rev-edge-product-${TS}`,
    basePrice: 1_500_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 10,
  });
  variant = await ProductVariant.create({
    productId: product.id,
    sku: `INT-REV-EDGE-${TS}`,
    variantName: 'Default',
    price: 1_500_000,
    stockQuantity: 10,
    isDefault: true,
  });

  // userWithPurchase: có đơn hàng delivered chứa product
  userWithPurchase = await User.create({
    firstName: '__INT_RevEdge',
    lastName: 'Buyer',
    email: `__int_rev_edge_buyer_${TS}@test.com`,
    password: 'RevEdge123!',
    role: 'customer',
  });
  deliveredOrder = await Order.create({
    number: `INT-REV-EDGE-ORD-${TS}`,
    userId: userWithPurchase.id,
    status: 'delivered',
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    shippingFirstName: '__INT',
    shippingLastName: 'RevEdge',
    shippingAddress1: '1 Rev Edge St',
    shippingCity: 'HCM',
    billingFirstName: '__INT',
    billingLastName: 'RevEdge',
    billingAddress1: '1 Rev Edge St',
    billingCity: 'HCM',
    subtotal: 1_500_000,
    tax: 0,
    shippingCost: 0,
    total: 1_500_000,
  });
  await OrderItem.create({
    orderId: deliveredOrder.id,
    productId: product.id,
    variantId: variant.id,
    name: product.nameVi,
    unitPrice: 1_500_000,
    quantity: 1,
    subtotal: 1_500_000,
  });

  // userWithoutPurchase: không có đơn hàng nào
  userWithoutPurchase = await User.create({
    firstName: '__INT_RevEdge',
    lastName: 'NoBuyer',
    email: `__int_rev_edge_nobuyer_${TS}@test.com`,
    password: 'RevEdge456!',
    role: 'customer',
  });
});

afterAll(async () => {
  await Review.destroy({ where: { productId: product?.id }, force: true });
  await OrderItem.destroy({ where: { orderId: deliveredOrder?.id }, force: true });
  await Order.destroy({ where: { id: deliveredOrder?.id }, force: true });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (userWithPurchase) await userWithPurchase.destroy({ force: true });
  if (userWithoutPurchase) await userWithoutPurchase.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
});

describe('Reviews edge cases — kiểm tra điều kiện đặt hàng', () => {
  test('Tạo review khi chưa có đơn hàng delivered → throw lỗi', async () => {
    const service = makeService();

    await expect(
      service.createReview({
        userId: userWithoutPurchase.id,
        productId: product.id,
        rating: 4,
        title: '__INT review title',
        comment: '__INT review comment',
      }),
    ).rejects.toThrow();
  });
});

describe('Reviews edge cases — service upsert (userId, productId)', () => {
  test('Cùng user tạo 2 review cho cùng sản phẩm → lần 2 cập nhật review cũ, không tạo bản ghi mới', async () => {
    const service = makeService();

    // Lần 1 — tạo review mới
    const { review: first } = await service.createReview({
      userId: userWithPurchase.id,
      productId: product.id,
      rating: 5,
      title: '__INT first review',
      comment: '__INT first comment',
    });
    expect(first.id).toBeDefined();

    // Lần 2 — cùng user + cùng product → service update review cũ (upsert)
    const { review: second } = await service.createReview({
      userId: userWithPurchase.id,
      productId: product.id,
      rating: 3,
      title: '__INT updated review',
      comment: '__INT updated comment',
    });

    // Phải là cùng một record — không tạo bản ghi mới
    expect(second.id).toBe(first.id);
    expect(second.rating).toBe(3);

    // Chỉ có 1 review trong DB cho cặp (userId, productId) này
    const allReviews = await Review.findAll({
      where: { userId: userWithPurchase.id, productId: product.id },
    });
    expect(allReviews).toHaveLength(1);
  });
});

describe('Reviews edge cases — admin verify', () => {
  test('Admin verify review → review.isVerified = true', async () => {
    const service = makeService();

    // Lấy review vừa tạo ở test trên
    const existingReview = await Review.findOne({
      where: { userId: userWithPurchase.id, productId: product.id },
    });
    expect(existingReview).not.toBeNull();

    // Set isVerified=false để test rõ ràng
    await existingReview.update({ isVerified: false });

    const result = await service.verifyReview({ reviewId: existingReview.id, isVerified: true });

    expect(result.data.isVerified).toBe(true);

    // Xác nhận DB đã cập nhật
    await existingReview.reload();
    expect(existingReview.isVerified).toBe(true);
  });
});
