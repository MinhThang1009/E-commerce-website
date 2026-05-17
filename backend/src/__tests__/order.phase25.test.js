/**
 * Tests Phase 25 — Order Creation Business Logic
 *
 * Bao gồm:
 * - Out-of-stock: variant hết hàng → 400 với message chứa tồn kho thực tế
 * - Invalid discount code → 400
 * - Expired discount code → 400
 * - Min order amount không đủ → 400
 * - Max usages vượt giới hạn → 400
 * - Tạo đơn hàng COD thành công → 201
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-phase25';

// ---------- Mutable mock state ----------

let mockProductFindByPkImpl = jest.fn();
let mockVariantFindByPkImpl = jest.fn();
let mockDiscountFindOneImpl = jest.fn();

// ---------- Mocks ----------

jest.mock('../services/email', () => ({
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../modules/ai/services/vectorStore', () => ({
  upsertProduct: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../utils/productHelpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(0),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-TEST'),
}));

jest.mock('../middlewares/rateLimiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'customer' };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('../middlewares/adminAuth', () => ({
  adminAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('../shared/adminAudit', () => ({
  AdminAuditService: { logAction: jest.fn(), logSuccessfulLogin: jest.fn() },
  auditMiddleware: (_req, _res, next) => next(),
}));

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('../config/sequelize', () => ({
  define: jest.fn().mockReturnValue(class MockModel {}),
  fn: jest.fn(),
  col: jest.fn(),
  where: jest.fn(),
  literal: jest.fn(),
  query: jest.fn().mockResolvedValue([]),
  // callback form (không dùng trong order.js nhưng cần cho các middleware khác)
  transaction: jest.fn().mockImplementation(async (cb) => {
    if (typeof cb === 'function') {
      const t = { LOCK: { UPDATE: 'UPDATE' } };
      return cb(t);
    }
    return {
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
  }),
}));

// Mock models với transaction dạng non-callback (createOrder dùng await sequelize.transaction())
jest.mock('../models', () => {
  const sequelizePkg = require('sequelize');

  const mockTx = {
    LOCK: { UPDATE: 'UPDATE' },
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
  };

  return {
    Order: {
      findByPk: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 100,
        number: 'ORD-TEST-001',
        status: 'pending',
        total: 200000,
        createdAt: new Date(),
      }),
      update: jest.fn().mockResolvedValue([0]),
      findAll: jest.fn().mockResolvedValue([]),
    },
    OrderItem: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
    Product: {
      findByPk: jest.fn().mockImplementation((...args) => mockProductFindByPkImpl(...args)),
      findAll: jest.fn().mockResolvedValue([]),
    },
    ProductVariant: {
      findByPk: jest.fn().mockImplementation((...args) => mockVariantFindByPkImpl(...args)),
      decrement: jest.fn().mockResolvedValue(undefined),
    },
    Cart: {
      findOrCreate: jest.fn().mockResolvedValue([{ id: 1 }, true]),
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(null),
    },
    CartItem: {
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      destroy: jest.fn().mockResolvedValue(1),
    },
    DiscountCode: {
      findOne: jest.fn().mockImplementation((...args) => mockDiscountFindOneImpl(...args)),
      update: jest.fn().mockResolvedValue([1]),
    },
    LoyaltyHistory: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue([1]),
    },
    InventoryLog: {
      create: jest.fn().mockResolvedValue({}),
      bulkCreate: jest.fn().mockResolvedValue([]),
    },
    WarrantyPackage: {
      findAll: jest.fn().mockResolvedValue([]),
    },
    User: {
      findByPk: jest.fn().mockResolvedValue({
        id: 1,
        loyaltyPoints: 0,
        update: jest.fn().mockResolvedValue(undefined),
      }),
    },
    Review: { findAll: jest.fn().mockResolvedValue([]) },
    Category: { findAll: jest.fn().mockResolvedValue([]) },
    sequelize: {
      // Phase 42 modules/orders dùng callback form: sequelize.transaction(async (tx) => {...})
      transaction: jest.fn().mockImplementation(async (cb) => {
        return typeof cb === 'function' ? cb(mockTx) : mockTx;
      }),
      fn: jest.fn(),
      col: jest.fn(),
      where: jest.fn(),
      literal: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      Sequelize: { fn: jest.fn(), col: jest.fn() },
    },
    Op: sequelizePkg.Op,
  };
});

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const buildOrdersModule = require('../modules/orders/module');
const {
  Order,
  OrderItem,
  Cart,
  CartItem,
  Product,
  ProductVariant,
  User,
  DiscountCode,
  LoyaltyHistory,
  InventoryLog,
  WarrantyPackage,
  sequelize,
} = require('../models');
const eventBus = require('../shared/eventBus');
const logger = require('../utils/logger');
const emailService = require('../services/email');
const constants = require('../constants');
const { errorHandler } = require('../middlewares/errorHandler');

const ordersModule = buildOrdersModule({
  Order,
  OrderItem,
  Cart,
  CartItem,
  Product,
  ProductVariant,
  User,
  DiscountCode,
  LoyaltyHistory,
  InventoryLog,
  WarrantyPackage,
  sequelize,
  eventBus,
  logger,
  emailService,
  constants,
});

const app = express();
app.use(express.json());
// Khởi tạo req.cookies = {} để createOrder không throw TypeError khi đọc sessionId từ cookie
app.use((req, _res, next) => {
  req.cookies = {};
  next();
});
app.use('/api/orders', ordersModule.router);
app.use(errorHandler);
const request = supertest(app);

// ---------- Base request body (đủ trường theo createOrderSchema) ----------

const BASE_ORDER_BODY = {
  shippingFirstName: 'Minh',
  shippingLastName: 'Thang',
  shippingAddress1: '123 Đường Test, Quận 1',
  shippingCity: 'TP. Hồ Chí Minh',
  shippingState: 'TP. Hồ Chí Minh',
  billingFirstName: 'Minh',
  billingLastName: 'Thang',
  billingAddress1: '123 Đường Test, Quận 1',
  billingCity: 'TP. Hồ Chí Minh',
  billingState: 'TP. Hồ Chí Minh',
  paymentMethod: 'cod',
};

// Sản phẩm mẫu có status active
const ACTIVE_PRODUCT = {
  id: 1,
  name: 'iPhone Test',
  status: 'active',
  basePrice: 500000,
  slug: 'iphone-test',
  thumbnail: null,
  sku: null,
};

// ============================================================
// 1. Out-of-stock — variant hết hàng → 400
// ============================================================

describe('POST /api/orders — out-of-stock scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Khôi phục mock transaction non-callback cho mỗi test
    const { sequelize } = require('../models');
    const mockTx = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    sequelize.transaction.mockImplementation(async (cb) =>
      typeof cb === 'function' ? cb(mockTx) : mockTx,
    );
  });

  test('Variant stockQuantity = 0 → 400 với message tồn kho', async () => {
    // Tìm sản phẩm thành công
    mockProductFindByPkImpl.mockResolvedValue(ACTIVE_PRODUCT);
    // Lần 1: tìm variant theo variantId (item lookup)
    // Lần 2: tìm variant với lock (kiểm tra tồn kho)
    mockVariantFindByPkImpl
      .mockResolvedValueOnce({ id: 1, name: 'Đỏ', price: 100000, stockQuantity: 0, sku: 'V-001' })
      .mockResolvedValueOnce({ id: 1, stockQuantity: 0 });

    const res = await request
      .post('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .send({
        ...BASE_ORDER_BODY,
        items: [{ productId: 1, variantId: 1, quantity: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/chỉ còn 0 sản phẩm/);
  });

  test('Variant stockQuantity = 1 nhưng yêu cầu quantity = 5 → 400', async () => {
    mockProductFindByPkImpl.mockResolvedValue(ACTIVE_PRODUCT);
    mockVariantFindByPkImpl
      .mockResolvedValueOnce({ id: 2, name: 'Xanh', price: 200000, stockQuantity: 1, sku: 'V-002' })
      .mockResolvedValueOnce({ id: 2, stockQuantity: 1 });

    const res = await request
      .post('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .send({
        ...BASE_ORDER_BODY,
        items: [{ productId: 1, variantId: 2, quantity: 5 }],
      });

    expect(res.status).toBe(400);
    // Message phải thể hiện tồn kho thực tế (1, không đủ 5)
    expect(res.body.message).toMatch(/chỉ còn 1 sản phẩm/);
  });

  test('Sản phẩm không tồn tại → 404', async () => {
    mockProductFindByPkImpl.mockResolvedValue(null);

    const res = await request
      .post('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .send({
        ...BASE_ORDER_BODY,
        items: [{ productId: 999, variantId: 1, quantity: 1 }],
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Không tìm thấy sản phẩm/);
  });
});

// ============================================================
// 2. Discount code validation → 400
// ============================================================

describe('POST /api/orders — discount code validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { sequelize } = require('../models');
    const mockTx = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    sequelize.transaction.mockImplementation(async (cb) =>
      typeof cb === 'function' ? cb(mockTx) : mockTx,
    );

    // Variant đủ hàng (5 items); lockedVariant cần có decrement()
    mockProductFindByPkImpl.mockResolvedValue(ACTIVE_PRODUCT);
    mockVariantFindByPkImpl
      .mockResolvedValueOnce({ id: 1, name: 'Đỏ', price: 500000, stockQuantity: 5, sku: 'V-001' })
      .mockResolvedValueOnce({
        id: 1,
        stockQuantity: 5,
        decrement: jest.fn().mockResolvedValue(undefined),
      });
  });

  test('Mã giảm giá không tồn tại → 400', async () => {
    mockDiscountFindOneImpl.mockResolvedValue(null);

    const res = await request
      .post('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .send({
        ...BASE_ORDER_BODY,
        items: [{ productId: 1, variantId: 1, quantity: 1 }],
        discountCode: 'INVALID123',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Mã giảm giá không hợp lệ/);
  });

  test('Mã giảm giá đã hết hạn → 400', async () => {
    mockDiscountFindOneImpl.mockResolvedValue({
      id: 1,
      code: 'EXPIRED50',
      isActive: true,
      startDate: null,
      endDate: new Date('2020-01-01'), // đã qua
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: 0,
      type: 'percent',
      value: 50,
      maxDiscountAmount: null,
      increment: jest.fn().mockResolvedValue(undefined),
    });

    const res = await request
      .post('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .send({
        ...BASE_ORDER_BODY,
        items: [{ productId: 1, variantId: 1, quantity: 1 }],
        discountCode: 'EXPIRED50',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/đã hết hạn/);
  });

  test('Đơn hàng chưa đạt giá trị tối thiểu của mã giảm giá → 400', async () => {
    mockDiscountFindOneImpl.mockResolvedValue({
      id: 2,
      code: 'BIGORDER',
      isActive: true,
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: 5000000, // tối thiểu 5 triệu
      type: 'fixed',
      value: 100000,
      maxDiscountAmount: null,
      increment: jest.fn().mockResolvedValue(undefined),
    });

    const res = await request
      .post('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .send({
        ...BASE_ORDER_BODY,
        items: [{ productId: 1, variantId: 1, quantity: 1 }], // subtotal = 500000 < 5000000
        discountCode: 'BIGORDER',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tối thiểu/);
  });

  test('Mã giảm giá đã đạt giới hạn lượt sử dụng → 400', async () => {
    mockDiscountFindOneImpl.mockResolvedValue({
      id: 3,
      code: 'LIMITED10',
      isActive: true,
      startDate: null,
      endDate: null,
      usageLimit: 10,
      usedCount: 10, // đã dùng đủ 10 lần
      minOrderAmount: 0,
      type: 'fixed',
      value: 50000,
      maxDiscountAmount: null,
      increment: jest.fn().mockResolvedValue(undefined),
    });

    const res = await request
      .post('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .send({
        ...BASE_ORDER_BODY,
        items: [{ productId: 1, variantId: 1, quantity: 1 }],
        discountCode: 'LIMITED10',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/giới hạn lượt sử dụng/);
  });
});

// ============================================================
// 3. Happy path — COD order thành công → 201
// ============================================================

describe('POST /api/orders — happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { sequelize } = require('../models');
    const mockTx = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    sequelize.transaction.mockImplementation(async (cb) =>
      typeof cb === 'function' ? cb(mockTx) : mockTx,
    );
  });

  test('Đặt hàng COD thành công với variant đủ hàng → 201', async () => {
    mockProductFindByPkImpl.mockResolvedValue(ACTIVE_PRODUCT);
    // Lần 1: item lookup; lần 2: lockedVariant cần có decrement()
    mockVariantFindByPkImpl
      .mockResolvedValueOnce({
        id: 1,
        name: 'Đỏ',
        price: 500000,
        stockQuantity: 10,
        sku: 'V-001',
        weight: null,
      })
      .mockResolvedValueOnce({
        id: 1,
        stockQuantity: 10,
        weight: null,
        decrement: jest.fn().mockResolvedValue(undefined),
      });
    mockDiscountFindOneImpl.mockResolvedValue(null); // không dùng discount

    const { Order, OrderItem, InventoryLog, Cart } = require('../models');
    Order.create.mockResolvedValue({
      id: 100,
      number: 'ORD-2605-TEST',
      status: 'pending',
      total: 530000, // 500000 + 30000 phí ship
      createdAt: new Date(),
    });
    OrderItem.create.mockResolvedValue({ id: 1, name: 'iPhone Test' });
    InventoryLog.bulkCreate.mockResolvedValue([]);
    Cart.findAll.mockResolvedValue([]); // clearUserCart

    const res = await request
      .post('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .send({
        ...BASE_ORDER_BODY,
        items: [{ productId: 1, variantId: 1, quantity: 1 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.order).toHaveProperty('number');
    expect(res.body.data.order.number).toMatch(/ORD/);
  });

  test('Validation: thiếu shippingFirstName → 400', async () => {
    const { shippingFirstName: _, ...bodyWithout } = BASE_ORDER_BODY;

    const res = await request
      .post('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .send({ ...bodyWithout, items: [{ productId: 1, variantId: 1, quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Tên người nhận/);
  });
});

// ============================================================
// 4. Cart-based flow — đặt hàng từ giỏ hàng (không truyền items)
// ============================================================

describe('POST /api/orders — cart-based flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { sequelize } = require('../models');
    const mockTx = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    sequelize.transaction.mockImplementation(async (cb) =>
      typeof cb === 'function' ? cb(mockTx) : mockTx,
    );
  });

  test('Đặt hàng từ giỏ hàng (không truyền items) — cart có 1 item đủ hàng → 201', async () => {
    const { Cart, Order, OrderItem, InventoryLog } = require('../models');

    const mockCartItem = {
      productId: 1,
      variantId: 1,
      quantity: 2,
      warrantyPackageIds: [],
      Product: {
        id: 1,
        name: 'Laptop',
        status: 'active',
        basePrice: 800000,
        slug: 'laptop',
        thumbnail: null,
        sku: null,
      },
      ProductVariant: {
        id: 1,
        name: 'Xám',
        price: 750000,
        stockQuantity: 5,
        sku: 'V-GRAY',
        weight: null,
      },
    };

    // Cart.findOrCreate: trả về [cart, created]
    Cart.findOrCreate.mockResolvedValue([{ id: 20 }, false]);

    // Cart.findByPk với include items: trả về cart có items
    Cart.findByPk.mockResolvedValue({
      id: 20,
      items: [mockCartItem],
    });

    // lockedVariant (có decrement)
    mockVariantFindByPkImpl.mockResolvedValue({
      id: 1,
      stockQuantity: 5,
      weight: null,
      decrement: jest.fn().mockResolvedValue(undefined),
    });

    Order.update.mockResolvedValue([0]);
    Order.create.mockResolvedValue({
      id: 200,
      number: 'ORD-CART-TEST',
      status: 'pending',
      total: 1530000,
      createdAt: new Date(),
    });
    OrderItem.create.mockResolvedValue({ id: 2 });
    InventoryLog.bulkCreate.mockResolvedValue([]);
    Cart.findAll.mockResolvedValue([]); // clearUserCart

    const res = await request
      .post('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .send(BASE_ORDER_BODY); // KHÔNG truyền items — sẽ lấy từ giỏ hàng

    expect(res.status).toBe(201);
    expect(res.body.data.order.number).toBe('ORD-CART-TEST');
  });

  test('Giỏ hàng trống → 400', async () => {
    const { Cart } = require('../models');

    Cart.findOrCreate.mockResolvedValue([{ id: 21 }, false]);
    // Cart findByPk trả về cart với items rỗng
    Cart.findByPk.mockResolvedValue({ id: 21, items: [] });

    const res = await request
      .post('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .send(BASE_ORDER_BODY);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/trống/);
  });

  test('COD order: clearUserCart được gọi sau khi tạo đơn → cart bị đánh dấu converted', async () => {
    const { Cart, Order, OrderItem, InventoryLog, CartItem } = require('../models');

    Cart.findOrCreate.mockResolvedValue([{ id: 22 }, false]);
    Cart.findByPk.mockResolvedValue({
      id: 22,
      items: [
        {
          productId: 1,
          variantId: 1,
          quantity: 1,
          warrantyPackageIds: [],
          Product: {
            id: 1,
            name: 'Phone',
            status: 'active',
            basePrice: 2500000,
            slug: 'phone',
            thumbnail: null,
            sku: null,
          },
          ProductVariant: {
            id: 1,
            name: 'Đen',
            price: 2500000,
            stockQuantity: 3,
            sku: 'V-BLK',
            weight: null,
          },
        },
      ],
    });

    mockVariantFindByPkImpl.mockResolvedValue({
      id: 1,
      stockQuantity: 3,
      weight: null,
      decrement: jest.fn().mockResolvedValue(undefined),
    });

    Order.update.mockResolvedValue([0]);
    Order.create.mockResolvedValue({
      id: 300,
      number: 'ORD-CLEAR-TEST',
      status: 'pending',
      total: 2500000,
      createdAt: new Date(),
    });
    OrderItem.create.mockResolvedValue({ id: 3 });
    InventoryLog.bulkCreate.mockResolvedValue([]);

    // clearUserCart: có 1 giỏ hàng đang hoạt động → phải set status converted và save + destroy items
    // Phase 42 modules/orders dùng cart.status = 'converted' + cart.save() (thay vì update)
    const mockActiveCart = {
      id: 22,
      status: 'active',
      save: jest.fn().mockResolvedValue(undefined),
    };
    Cart.findAll.mockResolvedValue([mockActiveCart]);
    CartItem.destroy.mockResolvedValue(1);

    const res = await request
      .post('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .send(BASE_ORDER_BODY);

    expect(res.status).toBe(201);
    // clearUserCart phải đánh dấu giỏ hàng là 'converted' (qua mutation + save)
    expect(mockActiveCart.save).toHaveBeenCalled();
    expect(mockActiveCart.status).toBe('converted');
    expect(CartItem.destroy).toHaveBeenCalled();
  });
});
