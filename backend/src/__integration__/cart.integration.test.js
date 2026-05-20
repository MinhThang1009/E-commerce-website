require('module-alias/register');
const sequelize = require('@config/sequelize');
const { User, Cart, CartItem, Product, ProductVariant, Category, Brand } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user, product, variant, guestCart, userCart;

beforeAll(async () => {
  await sequelize.authenticate();

  const cat = await Category.create({
    nameVi: `__INT_Cart_Cat_${TS}`,
    nameEn: `__INT_Cart_Cat_${TS}`,
    slug: `int-cart-cat-${TS}`,
    isActive: true,
  });
  const brand = await Brand.create({
    nameVi: `__INT_Cart_Brand_${TS}`,
    nameEn: `__INT_Cart_Brand_${TS}`,
    slug: `int-cart-brand-${TS}`,
  });

  product = await Product.create({
    nameVi: `__INT_Cart_Product_${TS}`,
    nameEn: `__INT_Cart_Product_${TS}`,
    baseName: `__INT_Cart_Product_${TS}`,
    slug: `int-cart-product-${TS}`,
    basePrice: 500_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 100,
  });

  variant = await ProductVariant.create({
    productId: product.id,
    sku: `INT-CART-${TS}`,
    variantName: 'Standard',
    price: 500_000,
    stockQuantity: 100,
    isDefault: true,
  });

  user = await User.create({
    firstName: '__INT_Cart',
    lastName: 'User',
    email: `__int_cart_${TS}@test.com`,
    password: 'Cart123!',
    role: 'customer',
  });
});

afterAll(async () => {
  await CartItem.destroy({ where: {}, force: true, truncate: false });
  // chỉ xóa cart của session này
  const carts = await Cart.findAll({
    where: { [Op.or]: [{ userId: user?.id }, { sessionId: `guest-${TS}` }] },
  });
  for (const c of carts) await c.destroy({ force: true });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (user) await user.destroy({ force: true });
});

describe('Cart Integration', () => {
  test('Tạo guest cart với sessionId', async () => {
    guestCart = await Cart.create({ sessionId: `guest-${TS}`, status: 'active' });
    expect(guestCart.id).toBeDefined();
    expect(guestCart.userId).toBeFalsy();
  });

  test('Add item vào guest cart', async () => {
    await CartItem.create({
      cartId: guestCart.id,
      productId: product.id,
      variantId: variant.id,
      quantity: 2,
      unitPrice: 500_000,
    });
    const items = await CartItem.findAll({ where: { cartId: guestCart.id } });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  test('Tạo user cart', async () => {
    userCart = await Cart.create({ userId: user.id, status: 'active' });
    expect(userCart.userId).toBe(user.id);
    expect(userCart.sessionId).toBeFalsy();
  });

  test('Merge: cộng quantity khi trùng productId+variantId', async () => {
    // user cart đã có 1 item cùng variant
    await CartItem.create({
      cartId: userCart.id,
      productId: product.id,
      variantId: variant.id,
      quantity: 3,
      unitPrice: 500_000,
    });

    // Merge logic: cộng quantity
    const guestItem = await CartItem.findOne({
      where: { cartId: guestCart.id, productId: product.id, variantId: variant.id },
    });
    const userItem = await CartItem.findOne({
      where: { cartId: userCart.id, productId: product.id, variantId: variant.id },
    });

    const newQty = guestItem.quantity + userItem.quantity;
    await userItem.update({ quantity: newQty });
    await guestItem.destroy({ force: true });

    const merged = await CartItem.findOne({
      where: { cartId: userCart.id, productId: product.id },
    });
    expect(merged.quantity).toBe(5); // 2 + 3
  });

  test('Mark guest cart status=merged', async () => {
    await guestCart.update({ status: 'merged' });
    await guestCart.reload();
    expect(guestCart.status).toBe('merged');
  });

  test('Update quantity item', async () => {
    const item = await CartItem.findOne({ where: { cartId: userCart.id } });
    await item.update({ quantity: 10 });
    await item.reload();
    expect(item.quantity).toBe(10);
  });

  test('Clear cart — xóa tất cả items', async () => {
    await CartItem.destroy({ where: { cartId: userCart.id }, force: true });
    const remaining = await CartItem.findAll({ where: { cartId: userCart.id } });
    expect(remaining).toHaveLength(0);
  });
});
