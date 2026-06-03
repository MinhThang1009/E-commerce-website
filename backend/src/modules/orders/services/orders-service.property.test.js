/**
 * @file orders-service.property.test.js
 * @layer Test (property-based)
 * @description Property test cho createOrder (buy-now flow) — kiểm INVARIANT tiền đơn hàng
 *   với HÀNG NGÀN tổ hợp giá/SL/discount/shipping random (fast-check). Oracle độc lập =
 *   công thức nghiệp vụ, so với `total` RAW do service tính & truyền vào repo.createOrder.
 *   Map invariants.ecommerce.md (GATE-A):
 *     INV-MON-1: total = Σ(price×qty) − discount + shippingCost (tax=0)
 *     INV-MON-2: subtotal ≥ SHIPPING_FREE_THRESHOLD → shippingCost = 0 (server enforce)
 *     INV-MON-3: subtotal < ngưỡng → shippingCost = clamp(FE, ≥0)
 *     INV-DSC (cap): discount ≤ subtotal → total ≥ 0
 */
const fc = require('fast-check');

const OrdersService = require('./orders-service');

const THRESHOLD = 500000;
const CONSTANTS = { SHIPPING_FREE_THRESHOLD: THRESHOLD, SHIPPING_BASE_RATE: 30000 };

// Harness buy-now: 1 product không variant, kho vô hạn để không bao giờ thiếu hàng.
function buildService() {
  const repo = {
    runInTransaction: jest.fn(async (work) => work({ LOCK: { UPDATE: 'FOR UPDATE' } })),
    findProductWithDefaultVariant: jest.fn(),
    findVariantBasic: jest.fn(),
    lockProduct: jest.fn(),
    lockVariant: jest.fn(),
    decrementProductStock: jest.fn().mockResolvedValue(),
    decrementVariantStock: jest.fn().mockResolvedValue(),
    findActiveCartBySessionId: jest.fn().mockResolvedValue(null),
    cancelPendingOrdersByUser: jest.fn().mockResolvedValue(),
    findActiveDiscountCode: jest.fn().mockResolvedValue(null),
    incrementDiscountCodeUsage: jest.fn().mockResolvedValue(),
    createOrder: jest.fn((data) => ({ ...data, id: 1 })),
    createOrderItem: jest.fn((data) => data), // trả data để map productId/quantity (event + email) không crash
    createInventoryLogs: jest.fn().mockResolvedValue(),
    clearCartItems: jest.fn().mockResolvedValue(),
  };
  const emailGateway = {
    sendOrderConfirmationEmail: jest.fn().mockResolvedValue(),
    sendOrderCancellationEmail: jest.fn().mockResolvedValue(),
    sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(),
  };
  const eventBus = { publish: jest.fn().mockResolvedValue() };
  const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
  const service = new OrdersService({
    ordersRepository: repo,
    emailGateway,
    eventBus,
    logger,
    constants: CONSTANTS,
  });
  return { service, repo };
}

function mkBody(overrides = {}) {
  return {
    shippingFirstName: 'A',
    shippingLastName: 'B',
    shippingAddress1: 'x',
    shippingCity: 'HCM',
    shippingZip: '70000',
    shippingCountry: 'VN',
    shippingPhone: '0900000000',
    billingFirstName: 'A',
    billingLastName: 'B',
    billingAddress1: 'x',
    billingCity: 'HCM',
    billingZip: '70000',
    billingCountry: 'VN',
    billingPhone: '0900000000',
    // momo (online): total tính y hệt manual nhưng skip _clearUserCartInTransaction → mock gọn
    paymentMethod: 'momo',
    notes: null,
    discountCode: null,
    ...overrides,
  };
}

// Phí ship server enforce: ≥ngưỡng → 0; còn lại = clamp(FE, ≥0)
function expectedShipping(subtotal, feShipping) {
  if (subtotal >= THRESHOLD) return 0;
  return feShipping < 0 ? 0 : feShipping;
}

