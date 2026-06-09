/**
 * Integration tests — Orders edge cases với real DB.
 * Kiểm tra race condition stock, phân quyền userId, và validation trạng thái đơn.
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
  InventoryLog,
} = require('@models');
const { Op } = require('sequelize');

const SequelizeOrdersRepository = require('@modules/orders/repositories/sequelize-orders-repository');
const OrdersService = require('@modules/orders/services/orders-service');

const TS = Date.now();
let userA, userB, product, variant, cat, brand;

// Hằng số mặc định cho OrdersService
const CONSTANTS = {
  SHIPPING_FREE_THRESHOLD: 500_000,
  SHIPPING_BASE_RATE: 30_000,
};

function makeService() {
  const repo = new SequelizeOrdersRepository({
    Order,
    OrderItem,
    Cart: require('@models/cart'),
    CartItem: require('@models/cart-item'),
    Product,
    ProductVariant,
    User,
    DiscountCode: require('@models/discount-code'),
    InventoryLog,
    sequelize,
  });
  return new OrdersService({
    ordersRepository: repo,
    emailGateway: {
      sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
      sendOrderCancellationEmail: jest.fn().mockResolvedValue(undefined),
    },
    eventBus: { publish: jest.fn().mockResolvedValue(undefined) },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    constants: CONSTANTS,
  });
}

// Dữ liệu địa chỉ tối thiểu cho createOrder
const shippingBase = {
  shippingFirstName: '__INT',
  shippingLastName: 'EdgeOrders',
  shippingAddress1: '1 Test St',
  shippingCity: 'HCM',
  billingFirstName: '__INT',
  billingLastName: 'EdgeOrders',
  billingAddress1: '1 Test St',
  billingCity: 'HCM',
  paymentMethod: 'cod',
};

beforeAll(async () => {
  await sequelize.authenticate();

  cat = await Category.create({
    nameVi: `__INT_OrdEdge_Cat_${TS}`,
    nameEn: `__INT_OrdEdge_Cat_${TS}`,
    slug: `int-ord-edge-cat-${TS}`,
    isActive: true,
  });
  brand = await Brand.create({
    nameVi: `__INT_OrdEdge_Brand_${TS}`,
    nameEn: `__INT_OrdEdge_Brand_${TS}`,
    slug: `int-ord-edge-brand-${TS}`,
  });

  product = await Product.create({
    nameVi: `__INT_OrdEdge_Product_${TS}`,
    nameEn: `__INT_OrdEdge_Product_${TS}`,
    baseName: `__INT_OrdEdge_Product_${TS}`,
    slug: `int-ord-edge-product-${TS}`,
    basePrice: 5_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 1, // Chỉ 1 — dùng cho test concurrent
  });

  variant = await ProductVariant.create({
    productId: product.id,
    sku: `INT-ORD-EDGE-${TS}`,
    variantName: 'Only1',
    price: 5_000_000,
    stockQuantity: 1, // Chỉ 1 — dùng cho test concurrent
    isDefault: true,
  });

  userA = await User.create({
    firstName: '__INT_OrdEdge_A',
    lastName: 'User',
    email: `__int_ord_edge_a_${TS}@test.com`,
    password: 'Edge123!',
    role: 'customer',
  });
  userB = await User.create({
    firstName: '__INT_OrdEdge_B',
    lastName: 'User',
    email: `__int_ord_edge_b_${TS}@test.com`,
    password: 'Edge456!',
    role: 'customer',
  });
});

afterAll(async () => {
  await InventoryLog.destroy({
    where: {
      orderId: {
        [Op.in]: await Order.findAll({
          where: { userId: { [Op.in]: [userA?.id, userB?.id].filter(Boolean) } },
          attributes: ['id'],
        }).then((rows) => rows.map((r) => r.id)),
      },
    },
    force: true,
  }).catch(() => {}); // InventoryLog có thể không có FK-safe destroy
  await OrderItem.destroy({ where: {}, force: true });
  await Order.destroy({
    where: { userId: { [Op.in]: [userA?.id, userB?.id].filter(Boolean) } },
    force: true,
  });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
  if (userA) await userA.destroy({ force: true });
  if (userB) await userB.destroy({ force: true });
});

describe('Orders edge cases — concurrent stock', () => {
  test('2 concurrent requests từ cùng user tạo order với stock=1 → chỉ 1 thành công, stock không âm', async () => {
    // Đảm bảo variant còn đúng 1 stock trước test
    await variant.update({ stockQuantity: 1 });

    // Simulate 2 concurrent order attempts với SELECT FOR UPDATE
    const attemptOrder = (userId, orderNum) =>
      sequelize.transaction(async (t) => {
        const locked = await ProductVariant.findByPk(variant.id, {
          lock: t.LOCK.UPDATE,
          transaction: t,
        });
        if (locked.stockQuantity < 1) {
          throw new Error('OUT_OF_STOCK');
        }
        await locked.decrement('stockQuantity', { by: 1, transaction: t });
        const ord = await Order.create(
          {
            number: `INT-ORD-EDGE-CONC-${TS}-${orderNum}`,
            userId,
            status: 'pending',
            paymentMethod: 'cod',
            paymentStatus: 'pending',
            shippingFirstName: '__INT',
            shippingLastName: 'Edge',
            shippingAddress1: '1 St',
            shippingCity: 'HCM',
            billingFirstName: '__INT',
            billingLastName: 'Edge',
            billingAddress1: '1 St',
            billingCity: 'HCM',
            subtotal: 5_000_000,
            tax: 0,
            shippingCost: 30_000,
            total: 5_030_000,
          },
          { transaction: t },
        );
        await OrderItem.create(
          {
            orderId: ord.id,
            productId: product.id,
            variantId: variant.id,
            name: product.nameVi,
            unitPrice: 5_000_000,
            quantity: 1,
            subtotal: 5_000_000,
          },
          { transaction: t },
        );
        return ord;
      });

    const results = await Promise.allSettled([
      attemptOrder(userA.id, 'A'),
      attemptOrder(userA.id, 'B'),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);

    // Stock không âm — phải bằng đúng 0
    await variant.reload();
    expect(variant.stockQuantity).toBe(0);
  });
});

describe('Orders edge cases — phân quyền', () => {
  let orderForA;

  beforeAll(async () => {
    // Khôi phục stock về 1 cho tests tiếp theo
    await variant.update({ stockQuantity: 10 });

    orderForA = await Order.create({
      number: `INT-ORD-EDGE-AUTH-${TS}`,
      userId: userA.id,
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      shippingFirstName: '__INT',
      shippingLastName: 'Auth',
      shippingAddress1: '1 St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'Auth',
      billingAddress1: '1 St',
      billingCity: 'HCM',
      subtotal: 5_000_000,
      tax: 0,
      shippingCost: 30_000,
      total: 5_030_000,
    });
  });

  test('GET /orders/:id bằng userId khác → không tìm thấy hoặc 404', async () => {
    const service = makeService();
    // userB cố lấy order của userA với role customer → phải throw
    await expect(
      service.getOrderById({ id: orderForA.id, userId: userB.id, role: 'customer' }),
    ).rejects.toThrow();
  });
});

describe('Orders edge cases — validation trạng thái', () => {
  let deliveredOrder, paidOrder, cancelledOrder;

  beforeAll(async () => {
    deliveredOrder = await Order.create({
      number: `INT-ORD-EDGE-DELIV-${TS}`,
      userId: userA.id,
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      shippingFirstName: '__INT',
      shippingLastName: 'Deliv',
      shippingAddress1: '1 St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'Deliv',
      billingAddress1: '1 St',
      billingCity: 'HCM',
      subtotal: 5_000_000,
      tax: 0,
      shippingCost: 30_000,
      total: 5_030_000,
    });

    paidOrder = await Order.create({
      number: `INT-ORD-EDGE-PAID-${TS}`,
      userId: userA.id,
      status: 'processing',
      paymentMethod: 'momo',
      paymentStatus: 'paid',
      shippingFirstName: '__INT',
      shippingLastName: 'Paid',
      shippingAddress1: '1 St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'Paid',
      billingAddress1: '1 St',
      billingCity: 'HCM',
      subtotal: 5_000_000,
      tax: 0,
      shippingCost: 30_000,
      total: 5_030_000,
    });

    cancelledOrder = await Order.create({
      number: `INT-ORD-EDGE-CANCEL-${TS}`,
      userId: userA.id,
      status: 'cancelled',
      paymentMethod: 'momo',
      paymentStatus: 'pending',
      shippingFirstName: '__INT',
      shippingLastName: 'Cancel',
      shippingAddress1: '1 St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'Cancel',
      billingAddress1: '1 St',
      billingCity: 'HCM',
      subtotal: 5_000_000,
      tax: 0,
      shippingCost: 30_000,
      total: 5_030_000,
    });
  });

  test('Hủy order trạng thái delivered → throw lỗi', async () => {
    const service = makeService();
    await expect(
      service.cancelOrder({ id: deliveredOrder.id, userId: userA.id, userEmail: userA.email }),
    ).rejects.toThrow();
  });

  test('Repay order đã paid → throw lỗi', async () => {
    const service = makeService();
    // paidOrder: status=processing, paymentStatus=paid → _canRepay false (không phải pending)
    await expect(
      service.repayOrder({ id: paidOrder.id, userId: userA.id, originUrl: 'http://localhost' }),
    ).rejects.toThrow();
  });

  test('Repay order đã hủy (cancelled) → throw lỗi (cancelled là terminal)', async () => {
    const service = makeService();
    // cancelledOrder: status=cancelled → _canRepay false. Đơn đã hủy đã hoàn kho,
    // cho repay sẽ leak tồn kho → guard chặn. Test FAIL nếu revert guard về cho phép cancelled.
    await expect(
      service.repayOrder({
        id: cancelledOrder.id,
        userId: userA.id,
        originUrl: 'http://localhost',
      }),
    ).rejects.toThrow();
  });

  test('F13: updateOrderStatus delivered→cancelled → throw 400 (INV-STK-3, lấp path còn sót sau F8)', async () => {
    const service = makeService();
    await expect(
      service.updateOrderStatus({ id: deliveredOrder.id, status: 'cancelled' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    const fresh = await Order.findByPk(deliveredOrder.id);
    expect(fresh.status).toBe('delivered'); // KHÔNG bị set cancelled
  });

  test('F14: updateOrderStatus cancelled→processing → throw 422 (INV-ORD-8, cancelled terminal)', async () => {
    const service = makeService();
    await expect(
      service.updateOrderStatus({ id: cancelledOrder.id, status: 'processing' }),
    ).rejects.toMatchObject({ statusCode: 422 });
    const fresh = await Order.findByPk(cancelledOrder.id);
    expect(fresh.status).toBe('cancelled'); // KHÔNG bị hồi sinh
  });
});

// Verify logic THẬT qua service (không tautological) — bắt các bug F1/F2/F3 mà unit mock bỏ lọt.
describe('Orders edge cases — hoàn kho qua service (F1/F2/F3)', () => {
  let userC;

  beforeAll(async () => {
    userC = await User.create({
      firstName: '__INT_OrdEdge_C',
      lastName: 'User',
      email: `__int_ord_edge_c_${TS}@test.com`,
      password: 'Edge789!',
      role: 'customer',
    });
  });

  afterAll(async () => {
    await OrderItem.destroy({ where: {}, force: true });
    if (userC) await Order.destroy({ where: { userId: userC.id }, force: true });
    if (userC) await userC.destroy({ force: true });
  });

  beforeEach(async () => {
    await OrderItem.destroy({ where: {}, force: true });
    await Order.destroy({ where: { userId: userC.id }, force: true });
    await variant.update({ stockQuantity: 50 });
    await variant.reload();
  });

  const buyNowBody = (qty, extra = {}) => ({
    ...shippingBase,
    items: [{ productId: product.id, variantId: variant.id, quantity: qty }],
    ...extra,
  });

  test('F1: tạo đơn mới hủy pending cũ → HOÀN kho đơn cũ (không leak)', async () => {
    const service = makeService();
    const user = { id: userC.id, email: userC.email };

    await service.createOrder({ user, body: buyNowBody(3), sessionIdCookie: null });
    await variant.reload();
    expect(variant.stockQuantity).toBe(47); // 50 - 3

    // Đơn mới: cancelPendingOrdersByUser hủy đơn cũ + HOÀN 3 → 50, rồi trừ 2 → 48
    await service.createOrder({ user, body: buyNowBody(2), sessionIdCookie: null });
    await variant.reload();
    expect(variant.stockQuantity).toBe(48); // KHÔNG phải 45 (bug cũ leak)
  });

  test('F2: staff cancel đơn CHƯA giao (processing) → HOÀN kho', async () => {
    const service = makeService();
    const user = { id: userC.id, email: userC.email };

    const created = await service.createOrder({ user, body: buyNowBody(4), sessionIdCookie: null });
    await variant.reload();
    expect(variant.stockQuantity).toBe(46); // 50 - 4

    await service.updateOrderStatus({ id: created.id, status: 'processing' });
    await service.updateOrderStatus({ id: created.id, status: 'cancelled' });
    await variant.reload();
    expect(variant.stockQuantity).toBe(50); // hoàn đủ
  });

  test('F2: cancel đơn ĐÃ giao (shipped) → KHÔNG hoàn kho (hàng đã đi)', async () => {
    const service = makeService();
    const user = { id: userC.id, email: userC.email };

    const created = await service.createOrder({ user, body: buyNowBody(4), sessionIdCookie: null });
    await service.updateOrderStatus({ id: created.id, status: 'shipped' });
    await service.updateOrderStatus({ id: created.id, status: 'cancelled' });
    await variant.reload();
    expect(variant.stockQuantity).toBe(46); // 50 - 4, KHÔNG hoàn
  });

  test('F3: subtotal >= ngưỡng free → shippingCost = 0 dù FE gửi phí', async () => {
    const service = makeService();
    const user = { id: userC.id, email: userC.email };

    // price 5.000.000 * 1 = 5tr >= SHIPPING_FREE_THRESHOLD test (500k) → free
    const created = await service.createOrder({
      user,
      body: buyNowBody(1, { shippingCost: 99_000 }),
      sessionIdCookie: null,
    });
    const ord = await Order.findByPk(created.id);
    expect(Number(ord.shippingCost)).toBe(0);
  });

  test('F12: re-order cùng variant khi đơn pending cũ giữ unit cuối → THÀNH CÔNG (không false stockInsufficient)', async () => {
    const service = makeService();
    const user = { id: userC.id, email: userC.email };
    await variant.update({ stockQuantity: 1 });
    await variant.reload();

    // Đơn 1: lấy unit cuối → stock 1→0
    await service.createOrder({ user, body: buyNowBody(1), sessionIdCookie: null });
    await variant.reload();
    expect(variant.stockQuantity).toBe(0);

    // Đơn 2 cùng variant: cancelPending hủy đơn 1 + HOÀN 1 → 1, rồi trừ 1 → 0.
    // FAIL nếu revert F12 (cancelPending chạy SAU decrement → lockVariant thấy 0 → throw stockInsufficient SAI).
    await expect(
      service.createOrder({ user, body: buyNowBody(1), sessionIdCookie: null }),
    ).resolves.toBeDefined();
    await variant.reload();
    expect(variant.stockQuantity).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Verifies MEDIUM-1 (fix commit 073b3c3): clearCartItems phải chạy TRONG
// transaction của createOrder — nếu transaction rollback sau khi CartItems
// bị delete, items phải được khôi phục (không mất vĩnh viễn).
//
// Trước fix: clearCartItems(cartId) bỏ qua { transaction } → CartItem.destroy
// chạy ngoài transaction → rollback không khôi phục được items.
// Sau fix: CartItem.destroy nhận { transaction } → atomic với toàn bộ createOrder.
//
// Cách test: stub InventoryLog.bulkCreate để throw SAU cart clearing → trigger
// rollback → verify CartItems vẫn còn (FAIL nếu revert MEDIUM-1 fix).
// ════════════════════════════════════════════════════════════════════════════
describe('MEDIUM-1 — clearCartItems transaction atomicity (requires MySQL)', () => {
  test('MEDIUM-1: CartItems không bị xóa vĩnh viễn khi createOrder transaction rollback', async () => {
    const { Cart, CartItem } = require('@models');
    // Ensure variant có stock cho test này
    await variant.update({ stockQuantity: 50 });

    const user = await User.create({
      firstName: '__INT_M1',
      lastName: 'Atomicity',
      email: `__int_m1_${Date.now()}@t.com`,
      password: 'Test123!',
      role: 'customer',
    });
    const cart = await Cart.create({ userId: user.id, status: 'active' });
    await CartItem.create({
      cartId: cart.id,
      productId: product.id,
      variantId: variant.id,
      quantity: 1,
      unitPrice: variant.price,
    });

    // Stub InventoryLog.bulkCreate để throw SAU khi cart clearing chạy xong,
    // trigger rollback của toàn bộ createOrder transaction.
    const InventoryLogModel = require('@models/inventory-log');
    const orig = InventoryLogModel.bulkCreate.bind(InventoryLogModel);
    InventoryLogModel.bulkCreate = jest.fn().mockRejectedValue(new Error('Simulated late failure'));

    const service = makeService();
    await expect(
      service.createOrder({
        user: { id: user.id, email: user.email },
        body: {
          shippingFirstName: 'Test',
          shippingLastName: 'User',
          shippingAddress1: '1 Test St',
          shippingCity: 'HCM',
          billingFirstName: 'Test',
          billingLastName: 'User',
          billingAddress1: '1 Test St',
          billingCity: 'HCM',
          paymentMethod: 'cod', // manual → triggers _clearUserCartInTransaction
          items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
        },
        sessionIdCookie: null,
      }),
    ).rejects.toThrow('Simulated late failure');

    InventoryLogModel.bulkCreate = orig;

    // Assert: CartItems phải vẫn còn sau rollback (FAIL nếu revert fix MEDIUM-1)
    const remaining = await CartItem.findAll({ where: { cartId: cart.id } });
    expect(remaining).toHaveLength(1);

    await CartItem.destroy({ where: { cartId: cart.id }, force: true });
    await cart.destroy({ force: true });
    await user.destroy({ force: true });
  });
});
