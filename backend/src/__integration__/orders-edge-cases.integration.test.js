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
  let deliveredOrder, paidOrder;

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
  });

  test('Hủy order trạng thái delivered → throw lỗi', async () => {
    const service = makeService();
    await expect(
      service.cancelOrder({ id: deliveredOrder.id, userId: userA.id, userEmail: userA.email }),
    ).rejects.toThrow();
  });

  test('Repay order đã paid → throw lỗi', async () => {
    const service = makeService();
    // paidOrder: status=processing, paymentStatus=paid
    // _canRepay → false vì không phải pending/cancelled và paymentStatus != failed
    await expect(
      service.repayOrder({ id: paidOrder.id, userId: userA.id, originUrl: 'http://localhost' }),
    ).rejects.toThrow();
  });
});
