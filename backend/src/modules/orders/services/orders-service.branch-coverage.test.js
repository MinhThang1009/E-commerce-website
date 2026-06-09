jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_r, _s, n) => n(),
  apiLimiter: (_r, _s, n) => n(),
  authLimiter: (_r, _s, n) => n(),
  otpLimiter: (_r, _s, n) => n(),
}));
const logger = require('@utils/logger');
const OrdersService = require('./orders-service');

describe('OrdersService — branch coverage', () => {
  let svc, repo;
  beforeEach(() => {
    repo = {
      findVariantBasic: jest.fn(),
      findActiveCartByUserId: jest.fn(),
      findCartItemsByCartId: jest.fn(),
      lockVariantStock: jest.fn(),
      lockProductStock: jest.fn(),
      decrementVariantStock: jest.fn(),
      decrementProductStock: jest.fn(),
      incrementDiscountCodeUsage: jest.fn(),
      createOrder: jest
        .fn()
        .mockResolvedValue({
          id: 1,
          number: 'ORD-001',
          total: 100,
          status: 'pending',
          paymentStatus: 'pending',
          paymentMethod: 'cod',
        }),
      createOrderItem: jest.fn().mockResolvedValue({ id: 1 }),
      clearCartItems: jest.fn(),
      getActiveDiscountByCode: jest.fn(),
      findOrderByIdForUser: jest.fn(),
      findOrdersByUser: jest.fn(),
      findOrderByNumber: jest.fn(),
      findOrderByPkWithItemsAndUser: jest.fn(),
      cancelPendingOrdersByUser: jest.fn(),
      runInTransaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'FOR UPDATE' } })),
    };
    svc = new OrdersService({
      ordersRepository: repo,
      emailGateway: { sendOrderConfirmation: jest.fn() },
      eventBus: { publish: jest.fn() },
      logger,
      constants: {},
    });
  });

  test('getOrderById: no isThumbnail image → fallback to [0].imageUrl', async () => {
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue({
      id: 1,
      userId: 1,
      status: 'pending',
      toJSON: () => ({
        id: 1,
        userId: 1,
        status: 'pending',
        items: [
          {
            Product: {
              productImages: [
                { imageUrl: 'first.jpg', isThumbnail: false },
                { imageUrl: 'second.jpg', isThumbnail: false },
              ],
            },
          },
        ],
      }),
    });
    const result = await svc.getOrderById({ orderId: 1, userId: 1, role: 'customer' });
    expect(result.items[0].Product.thumbnail).toBe('first.jpg');
  });

  test('getOrderById: productImages empty → thumbnail null', async () => {
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue({
      id: 1,
      userId: 1,
      status: 'pending',
      toJSON: () => ({
        id: 1,
        userId: 1,
        status: 'pending',
        items: [
          {
            Product: { productImages: [] },
          },
        ],
      }),
    });
    const result = await svc.getOrderById({ orderId: 1, userId: 1, role: 'customer' });
    expect(result.items[0].Product.thumbnail).toBeNull();
  });
});
