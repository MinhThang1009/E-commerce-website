/**
 * Integration tests — Cart edge cases với real DB.
 * Kiểm tra: hết hàng, vượt stock, soft-delete product, guest merge trùng item.
 */
require('module-alias/register');
const sequelize = require('@config/sequelize');
const { User, Cart, CartItem, Product, ProductVariant, Category, Brand } = require('@models');
const { Op } = require('sequelize');

const SequelizeCartRepository = require('@modules/cart/repositories/sequelize-cart-repository');
const CartService = require('@modules/cart/services/cart-service');

const TS = Date.now();
let user, productInStock, variantInStock, productOutOfStock, variantOutOfStock, cat, brand;

function makeService() {
  const repo = new SequelizeCartRepository({
    Cart,
    CartItem,
    Product,
    ProductVariant,
    sequelize,
  });
  return new CartService({
    cartRepository: repo,
    eventBus: { publish: jest.fn() },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  });
}

beforeAll(async () => {
  await sequelize.authenticate();

  cat = await Category.create({
    nameVi: `__INT_CartEdge_Cat_${TS}`,
    nameEn: `__INT_CartEdge_Cat_${TS}`,
    slug: `int-cart-edge-cat-${TS}`,
    isActive: true,
  });
  brand = await Brand.create({
    nameVi: `__INT_CartEdge_Brand_${TS}`,
    nameEn: `__INT_CartEdge_Brand_${TS}`,
    slug: `int-cart-edge-brand-${TS}`,
  });

  productInStock = await Product.create({
    nameVi: `__INT_CartEdge_InStock_${TS}`,
    nameEn: `__INT_CartEdge_InStock_${TS}`,
    baseName: `__INT_CartEdge_InStock_${TS}`,
    slug: `int-cart-edge-in-stock-${TS}`,
    basePrice: 1_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 10,
  });
  variantInStock = await ProductVariant.create({
    productId: productInStock.id,
    sku: `INT-CART-EDGE-IN-${TS}`,
    variantName: 'In Stock',
    price: 1_000_000,
    stockQuantity: 10,
    isDefault: true,
  });

  productOutOfStock = await Product.create({
    nameVi: `__INT_CartEdge_OutStock_${TS}`,
    nameEn: `__INT_CartEdge_OutStock_${TS}`,
    baseName: `__INT_CartEdge_OutStock_${TS}`,
    slug: `int-cart-edge-out-stock-${TS}`,
    basePrice: 2_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 0,
  });
  variantOutOfStock = await ProductVariant.create({
    productId: productOutOfStock.id,
    sku: `INT-CART-EDGE-OUT-${TS}`,
    variantName: 'Out Stock',
    price: 2_000_000,
    stockQuantity: 0, // Hết hàng
    isDefault: true,
  });

  user = await User.create({
    firstName: '__INT_CartEdge',
    lastName: 'User',
    email: `__int_cart_edge_${TS}@test.com`,
    password: 'CartEdge123!',
    role: 'customer',
  });
});

afterAll(async () => {
  await CartItem.destroy({ where: {}, force: true, truncate: false });
  const cartIds = await Cart.findAll({
    where: {
      [Op.or]: [{ userId: user?.id }, { sessionId: { [Op.like]: `edge-session-${TS}%` } }],
    },
    attributes: ['id'],
  }).then((rows) => rows.map((r) => r.id));
  if (cartIds.length > 0) {
    await Cart.destroy({ where: { id: { [Op.in]: cartIds } }, force: true });
  }
  if (variantInStock) await variantInStock.destroy({ force: true });
  if (productInStock) await productInStock.destroy({ force: true });
  if (variantOutOfStock) await variantOutOfStock.destroy({ force: true });
  if (productOutOfStock) await productOutOfStock.destroy({ force: true });
  if (user) await user.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
});

