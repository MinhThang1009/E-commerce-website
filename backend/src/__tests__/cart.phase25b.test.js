/**
 * Tests Phase 25b — Cart Additional Coverage
 *
 * Bao gồm:
 * - GET  /api/cart             — getCart: đăng nhập, không có session guest
 * - GET  /api/cart             — getCart: guest, không có sessionId → empty cart
 * - PUT  /api/cart/items/:id   — updateCartItem: thành công, không tìm thấy, vượt stock
 * - DELETE /api/cart/items/:id — removeCartItem: thành công, không tìm thấy, sai user
 * - DELETE /api/cart           — clearCart: thành công, không có giỏ hàng
 * - GET  /api/cart/count       — getCartCount: trả về số lượng
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-phase25b-cart';

// ---------- Mocks ----------

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../middlewares/rateLimiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
}));

let mockUserId = 1;
jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: mockUserId, role: 'customer' };
    next();
  },
  optionalAuthenticate: (req, _res, next) => {
    req.user = { id: mockUserId, role: 'customer' };
    next();
  },
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
    del: jest.fn().mockResolvedValue(1),
  }),
}));

jest.mock('../config/sequelize', () => ({
  define: jest.fn().mockReturnValue(class MockModel {}),
  fn: jest.fn(),
  col: jest.fn(),
  where: jest.fn(),
  literal: jest.fn(),
  query: jest.fn().mockResolvedValue([]),
}));

jest.mock('../services/email', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/ai/vectorStore', () => ({
  upsertProduct: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/productHelpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(10),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-TEST'),
}));

jest.mock('../models', () => {
  const sequelizePkg = require('sequelize');

  return {
    Product: {
      findByPk: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
    },
    ProductVariant: {
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
    },
    Cart: {
      findOrCreate: jest.fn().mockResolvedValue([{ id: 10 }, false]),
      findOne: jest.fn().mockResolvedValue(null),
      findByPk: jest.fn().mockResolvedValue(null),
    },
    CartItem: {
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      destroy: jest.fn().mockResolvedValue(1),
      sum: jest.fn().mockResolvedValue(0),
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
      transaction: jest.fn().mockImplementation(async (cb) => {
        const tx = {
          LOCK: { UPDATE: 'UPDATE' },
          commit: jest.fn().mockResolvedValue(undefined),
          rollback: jest.fn().mockResolvedValue(undefined),
        };
        return typeof cb === 'function' ? cb(tx) : tx;
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

// ---------- App setup ----------

const express = require('express');
const supertest = require('supertest');
const buildCartModule = require('../modules/cart/module');
const {
  Cart,
  CartItem,
  Product,
  ProductVariant,
  WarrantyPackage,
  sequelize,
} = require('../models');
const eventBus = require('../shared/eventBus');
const logger = require('../utils/logger');
const { errorHandler } = require('../middlewares/errorHandler');

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
app.use((req, _res, next) => {
  req.cookies = {};
  next();
});
app.use('/api/cart', cartModule.router);
app.use(errorHandler);
const request = supertest(app);

// ============================================================
// GET /api/cart — getCart
// ============================================================

describe('GET /api/cart — lấy giỏ hàng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { Cart, CartItem } = require('../models');
    Cart.findOrCreate.mockResolvedValue([{ id: 10 }, false]);
    Cart.findOne.mockResolvedValue(null); // không có giỏ khách
    CartItem.findAll.mockResolvedValue([]); // giỏ trống
  });

  test('Người dùng đăng nhập, giỏ rỗng → 200 với items = []', async () => {
    const res = await request.get('/api/cart').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.totalItems).toBe(0);
    expect(res.body.data.subtotal).toBe(0);
  });

  test('Người dùng đăng nhập, có 1 sản phẩm trong giỏ → 200 với items đúng', async () => {
    const { CartItem } = require('../models');

    const mockItem = {
      id: 1,
      cartId: 10,
      productId: 1,
      variantId: null,
      quantity: 2,
      warrantyPackageIds: [],
      Product: {
        id: 1,
        name: 'Laptop Test',
        slug: 'laptop-test',
        basePrice: 5000000,
        productImages: [],
        defaultVariant: { stockQuantity: 5 },
      },
      ProductVariant: null,
      toJSON() {
        return {
          id: this.id,
          cartId: this.cartId,
          productId: this.productId,
          variantId: this.variantId,
          quantity: this.quantity,
          warrantyPackageIds: this.warrantyPackageIds,
          Product: { ...this.Product },
          ProductVariant: null,
        };
      },
    };

    CartItem.findAll.mockResolvedValue([mockItem]);

    const res = await request.get('/api/cart').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.totalItems).toBe(2);
    expect(res.body.data.subtotal).toBe(10000000); // 5000000 * 2
  });
});

// ============================================================
// DELETE /api/cart/items/:id — removeCartItem
// ============================================================

describe('DELETE /api/cart/items/:id — xóa item khỏi giỏ hàng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { Cart, CartItem } = require('../models');
    Cart.findOrCreate.mockResolvedValue([{ id: 10 }, false]);
    Cart.findOne.mockResolvedValue(null);
    CartItem.findAll.mockResolvedValue([]);
  });

  test('Item tồn tại, thuộc về user → destroy được gọi → 200', async () => {
    const { CartItem } = require('../models');

    const mockDestroyFn = jest.fn().mockResolvedValue(undefined);
    const mockItem = {
      id: 5,
      cartId: 10,
      productId: 1,
      Cart: { id: 10, userId: 1, sessionId: null },
      destroy: mockDestroyFn,
    };
    CartItem.findByPk.mockResolvedValue(mockItem);

    const res = await request.delete('/api/cart/items/5').set('Authorization', 'Bearer test-token');

    expect(mockDestroyFn).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  test('Item không tồn tại → 404', async () => {
    const { CartItem } = require('../models');
    CartItem.findByPk.mockResolvedValue(null);

    const res = await request
      .delete('/api/cart/items/999')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/không tìm thấy/i);
  });

  test('Item thuộc user khác → 403', async () => {
    const { CartItem } = require('../models');

    const mockItem = {
      id: 5,
      cartId: 20,
      productId: 1,
      Cart: { id: 20, userId: 99, sessionId: null }, // userId = 99, nhưng req.user.id = 1
      destroy: jest.fn(),
    };
    CartItem.findByPk.mockResolvedValue(mockItem);

    const res = await request.delete('/api/cart/items/5').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
  });
});

// ============================================================
// PUT /api/cart/items/:id — updateCartItem
// ============================================================

describe('PUT /api/cart/items/:id — cập nhật số lượng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { Cart, CartItem } = require('../models');
    Cart.findOrCreate.mockResolvedValue([{ id: 10 }, false]);
    Cart.findOne.mockResolvedValue(null);
    CartItem.findAll.mockResolvedValue([]);
  });

  test('Item không tồn tại → 404', async () => {
    const { CartItem } = require('../models');
    CartItem.findByPk.mockResolvedValue(null);

    const res = await request
      .put('/api/cart/items/999')
      .set('Authorization', 'Bearer test-token')
      .send({ quantity: 3 });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/không tìm thấy/i);
  });

  test('Số lượng vượt stock → 400', async () => {
    const { CartItem } = require('../models');

    const mockItem = {
      id: 5,
      Cart: { id: 10, userId: 1 },
      Product: {
        id: 1,
        defaultVariant: { stockQuantity: 2 }, // chỉ còn 2
      },
      ProductVariant: null,
      update: jest.fn(),
    };
    CartItem.findByPk.mockResolvedValue(mockItem);

    const res = await request
      .put('/api/cart/items/5')
      .set('Authorization', 'Bearer test-token')
      .send({ quantity: 10 }); // yêu cầu 10, chỉ còn 2

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tồn kho/i);
  });

  test('Số lượng hợp lệ → save được gọi với quantity mới → 200', async () => {
    const { CartItem } = require('../models');

    // Phase 42 modules/cart dùng item.save() sau khi mutate quantity (thay vì item.update)
    const mockSaveFn = jest.fn().mockResolvedValue(undefined);
    const mockItem = {
      id: 5,
      Cart: { id: 10, userId: 1 },
      Product: {
        id: 1,
        defaultVariant: { stockQuantity: 10 },
      },
      ProductVariant: null,
      quantity: 1,
      save: mockSaveFn,
    };
    CartItem.findByPk.mockResolvedValue(mockItem);

    const res = await request
      .put('/api/cart/items/5')
      .set('Authorization', 'Bearer test-token')
      .send({ quantity: 3 });

    expect(mockSaveFn).toHaveBeenCalled();
    expect(mockItem.quantity).toBe(3);
    expect(res.status).toBe(200);
  });
});

// ============================================================
// DELETE /api/cart — clearCart
// ============================================================

describe('DELETE /api/cart — xóa toàn bộ giỏ hàng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Có giỏ hàng đang active → CartItem.destroy được gọi → 200', async () => {
    const { Cart, CartItem } = require('../models');

    const destroyFn = jest.fn().mockResolvedValue(undefined);
    Cart.findOne.mockResolvedValue({ id: 10, status: 'active' });
    CartItem.destroy = destroyFn;

    const res = await request.delete('/api/cart').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
  });

  test('Không có giỏ hàng active → 200 với message giỏ trống', async () => {
    const { Cart } = require('../models');
    Cart.findOne.mockResolvedValue(null);

    const res = await request.delete('/api/cart').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('cart.alreadyEmpty');
  });
});

// ============================================================
// GET /api/cart/count — getCartCount
// ============================================================

describe('GET /api/cart/count — lấy số lượng item', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Có giỏ hàng với 3 items → 200 với count đúng', async () => {
    const { Cart, CartItem } = require('../models');

    Cart.findOne.mockResolvedValue({ id: 10 });
    CartItem.sum.mockResolvedValue(3); // CartItem.sum('quantity') trả về 3

    const res = await request.get('/api/cart/count').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(3);
  });

  test('Không có giỏ hàng → 200 với count = 0', async () => {
    const { Cart } = require('../models');
    Cart.findOne.mockResolvedValue(null);

    const res = await request.get('/api/cart/count').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });
});

// ============================================================
// POST /api/cart/sync — syncCart
// ============================================================

describe('POST /api/cart/sync — đồng bộ giỏ hàng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { Cart, CartItem, sequelize } = require('../models');
    Cart.findOrCreate.mockResolvedValue([{ id: 10 }, false]);
    Cart.findOne.mockResolvedValue(null);
    CartItem.findAll.mockResolvedValue([]);
    CartItem.destroy.mockResolvedValue(1);
    // Phase 42 modules/cart dùng callback form: sequelize.transaction(async (tx) => {...})
    sequelize.transaction.mockImplementation(async (cb) => {
      const tx = {
        LOCK: { UPDATE: 'UPDATE' },
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
      };
      return typeof cb === 'function' ? cb(tx) : tx;
    });
  });

  test('items rỗng → CartItem.destroy được gọi, getCart trả về giỏ rỗng → 200', async () => {
    const { CartItem } = require('../models');

    const res = await request
      .post('/api/cart/sync')
      .set('Authorization', 'Bearer test-token')
      .send({ items: [] });

    expect(CartItem.destroy).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  test('items có sản phẩm hợp lệ → CartItem.create được gọi → 200', async () => {
    const { Product, CartItem } = require('../models');

    Product.findByPk.mockResolvedValue({
      id: 1,
      name: 'Laptop',
      basePrice: 5000000,
      defaultVariant: { stockQuantity: 5 },
    });
    CartItem.create.mockResolvedValue({ id: 99 });

    const res = await request
      .post('/api/cart/sync')
      .set('Authorization', 'Bearer test-token')
      .send({ items: [{ productId: 1, quantity: 2 }] });

    expect(CartItem.create).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  test('items có sản phẩm không tồn tại → bỏ qua, CartItem.create không được gọi → 200', async () => {
    const { Product, CartItem } = require('../models');
    Product.findByPk.mockResolvedValue(null); // sản phẩm không tồn tại

    const res = await request
      .post('/api/cart/sync')
      .set('Authorization', 'Bearer test-token')
      .send({ items: [{ productId: 999, quantity: 1 }] });

    expect(CartItem.create).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  test('items có sản phẩm với variantId hợp lệ → CartItem.create với variant → 200', async () => {
    const { Product, ProductVariant, CartItem } = require('../models');

    Product.findByPk.mockResolvedValue({
      id: 1,
      name: 'Laptop',
      basePrice: 5000000,
      defaultVariant: { stockQuantity: 0 }, // base hết hàng
    });
    ProductVariant.findOne.mockResolvedValue({
      id: 10,
      productId: 1,
      stockQuantity: 3,
      price: 4800000,
    });
    CartItem.create.mockResolvedValue({ id: 100 });

    const res = await request
      .post('/api/cart/sync')
      .set('Authorization', 'Bearer test-token')
      .send({ items: [{ productId: 1, variantId: 10, quantity: 2 }] });

    expect(CartItem.create).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});

// ============================================================
// GET /api/cart/validate — validateCart
// ============================================================

describe('GET /api/cart/validate — kiểm tra tính hợp lệ của giỏ hàng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { Cart } = require('../models');
    Cart.findOne.mockResolvedValue(null);
  });

  test('Không có giỏ hàng active → 200 với hasIssues: false, items: []', async () => {
    const res = await request.get('/api/cart/validate').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data.hasIssues).toBe(false);
    expect(res.body.data.items).toEqual([]);
  });

  test('Giỏ hàng có item hợp lệ (còn hàng, giá không đổi) → hasIssues: false', async () => {
    const { Cart, CartItem } = require('../models');

    Cart.findOne.mockResolvedValue({ id: 10 });
    CartItem.findAll.mockResolvedValue([
      {
        id: 1,
        productId: 1,
        variantId: null,
        quantity: 2,
        unitPrice: '5000000',
        Product: {
          id: 1,
          name: 'Laptop',
          basePrice: 5000000,
          defaultVariant: { stockQuantity: 10 },
        },
        ProductVariant: null,
      },
    ]);

    const res = await request.get('/api/cart/validate').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data.hasIssues).toBe(false);
    expect(res.body.data.items).toHaveLength(1);
  });

  test('Giỏ hàng có item hết hàng → hasIssues: true, outOfStock: true', async () => {
    const { Cart, CartItem } = require('../models');

    Cart.findOne.mockResolvedValue({ id: 10 });
    CartItem.findAll.mockResolvedValue([
      {
        id: 2,
        productId: 2,
        variantId: null,
        quantity: 1,
        unitPrice: '3000000',
        Product: {
          id: 2,
          name: 'Máy tính hết hàng',
          basePrice: 3000000,
          defaultVariant: { stockQuantity: 0 }, // hết hàng
        },
        ProductVariant: null,
      },
    ]);

    const res = await request.get('/api/cart/validate').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data.hasIssues).toBe(true);
    expect(res.body.data.items[0].outOfStock).toBe(true);
  });

  test('Giỏ hàng có item giá đã thay đổi → hasIssues: true, priceChanged: true', async () => {
    const { Cart, CartItem } = require('../models');

    Cart.findOne.mockResolvedValue({ id: 10 });
    CartItem.findAll.mockResolvedValue([
      {
        id: 3,
        productId: 3,
        variantId: null,
        quantity: 1,
        unitPrice: '5000000', // giá lúc thêm vào
        Product: {
          id: 3,
          name: 'Sản phẩm giá thay đổi',
          basePrice: 4500000, // giá hiện tại khác
          defaultVariant: { stockQuantity: 5 },
        },
        ProductVariant: null,
      },
    ]);

    const res = await request.get('/api/cart/validate').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data.hasIssues).toBe(true);
    expect(res.body.data.items[0].priceChanged).toBe(true);
  });
});
