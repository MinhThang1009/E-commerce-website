/**
 * Tests Phase 25 — Cart Business Logic
 *
 * Bao gồm:
 * - POST /api/cart — thêm item mới vào giỏ → 200
 * - POST /api/cart — thêm item trùng (duplicate) → quantity cộng dồn → 200
 * - POST /api/cart — thêm item khi hết hàng → 400
 * - POST /api/cart — sản phẩm không tồn tại → 404
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-phase25-cart';

// ---------- Mutable mock state ----------

const mockProductFindByPkImpl = jest.fn();
const mockVariantFindOneImpl = jest.fn();
const mockCartItemFindOneImpl = jest.fn();

// ---------- Mocks ----------

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'customer' };
    next();
  },
  optionalAuthenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'customer' };
    next();
  },
}));

jest.mock('@middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('@middlewares/admin-auth', () => ({
  adminAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('@shared/admin-audit', () => ({
  AdminAuditService: { logAction: jest.fn(), logSuccessfulLogin: jest.fn() },
  auditMiddleware: (_req, _res, next) => next(),
}));

jest.mock('@config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  }),
}));

jest.mock('@config/sequelize', () => ({
  define: jest.fn().mockReturnValue(class MockModel {}),
  fn: jest.fn(),
  col: jest.fn(),
  where: jest.fn(),
  literal: jest.fn(),
  query: jest.fn().mockResolvedValue([]),
}));

jest.mock('@services/email', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@services/vector-store/vector-store', () => ({
  upsertProduct: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@utils/product-helpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(10),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-TEST'),
}));

jest.mock('@models', () => {
  const sequelizePkg = require('sequelize');

  const mockTx = {
    LOCK: { UPDATE: 'UPDATE' },
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
  };

  const mockCartItemUpdate = jest.fn().mockResolvedValue(undefined);

  return {
    Product: {
      findByPk: jest.fn().mockImplementation((...args) => mockProductFindByPkImpl(...args)),
      findAll: jest.fn().mockResolvedValue([]),
    },
    ProductVariant: {
      findOne: jest.fn().mockImplementation((...args) => mockVariantFindOneImpl(...args)),
      findAll: jest.fn().mockResolvedValue([]),
    },
    Cart: {
      findOrCreate: jest.fn().mockResolvedValue([{ id: 10 }, true]),
      findOne: jest.fn().mockResolvedValue(null),
      findByPk: jest.fn().mockResolvedValue(null),
    },
    CartItem: {
      findOne: jest.fn().mockImplementation((...args) => mockCartItemFindOneImpl(...args)),
      findAll: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockResolvedValue({ id: 1, cartId: 10, productId: 1, variantId: null, quantity: 2 }),
    },
    WarrantyPackage: {
      findAll: jest.fn().mockResolvedValue([]),
    },
    User: {
      findByPk: jest.fn().mockResolvedValue({ id: 1 }),
    },
    Order: {
      findAll: jest.fn().mockResolvedValue([]),
    },
    OrderItem: { findAll: jest.fn().mockResolvedValue([]) },
    Review: { findAll: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    ProductAttribute: { findAll: jest.fn().mockResolvedValue([]) },
    ProductSpecification: { findAll: jest.fn().mockResolvedValue([]) },
    ProductImage: { findAll: jest.fn().mockResolvedValue([]) },
    LoyaltyHistory: { create: jest.fn().mockResolvedValue({}) },
    InventoryLog: { create: jest.fn().mockResolvedValue({}) },
    SearchHistory: { findAll: jest.fn().mockResolvedValue([]) },
    Category: { findAll: jest.fn().mockResolvedValue([]) },
    sequelize: {
      // Phase 42 modules/cart dùng callback form: sequelize.transaction(async (tx) => {...})
      // Mock hỗ trợ cả callback (module) lẫn non-callback (legacy fallback)
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
    mockCartItemUpdate, // expose để verify trong test
  };
});

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const buildCartModule = require('@modules/cart/module');
const { Cart, CartItem, Product, ProductVariant, WarrantyPackage, sequelize } = require('@models');
const eventBus = require('@shared/event-bus');
const logger = require('@utils/logger');
const { errorHandler } = require('@middlewares/error-handler');

const cartModule = buildCartModule({
  Cart,
  CartItem,
  Product,
  ProductVariant,
  WarrantyPackage,
  sequelize,
  eventBus,
  logger,
});

const app = express();
app.use(express.json());
// Khởi tạo req.cookies = {} để cart controller không throw TypeError khi đọc sessionId
app.use((req, _res, next) => {
  req.cookies = {};
  next();
});
app.use('/api/cart', cartModule.router);
app.use(errorHandler);
const request = supertest(app);

// ---------- Fixtures ----------

const PRODUCT_IN_STOCK = {
  id: 1,
  name: 'Laptop Test',
  status: 'active',
  basePrice: 10000000,
  stockQuantity: 10,
  slug: 'laptop-test',
  toJSON: jest.fn().mockReturnThis(),
  defaultVariant: { stockQuantity: 10 },
};

const PRODUCT_OUT_OF_STOCK = {
  id: 2,
  name: 'Máy tính hết hàng',
  status: 'active',
  basePrice: 5000000,
  stockQuantity: 0,
  slug: 'may-tinh-het-hang',
  toJSON: jest.fn().mockReturnThis(),
  defaultVariant: { stockQuantity: 0 },
};

// ============================================================
// POST /api/cart — thêm item vào giỏ
// ============================================================

describe('POST /api/cart — thêm sản phẩm vào giỏ hàng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Khôi phục mock transaction (cả callback lẫn non-callback)
    const freshTx = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    sequelize.transaction.mockImplementation(async (cb) => {
      return typeof cb === 'function' ? cb(freshTx) : freshTx;
    });
  });

  test('Thêm item mới vào giỏ thành công → CartItem.create được gọi', async () => {
    mockProductFindByPkImpl.mockResolvedValue(PRODUCT_IN_STOCK);
    mockVariantFindOneImpl.mockResolvedValue(null); // không có variant
    // Chưa có item trùng trong giỏ
    mockCartItemFindOneImpl.mockResolvedValue(null);

    CartItem.create.mockResolvedValue({
      id: 1,
      quantity: 2,
      productId: 1,
      variantId: null,
      cartId: 10,
    });

    const res = await request
      .post('/api/cart')
      .set('Authorization', 'Bearer test-token')
      .send({ productId: 1, quantity: 2 });

    // CartItem.create phải được gọi vì chưa có item này trong giỏ
    expect(CartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 1, quantity: 2 }),
      expect.anything(),
    );
    // addToCart sau thành công sẽ gọi getCart → 200
    expect([200, 201]).toContain(res.status);
  });

  test('Thêm item trùng vào giỏ → quantity cộng dồn (update thay vì create)', async () => {
    mockProductFindByPkImpl.mockResolvedValue(PRODUCT_IN_STOCK);
    mockVariantFindOneImpl.mockResolvedValue(null);

    const existingItem = {
      id: 5,
      cartId: 10,
      productId: 1,
      variantId: null,
      quantity: 3, // đã có 3 items
      // Phase 42 modules/cart dùng item.save() thay vì item.update() để cập nhật
      save: jest.fn().mockResolvedValue(undefined),
    };
    // Đã có item trong giỏ
    mockCartItemFindOneImpl.mockResolvedValue(existingItem);

    const res = await request
      .post('/api/cart')
      .set('Authorization', 'Bearer test-token')
      .send({ productId: 1, quantity: 2 });

    // Phải cập nhật quantity 3+2=5 (qua mutation + save), KHÔNG tạo mới
    expect(existingItem.save).toHaveBeenCalled();
    expect(existingItem.quantity).toBe(5); // 3 + 2 = 5
    expect(CartItem.create).not.toHaveBeenCalled();
    expect([200, 201]).toContain(res.status);
  });

  test('Sản phẩm không tồn tại → 404', async () => {
    mockProductFindByPkImpl.mockResolvedValue(null);

    const res = await request
      .post('/api/cart')
      .set('Authorization', 'Bearer test-token')
      .send({ productId: 999, quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/không tồn tại/);
  });

  test('Sản phẩm hết hàng (không có variantId) → 400', async () => {
    mockProductFindByPkImpl.mockResolvedValue(PRODUCT_OUT_OF_STOCK);

    const res = await request
      .post('/api/cart')
      .set('Authorization', 'Bearer test-token')
      .send({ productId: 2, quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hết hàng/);
  });

  test('Số lượng yêu cầu vượt tồn kho → 400', async () => {
    mockProductFindByPkImpl.mockResolvedValue({
      ...PRODUCT_IN_STOCK,
      stockQuantity: 2,
      defaultVariant: { stockQuantity: 2 },
    });
    mockVariantFindOneImpl.mockResolvedValue(null);
    mockCartItemFindOneImpl.mockResolvedValue(null);

    const res = await request
      .post('/api/cart')
      .set('Authorization', 'Bearer test-token')
      .send({ productId: 1, quantity: 99 }); // yêu cầu 99, tồn kho chỉ 2

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tồn kho/);
  });
});