async function runCreateOrder({ price, quantity, feShipping, discountCode = null }) {
  const { service, repo } = buildService();
  repo.findProductWithDefaultVariant.mockResolvedValue({
    id: 1,
    name: 'P',
    status: 'active',
    basePrice: price,
    stockQuantity: 1e9,
  });
  repo.lockProduct.mockResolvedValue({ id: 1, stockQuantity: 1e9 });
  if (discountCode) repo.findActiveDiscountCode.mockResolvedValue(discountCode);

  await service.createOrder({
    user: { id: 1 },
    body: mkBody({
      items: [{ productId: 1, quantity }],
      shippingCost: feShipping,
      discountCode: discountCode ? 'C' : null,
    }),
    sessionIdCookie: null,
  });
  return repo.createOrder.mock.calls[0][0]; // orderData truyền vào repo.createOrder
}

describe('createOrder — property invariants tiền đơn (INV-MON-1/2/3, INV-DSC)', () => {
  it('không discount: total = subtotal + shippingCost(enforced), total ≥ 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 50_000_000 }), // basePrice
        fc.integer({ min: 1, max: 99 }), // quantity
        fc.integer({ min: -1_000_000, max: 2_000_000 }), // feShipping (gồm âm để test clamp)
        async (price, quantity, feShipping) => {
          const order = await runCreateOrder({ price, quantity, feShipping });
          const subtotal = price * quantity;
          const ship = expectedShipping(subtotal, feShipping);

          expect(order.subtotal).toBe(subtotal);
          expect(order.shippingCost).toBe(ship);
          expect(order.discount).toBe(0);
          expect(order.total).toBe(subtotal + ship); // INV-MON-1 (tax=0, discount=0)
          expect(order.total).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('fixed discount: total = subtotal + ship − min(value, subtotal); discount cap → total ≥ ship ≥ 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50_000_000 }), // basePrice
        fc.integer({ min: 1, max: 99 }), // quantity
        fc.integer({ min: -1_000_000, max: 2_000_000 }), // feShipping
        fc.integer({ min: 0, max: 100_000_000 }), // discount value (có thể > subtotal → cap)
        async (price, quantity, feShipping, value) => {
          const code = {
            id: 'd1',
            code: 'C',
            type: 'fixed',
            value,
            minOrderAmount: 0,
            maxDiscountAmount: null,
            usageLimit: null,
            usedCount: 0,
            startDate: null,
            endDate: null,
          };
          const order = await runCreateOrder({ price, quantity, feShipping, discountCode: code });
          const subtotal = price * quantity;
          const ship = expectedShipping(subtotal, feShipping);
          const expectedDiscount = Math.min(value, subtotal); // INV-DSC cap

          expect(order.discount).toBe(expectedDiscount);
          expect(order.total).toBe(subtotal + ship - expectedDiscount); // INV-MON-1
          expect(order.total).toBeGreaterThanOrEqual(ship); // discount không ăn vào phí ship
          expect(order.total).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('percent discount: discount = min(subtotal×value/100, subtotal); total ≥ 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50_000_000 }), // basePrice
        fc.integer({ min: 1, max: 99 }), // quantity
        fc.integer({ min: 1, max: 100 }), // percent value
        async (price, quantity, value) => {
          const code = {
            id: 'd2',
            code: 'C',
            type: 'percent',
            value,
            minOrderAmount: 0,
            maxDiscountAmount: null,
            usageLimit: null,
            usedCount: 0,
            startDate: null,
            endDate: null,
          };
          const order = await runCreateOrder({
            price,
            quantity,
            feShipping: 0,
            discountCode: code,
          });
          const subtotal = price * quantity;
          let expectedDiscount = (subtotal * value) / 100;
          if (expectedDiscount > subtotal) expectedDiscount = subtotal;

          expect(order.discount).toBe(expectedDiscount);
          expect(order.total).toBe(subtotal - expectedDiscount); // ship=0 (feShipping=0)
          expect(order.total).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 300 },
    );
  });
});