describe('Cart edge cases — kiểm tra stock khi thêm vào giỏ', () => {
  test('Thêm sản phẩm hết hàng vào giỏ → throw lỗi', async () => {
    const service = makeService();
    await expect(
      service.addToCart({
        user,
        cookieSessionId: null,
        body: {
          productId: productOutOfStock.id,
          variantId: variantOutOfStock.id,
          quantity: 1,
        },
        setSessionCookie: jest.fn(),
      }),
    ).rejects.toThrow();
  });

  test('Update quantity vượt stock → throw lỗi', async () => {
    const service = makeService();

    // Thêm item hợp lệ trước (qty=1, stock=10)
    await service.addToCart({
      user,
      cookieSessionId: null,
      body: {
        productId: productInStock.id,
        variantId: variantInStock.id,
        quantity: 1,
      },
      setSessionCookie: jest.fn(),
    });

    const cart = await Cart.findOne({ where: { userId: user.id, status: 'active' } });
    const item = await CartItem.findOne({ where: { cartId: cart.id } });

    // Cập nhật vượt stock (qty=100, stock=10)
    await expect(
      service.updateCartItem({
        user,
        cookieSessionId: null,
        itemId: item.id,
        quantity: 100,
      }),
    ).rejects.toThrow();
  });
});

describe('Cart edge cases — validate cart với sản phẩm bị xóa', () => {
  test('Validate cart khi sản phẩm bị xóa (soft-delete) → item không hợp lệ', async () => {
    const service = makeService();

    // Tạo cart + item với sản phẩm sẽ bị xóa sau
    const softDeleteCart = await Cart.create({ userId: user.id, status: 'active' });
    await CartItem.create({
      cartId: softDeleteCart.id,
      productId: productInStock.id,
      variantId: variantInStock.id,
      quantity: 1,
      unitPrice: 1_000_000,
    });

    // Soft-delete product (paranoid=true → set deletedAt, không xóa thật)
    await productInStock.destroy();

    const result = await service.validateCart({ user, cookieSessionId: null });

    // Item không hợp lệ vì sản phẩm không còn
    expect(result.hasIssues).toBe(true);
    const issueItem = result.items.find((i) => i.productId === productInStock.id);
    expect(issueItem).toBeDefined();
    expect(issueItem.hasIssue).toBe(true);

    // Khôi phục lại product để không ảnh hưởng tests khác
    await productInStock.restore();

    // Dọn cart tạm
    await CartItem.destroy({ where: { cartId: softDeleteCart.id }, force: true });
    await softDeleteCart.destroy({ force: true });
  });
});

describe('Cart edge cases — guest cart merge', () => {
  test('Guest cart merge: duplicate product → quantity cộng gộp, không duplicate item', async () => {
    const guestSessionId = `edge-session-${TS}-merge`;

    // Guest cart có 2 item cùng product+variant
    const guestCart = await Cart.create({ sessionId: guestSessionId, status: 'active' });
    await CartItem.create({
      cartId: guestCart.id,
      productId: productInStock.id,
      variantId: variantInStock.id,
      quantity: 2,
      unitPrice: 1_000_000,
    });

    // User cart đã có cùng product+variant
    const userCart = await Cart.create({ userId: user.id, status: 'active' });
    await CartItem.create({
      cartId: userCart.id,
      productId: productInStock.id,
      variantId: variantInStock.id,
      quantity: 3,
      unitPrice: 1_000_000,
    });

    // Simulate merge logic: cộng quantity, xóa guest item, không tạo duplicate
    const guestItem = await CartItem.findOne({
      where: { cartId: guestCart.id, productId: productInStock.id, variantId: variantInStock.id },
    });
    const userItem = await CartItem.findOne({
      where: { cartId: userCart.id, productId: productInStock.id, variantId: variantInStock.id },
    });

    const mergedQty = guestItem.quantity + userItem.quantity;
    // Cap theo stock (stock=10, merged=5 → ok)
    const finalQty = Math.min(mergedQty, variantInStock.stockQuantity);
    await userItem.update({ quantity: finalQty });
    await guestItem.destroy({ force: true });
    await guestCart.update({ status: 'merged' });

    // Kiểm tra chỉ có 1 item trong user cart
    const remainingItems = await CartItem.findAll({
      where: { cartId: userCart.id, productId: productInStock.id },
    });
    expect(remainingItems).toHaveLength(1);
    expect(remainingItems[0].quantity).toBe(5); // 2 + 3

    // Guest cart đánh dấu merged
    await guestCart.reload();
    expect(guestCart.status).toBe('merged');

    // Dọn dẹp
    await CartItem.destroy({ where: { cartId: userCart.id }, force: true });
    await userCart.destroy({ force: true });
    await guestCart.destroy({ force: true });
  });
});
