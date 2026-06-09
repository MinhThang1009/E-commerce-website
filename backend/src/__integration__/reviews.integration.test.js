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
const { Op } = require('sequelize');
const SequelizeReviewsRepository = require('@modules/reviews/repositories/sequelize-reviews-repository');
const ReviewsService = require('@modules/reviews/services/reviews-service');

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

  test('Lấy reviews theo productId', async () => {
    const reviews = await Review.findAll({ where: { productId: product.id } });
    expect(reviews.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Reviews extra — rating biên', () => {
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

describe('Reviews extra — update review', () => {
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
      nameVi: `__INT_RevExtraUpd_Cat_${TS}`,
      nameEn: `__INT_RevExtraUpd_Cat_${TS}`,
      slug: `int-rev-extra-upd-cat-${TS}`,
      isActive: true,
    });
    brand = await Brand.create({
      nameVi: `__INT_RevExtraUpd_Brand_${TS}`,
      nameEn: `__INT_RevExtraUpd_Brand_${TS}`,
      slug: `int-rev-extra-upd-brand-${TS}`,
    });
    product = await Product.create({
      nameVi: `__INT_RevExtraUpd_Product_${TS}`,
      nameEn: `__INT_RevExtraUpd_Product_${TS}`,
      baseName: `__INT_RevExtraUpd_Product_${TS}`,
      slug: `int-rev-extra-upd-product-${TS}`,
      basePrice: 2_000_000,
      categoryId: cat.id,
      brandId: brand.id,
      status: 'active',
      stockQuantity: 10,
    });
    variant = await ProductVariant.create({
      productId: product.id,
      sku: `INT-REV-EXTRA-UPD-${TS}`,
      variantName: 'Default',
      price: 2_000_000,
      stockQuantity: 10,
      isDefault: true,
    });

    buyer = await User.create({
      firstName: '__INT_RevExtraUpd',
      lastName: 'Buyer',
      email: `__int_rev_extra_upd_buyer_${TS}@test.com`,
      password: 'RevExtraUpd123!',
      role: 'customer',
    });
    deliveredOrder = await Order.create({
      number: `INT-REV-EXTRA-UPD-ORD-${TS}`,
      userId: buyer.id,
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      shippingFirstName: '__INT',
      shippingLastName: 'RevExtraUpd',
      shippingAddress1: '1 Rev Extra Upd St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'RevExtraUpd',
      billingAddress1: '1 Rev Extra Upd St',
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

    // Seed an initial review for the update test
    await Review.destroy({ where: { userId: buyer.id, productId: product.id }, force: true });
    const service = makeService();
    await service.createReview({
      userId: buyer.id,
      productId: product.id,
      rating: 5,
      title: '__INT max rating seed',
      comment: '__INT review seed for update test',
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

describe('Reviews extra — admin verify', () => {
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
      nameVi: `__INT_RevExtraAdm_Cat_${TS}`,
      nameEn: `__INT_RevExtraAdm_Cat_${TS}`,
      slug: `int-rev-extra-adm-cat-${TS}`,
      isActive: true,
    });
    brand = await Brand.create({
      nameVi: `__INT_RevExtraAdm_Brand_${TS}`,
      nameEn: `__INT_RevExtraAdm_Brand_${TS}`,
      slug: `int-rev-extra-adm-brand-${TS}`,
    });
    product = await Product.create({
      nameVi: `__INT_RevExtraAdm_Product_${TS}`,
      nameEn: `__INT_RevExtraAdm_Product_${TS}`,
      baseName: `__INT_RevExtraAdm_Product_${TS}`,
      slug: `int-rev-extra-adm-product-${TS}`,
      basePrice: 2_000_000,
      categoryId: cat.id,
      brandId: brand.id,
      status: 'active',
      stockQuantity: 10,
    });
    variant = await ProductVariant.create({
      productId: product.id,
      sku: `INT-REV-EXTRA-ADM-${TS}`,
      variantName: 'Default',
      price: 2_000_000,
      stockQuantity: 10,
      isDefault: true,
    });

    buyer = await User.create({
      firstName: '__INT_RevExtraAdm',
      lastName: 'Buyer',
      email: `__int_rev_extra_adm_buyer_${TS}@test.com`,
      password: 'RevExtraAdm123!',
      role: 'customer',
    });
    deliveredOrder = await Order.create({
      number: `INT-REV-EXTRA-ADM-ORD-${TS}`,
      userId: buyer.id,
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      shippingFirstName: '__INT',
      shippingLastName: 'RevExtraAdm',
      shippingAddress1: '1 Rev Extra Adm St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'RevExtraAdm',
      billingAddress1: '1 Rev Extra Adm St',
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

    // Seed a review for the admin verify test
    await Review.destroy({ where: { userId: buyer.id, productId: product.id }, force: true });
    const service = makeService();
    await service.createReview({
      userId: buyer.id,
      productId: product.id,
      rating: 3,
      title: '__INT seed for admin verify',
      comment: '__INT seed comment',
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

describe('Reviews extra — lấy danh sách theo productId', () => {
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
      nameVi: `__INT_RevExtraList_Cat_${TS}`,
      nameEn: `__INT_RevExtraList_Cat_${TS}`,
      slug: `int-rev-extra-list-cat-${TS}`,
      isActive: true,
    });
    brand = await Brand.create({
      nameVi: `__INT_RevExtraList_Brand_${TS}`,
      nameEn: `__INT_RevExtraList_Brand_${TS}`,
      slug: `int-rev-extra-list-brand-${TS}`,
    });
    product = await Product.create({
      nameVi: `__INT_RevExtraList_Product_${TS}`,
      nameEn: `__INT_RevExtraList_Product_${TS}`,
      baseName: `__INT_RevExtraList_Product_${TS}`,
      slug: `int-rev-extra-list-product-${TS}`,
      basePrice: 2_000_000,
      categoryId: cat.id,
      brandId: brand.id,
      status: 'active',
      stockQuantity: 10,
    });
    variant = await ProductVariant.create({
      productId: product.id,
      sku: `INT-REV-EXTRA-LIST-${TS}`,
      variantName: 'Default',
      price: 2_000_000,
      stockQuantity: 10,
      isDefault: true,
    });

    buyer = await User.create({
      firstName: '__INT_RevExtraList',
      lastName: 'Buyer',
      email: `__int_rev_extra_list_buyer_${TS}@test.com`,
      password: 'RevExtraList123!',
      role: 'customer',
    });
    deliveredOrder = await Order.create({
      number: `INT-REV-EXTRA-LIST-ORD-${TS}`,
      userId: buyer.id,
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      shippingFirstName: '__INT',
      shippingLastName: 'RevExtraList',
      shippingAddress1: '1 Rev Extra List St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'RevExtraList',
      billingAddress1: '1 Rev Extra List St',
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

    // Seed a review so the list test has data
    await Review.destroy({ where: { userId: buyer.id, productId: product.id }, force: true });
    const service = makeService();
    await service.createReview({
      userId: buyer.id,
      productId: product.id,
      rating: 4,
      title: '__INT seed for list test',
      comment: '__INT seed comment for list',
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

describe('Reviews edge cases — kiểm tra điều kiện đặt hàng', () => {
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
      nameVi: `__INT_RevEdgeUps_Cat_${TS}`,
      nameEn: `__INT_RevEdgeUps_Cat_${TS}`,
      slug: `int-rev-edge-ups-cat-${TS}`,
      isActive: true,
    });
    brand = await Brand.create({
      nameVi: `__INT_RevEdgeUps_Brand_${TS}`,
      nameEn: `__INT_RevEdgeUps_Brand_${TS}`,
      slug: `int-rev-edge-ups-brand-${TS}`,
    });
    product = await Product.create({
      nameVi: `__INT_RevEdgeUps_Product_${TS}`,
      nameEn: `__INT_RevEdgeUps_Product_${TS}`,
      baseName: `__INT_RevEdgeUps_Product_${TS}`,
      slug: `int-rev-edge-ups-product-${TS}`,
      basePrice: 1_500_000,
      categoryId: cat.id,
      brandId: brand.id,
      status: 'active',
      stockQuantity: 10,
    });
    variant = await ProductVariant.create({
      productId: product.id,
      sku: `INT-REV-EDGE-UPS-${TS}`,
      variantName: 'Default',
      price: 1_500_000,
      stockQuantity: 10,
      isDefault: true,
    });

    userWithPurchase = await User.create({
      firstName: '__INT_RevEdgeUps',
      lastName: 'Buyer',
      email: `__int_rev_edge_ups_buyer_${TS}@test.com`,
      password: 'RevEdgeUps123!',
      role: 'customer',
    });
    deliveredOrder = await Order.create({
      number: `INT-REV-EDGE-UPS-ORD-${TS}`,
      userId: userWithPurchase.id,
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      shippingFirstName: '__INT',
      shippingLastName: 'RevEdgeUps',
      shippingAddress1: '1 Rev Edge Ups St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'RevEdgeUps',
      billingAddress1: '1 Rev Edge Ups St',
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

    userWithoutPurchase = await User.create({
      firstName: '__INT_RevEdgeUps',
      lastName: 'NoBuyer',
      email: `__int_rev_edge_ups_nobuyer_${TS}@test.com`,
      password: 'RevEdgeUps456!',
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
      nameVi: `__INT_RevEdgeAdm_Cat_${TS}`,
      nameEn: `__INT_RevEdgeAdm_Cat_${TS}`,
      slug: `int-rev-edge-adm-cat-${TS}`,
      isActive: true,
    });
    brand = await Brand.create({
      nameVi: `__INT_RevEdgeAdm_Brand_${TS}`,
      nameEn: `__INT_RevEdgeAdm_Brand_${TS}`,
      slug: `int-rev-edge-adm-brand-${TS}`,
    });
    product = await Product.create({
      nameVi: `__INT_RevEdgeAdm_Product_${TS}`,
      nameEn: `__INT_RevEdgeAdm_Product_${TS}`,
      baseName: `__INT_RevEdgeAdm_Product_${TS}`,
      slug: `int-rev-edge-adm-product-${TS}`,
      basePrice: 1_500_000,
      categoryId: cat.id,
      brandId: brand.id,
      status: 'active',
      stockQuantity: 10,
    });
    variant = await ProductVariant.create({
      productId: product.id,
      sku: `INT-REV-EDGE-ADM-${TS}`,
      variantName: 'Default',
      price: 1_500_000,
      stockQuantity: 10,
      isDefault: true,
    });

    userWithPurchase = await User.create({
      firstName: '__INT_RevEdgeAdm',
      lastName: 'Buyer',
      email: `__int_rev_edge_adm_buyer_${TS}@test.com`,
      password: 'RevEdgeAdm123!',
      role: 'customer',
    });
    deliveredOrder = await Order.create({
      number: `INT-REV-EDGE-ADM-ORD-${TS}`,
      userId: userWithPurchase.id,
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      shippingFirstName: '__INT',
      shippingLastName: 'RevEdgeAdm',
      shippingAddress1: '1 Rev Edge Adm St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'RevEdgeAdm',
      billingAddress1: '1 Rev Edge Adm St',
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

    userWithoutPurchase = await User.create({
      firstName: '__INT_RevEdgeAdm',
      lastName: 'NoBuyer',
      email: `__int_rev_edge_adm_nobuyer_${TS}@test.com`,
      password: 'RevEdgeAdm456!',
      role: 'customer',
    });

    // Seed a review so admin verify test has data
    await Review.destroy({
      where: { userId: userWithPurchase.id, productId: product.id },
      force: true,
    });
    const service = makeService();
    await service.createReview({
      userId: userWithPurchase.id,
      productId: product.id,
      rating: 3,
      title: '__INT seed for admin verify edge',
      comment: '__INT seed comment edge',
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

// Verifies HIGH-1 (fix): concurrent createReview SELECT FOR UPDATE lock
// ngăn duplicate reviews khi 2 requests đồng thời từ cùng user+product.
// Trước fix: findReviewByUserAndProduct không có lock + không có transaction
// → 2 requests đều thấy existing=null → đều createReview → 2 duplicate records.
// Sau fix: SELECT FOR UPDATE trong transaction → serializes, request thứ 2
// chờ commit → thấy existing review → update thay vì create.
// Yêu cầu MySQL thật để verify concurrent behavior.
describe('HIGH-1 — createReview concurrent lock (requires MySQL)', () => {
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
      nameVi: `__INT_RevEdgeH1_Cat_${TS}`,
      nameEn: `__INT_RevEdgeH1_Cat_${TS}`,
      slug: `int-rev-edge-h1-cat-${TS}`,
      isActive: true,
    });
    brand = await Brand.create({
      nameVi: `__INT_RevEdgeH1_Brand_${TS}`,
      nameEn: `__INT_RevEdgeH1_Brand_${TS}`,
      slug: `int-rev-edge-h1-brand-${TS}`,
    });
    product = await Product.create({
      nameVi: `__INT_RevEdgeH1_Product_${TS}`,
      nameEn: `__INT_RevEdgeH1_Product_${TS}`,
      baseName: `__INT_RevEdgeH1_Product_${TS}`,
      slug: `int-rev-edge-h1-product-${TS}`,
      basePrice: 1_500_000,
      categoryId: cat.id,
      brandId: brand.id,
      status: 'active',
      stockQuantity: 10,
    });
    variant = await ProductVariant.create({
      productId: product.id,
      sku: `INT-REV-EDGE-H1-${TS}`,
      variantName: 'Default',
      price: 1_500_000,
      stockQuantity: 10,
      isDefault: true,
    });

    userWithPurchase = await User.create({
      firstName: '__INT_RevEdgeH1',
      lastName: 'Buyer',
      email: `__int_rev_edge_h1_buyer_${TS}@test.com`,
      password: 'RevEdgeH1123!',
      role: 'customer',
    });
    deliveredOrder = await Order.create({
      number: `INT-REV-EDGE-H1-ORD-${TS}`,
      userId: userWithPurchase.id,
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      shippingFirstName: '__INT',
      shippingLastName: 'RevEdgeH1',
      shippingAddress1: '1 Rev Edge H1 St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'RevEdgeH1',
      billingAddress1: '1 Rev Edge H1 St',
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

    userWithoutPurchase = await User.create({
      firstName: '__INT_RevEdgeH1',
      lastName: 'NoBuyer',
      email: `__int_rev_edge_h1_nobuyer_${TS}@test.com`,
      password: 'RevEdgeH1456!',
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

  test('HIGH-1: 2 concurrent createReview cùng user+product → chỉ 1 review, không duplicate', async () => {
    const service = makeService();
    const reviewData = {
      userId: userWithPurchase.id,
      productId: product.id,
      rating: 5,
      title: 'T',
      comment: 'C',
    };
    // Trigger 2 concurrent createReview với Promise.all
    await Promise.all([service.createReview(reviewData), service.createReview(reviewData)]);
    // Assert: chỉ 1 review trong DB (FAIL nếu revert fix HIGH-1)
    const reviews = await Review.findAll({
      where: { userId: userWithPurchase.id, productId: product.id },
    });
    expect(reviews).toHaveLength(1);
  });
});
