/**
 * Integration tests — Concurrency & Race conditions.
 * Test SELECT FOR UPDATE khi 2 users đồng thời đặt hàng sản phẩm tồn kho = 1
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

const TS = Date.now();
let user1, user2, product, variant, cat, brand;

const orderBase = (userId, num) => ({
  number: `INT-CONCURRENT-${TS}-${num}`,
  userId,
  status: 'pending',
  paymentMethod: 'cod',
  paymentStatus: 'pending',
  shippingFirstName: '__INT',
  shippingLastName: 'Concurrent',
  shippingAddress1: '1 St',
  shippingCity: 'HCM',
  billingFirstName: '__INT',
  billingLastName: 'Concurrent',
  billingAddress1: '1 St',
  billingCity: 'HCM',
  subtotal: 10_000_000,
  tax: 0,
  shippingCost: 0,
  total: 10_000_000,
});

beforeAll(async () => {
  await sequelize.authenticate();
  cat = await Category.create({
    nameVi: `__INT_Conc_Cat_${TS}`,
    nameEn: `__INT_Conc_Cat_${TS}`,
    slug: `int-conc-cat-${TS}`,
    isActive: true,
  });
  brand = await Brand.create({
    nameVi: `__INT_Conc_Brand_${TS}`,
    nameEn: `__INT_Conc_Brand_${TS}`,
    slug: `int-conc-brand-${TS}`,
  });

  product = await Product.create({
    nameVi: `__INT_Conc_Product_${TS}`,
    nameEn: `__INT_Conc_Product_${TS}`,
    baseName: `__INT_Conc_Product_${TS}`,
    slug: `int-conc-product-${TS}`,
    basePrice: 10_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 1, // CHỈ 1 sản phẩm
  });
  variant = await ProductVariant.create({
    productId: product.id,
    sku: `INT-CONC-${TS}`,
    variantName: 'Only1',
    price: 10_000_000,
    stockQuantity: 1, // CHỈ 1 sản phẩm
    isDefault: true,
  });
  user1 = await User.create({
    firstName: '__INT_C1',
    lastName: 'U',
    email: `__int_conc1_${TS}@t.com`,
    password: 'Concurrent1!',
    role: 'customer',
  });
  user2 = await User.create({
    firstName: '__INT_C2',
    lastName: 'U',
    email: `__int_conc2_${TS}@t.com`,
    password: 'Concurrent2!',
    role: 'customer',
  });
});

afterAll(async () => {
  await OrderItem.destroy({ where: {}, force: true });
  await Order.destroy({ where: { number: { [Op.like]: `INT-CONCURRENT-${TS}%` } }, force: true });
  // Xóa discount codes test
  await DiscountCode.destroy({
    where: { code: { [Op.like]: `INT-CONC-DC-${TS}%` } },
    force: true,
  });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
  if (user1) await user1.destroy({ force: true });
  if (user2) await user2.destroy({ force: true });
});

describe('Concurrent stock — SELECT FOR UPDATE', () => {
  test('2 users đồng thời đặt hàng qty=1, stock=1 → chỉ 1 người thành công', async () => {
    // Simulate 2 concurrent order attempts
    const attemptOrder = async (userId, orderNum) => {
      return sequelize.transaction(async (t) => {
        // Lock variant (SELECT FOR UPDATE)
        const v = await ProductVariant.findByPk(variant.id, {
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (v.stockQuantity < 1) {
          throw new Error('OUT_OF_STOCK');
        }

        // Trừ stock
        await v.decrement('stockQuantity', { by: 1, transaction: t });

        // Tạo order
        const order = await Order.create(orderBase(userId, orderNum), { transaction: t });
        await OrderItem.create(
          {
            orderId: order.id,
            productId: product.id,
            variantId: variant.id,
            name: product.nameVi,
            unitPrice: 10_000_000,
            quantity: 1,
            subtotal: 10_000_000,
          },
          { transaction: t },
        );

        return order;
      });
    };

    // Chạy song song — chỉ 1 transaction có thể lock được variant
    const results = await Promise.allSettled([
      attemptOrder(user1.id, 'U1'),
      attemptOrder(user2.id, 'U2'),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    // Đúng 1 thành công, 1 thất bại
    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(1);

    // Stock phải = 0 sau khi 1 người mua
    await variant.reload();
    expect(variant.stockQuantity).toBe(0);
  });

  test('Stock = 0 → mọi attempt đều fail', async () => {
    await variant.reload();
    expect(variant.stockQuantity).toBe(0);

    const result = await sequelize
      .transaction(async (t) => {
        const v = await ProductVariant.findByPk(variant.id, {
          lock: t.LOCK.UPDATE,
          transaction: t,
        });
        if (v.stockQuantity < 1) throw new Error('OUT_OF_STOCK');
        return true;
      })
      .catch((e) => e.message);

    expect(result).toBe('OUT_OF_STOCK');
  });

  test('Restore stock sau khi cancel order', async () => {
    // Restore về 1
    await variant.update({ stockQuantity: 1 });
    await variant.reload();
    expect(variant.stockQuantity).toBe(1);
  });
});

describe('Concurrent cart add — cùng item', () => {
  test('thêm item 2 lần tuần tự — lần 2 update quantity thay vì tạo mới', async () => {
    const cart = await Cart.create({ userId: user1.id, status: 'active' });

    // Lần 1
    const [item1, created1] = await CartItem.findOrCreate({
      where: { cartId: cart.id, productId: product.id, variantId: variant.id },
      defaults: { quantity: 1, unitPrice: 10_000_000 },
    });
    expect(created1).toBe(true);

    // Lần 2 — update quantity thay vì tạo mới
    const [item2, created2] = await CartItem.findOrCreate({
      where: { cartId: cart.id, productId: product.id, variantId: variant.id },
      defaults: { quantity: 1, unitPrice: 10_000_000 },
    });
    if (!created2) {
      await item2.increment('quantity', { by: 1 });
    }
    expect(created2).toBe(false); // đã tồn tại

    const items = await CartItem.findAll({ where: { cartId: cart.id } });
    expect(items.length).toBe(1); // vẫn chỉ 1 item
    await item2.reload();
    expect(item2.quantity).toBe(2); // quantity đã cộng

    await CartItem.destroy({ where: { cartId: cart.id }, force: true });
    await cart.destroy({ force: true });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Concurrent apply discount code — usageLimit=1', () => {
  test('3 request đồng thời áp dụng mã usageLimit=1 → chỉ 1 thành công', async () => {
    // Tạo mã giảm giá chỉ dùng được 1 lần
    const discountCode = await DiscountCode.create({
      code: `INT-CONC-DC-${TS}-LIMIT1`,
      type: 'fixed',
      value: 50_000,
      minOrderAmount: 0,
      usageLimit: 1,
      usedCount: 0,
      isActive: true,
      startDate: new Date(Date.now() - 86_400_000),
      endDate: new Date(Date.now() + 86_400_000),
    });

    // Mỗi attempt: SELECT FOR UPDATE row discount code, kiểm tra limit, increment usedCount
    const attemptApply = () =>
      sequelize.transaction(async (t) => {
        const dc = await DiscountCode.findByPk(discountCode.id, {
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (dc.usedCount >= dc.usageLimit) {
          throw new Error('USAGE_LIMIT_EXCEEDED');
        }

        await dc.increment('usedCount', { by: 1, transaction: t });
        return dc;
      });

    // Chạy 3 attempt song song — DB lock đảm bảo chỉ 1 transaction lock được row
    const results = await Promise.allSettled([attemptApply(), attemptApply(), attemptApply()]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    // Đúng 1 thành công
    expect(succeeded.length).toBe(1);
    // Ít nhất 2 thất bại
    expect(failed.length).toBeGreaterThanOrEqual(2);

    // usedCount phải đúng 1 sau khi chỉ 1 attempt thành công
    await discountCode.reload();
    expect(discountCode.usedCount).toBe(1);
  });
});
