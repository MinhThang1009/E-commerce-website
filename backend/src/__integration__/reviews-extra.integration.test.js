/**
 * Integration tests — Reviews extra cases với real DB.
 * Kiểm tra: rating min/max, update review, admin verify, lấy danh sách theo productId.
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
let buyer, product, variant, cat, brand, deliveredOrder;

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
    nameVi: `__INT_RevExtra_Cat_${TS}`,
    nameEn: `__INT_RevExtra_Cat_${TS}`,
    slug: `int-rev-extra-cat-${TS}`,
    isActive: true,
  });
  brand = await Brand.create({
    nameVi: `__INT_RevExtra_Brand_${TS}`,
    nameEn: `__INT_RevExtra_Brand_${TS}`,
    slug: `int-rev-extra-brand-${TS}`,
  });
  product = await Product.create({
    nameVi: `__INT_RevExtra_Product_${TS}`,
    nameEn: `__INT_RevExtra_Product_${TS}`,
    baseName: `__INT_RevExtra_Product_${TS}`,
    slug: `int-rev-extra-product-${TS}`,
    basePrice: 2_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 10,
  });
  variant = await ProductVariant.create({
    productId: product.id,
    sku: `INT-REV-EXTRA-${TS}`,
    variantName: 'Default',
    price: 2_000_000,
    stockQuantity: 10,
    isDefault: true,
  });

  // buyer: đã có đơn hàng delivered chứa product
  buyer = await User.create({
    firstName: '__INT_RevExtra',
    lastName: 'Buyer',
    email: `__int_rev_extra_buyer_${TS}@test.com`,
    password: 'RevExtra123!',
    role: 'customer',
  });
  deliveredOrder = await Order.create({
    number: `INT-REV-EXTRA-ORD-${TS}`,
    userId: buyer.id,
    status: 'delivered',
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    shippingFirstName: '__INT',
    shippingLastName: 'RevExtra',
    shippingAddress1: '1 Rev Extra St',
    shippingCity: 'HCM',
    billingFirstName: '__INT',
    billingLastName: 'RevExtra',
    billingAddress1: '1 Rev Extra St',
    billingCity: 'HCM',
    subtotal: 2_000_000,
    tax: 0,
    shippingCost: 0,
    total: 2_000_000,
  });
  await OrderItem.create({
    orderId: deliveredOrder.id,
    productId: product.id,
    variantId: variant.id,
    name: product.nameVi,
    unitPrice: 2_000_000,
    quantity: 1,
    subtotal: 2_000_000,
  });
});

afterAll(async () => {
  await Review.destroy({ where: { productId: product?.id }, force: true });
  await OrderItem.destroy({ where: { orderId: deliveredOrder?.id }, force: true });
  await Order.destroy({ where: { id: deliveredOrder?.id }, force: true });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (buyer) await buyer.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
});

// ─────────────────────────────────────────────────────────────
describe('Reviews extra — rating biên', () => {
  test('Tạo review với rating 1 (min) → hợp lệ', async () => {
    // Arrange — xóa review cũ của buyer trước để có thể tạo mới
    await Review.destroy({ where: { userId: buyer.id, productId: product.id }, force: true });

    const service = makeService();

    // Act
    const { review } = await service.createReview({
      userId: buyer.id,
      productId: product.id,
      rating: 1,
      title: '__INT min rating',
      comment: '__INT review với rating thấp nhất',
    });

    // Assert
    expect(review).toBeDefined();
    expect(review.rating).toBe(1);

    // Dọn dẹp để test tiếp theo có thể tạo review mới
    await Review.destroy({ where: { id: review.id }, force: true });
  });

  test('Tạo review với rating 5 (max) → hợp lệ', async () => {
    // Arrange — xóa review cũ
    await Review.destroy({ where: { userId: buyer.id, productId: product.id }, force: true });

    const service = makeService();

    // Act
    const { review } = await service.createReview({
      userId: buyer.id,
      productId: product.id,
      rating: 5,
      title: '__INT max rating',
      comment: '__INT review với rating cao nhất',
    });

    // Assert
    expect(review).toBeDefined();
    expect(review.rating).toBe(5);
    // Không xóa — test tiếp theo sẽ dùng review này để update
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reviews extra — update review', () => {
  test('Update review → nội dung mới được lưu', async () => {
    // Arrange — lấy review hiện tại (được tạo bởi test trước, rating=5)
    const existing = await Review.findOne({
      where: { userId: buyer.id, productId: product.id },
    });
    expect(existing).not.toBeNull();

    // Act — update trực tiếp qua model
    await existing.update({
      rating: 3,
      content: '__INT nội dung đã cập nhật',
    });
    await existing.reload();

    // Assert
    expect(existing.rating).toBe(3);
    expect(existing.content).toBe('__INT nội dung đã cập nhật');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reviews extra — admin verify', () => {
  test('Admin verify review → isVerified=true', async () => {
    const service = makeService();

    // Lấy review hiện tại
    const review = await Review.findOne({
      where: { userId: buyer.id, productId: product.id },
    });
    expect(review).not.toBeNull();

    // Đảm bảo review chưa verified
    await review.update({ isVerified: false });

    // Act — admin verify
    const result = await service.verifyReview({ reviewId: review.id, isVerified: true });

    // Assert — service trả về isVerified=true
    expect(result.data.isVerified).toBe(true);

    // Kiểm tra DB cũng cập nhật
    await review.reload();
    expect(review.isVerified).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reviews extra — lấy danh sách theo productId', () => {
  test('Lấy danh sách reviews theo productId → đúng product', async () => {
    // Arrange — review của buyer đã tồn tại từ các test trước

    // Act — tìm tất cả reviews của product này
    const reviews = await Review.findAll({
      where: { productId: product.id },
    });

    // Assert — ít nhất 1 review, tất cả thuộc đúng product
    expect(reviews.length).toBeGreaterThanOrEqual(1);
    reviews.forEach((r) => {
      expect(r.productId).toBe(product.id);
    });
  });
});
