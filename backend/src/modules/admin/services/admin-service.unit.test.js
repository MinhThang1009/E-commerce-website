/**
 * Unit tests cho admin-service.js — User Management section (lines 1-200+)
 * Test qua HTTP route (supertest) vì các hàm dùng catchAsync(req, res) pattern.
 * Bổ sung các edge case chưa có trong admin-controller.test.js.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-admin-service-unit';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@utils/product-helpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(0),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-UNIT'),
}));

jest.mock('@services/vector-store/vector-store', () => ({
  upsertProduct: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  loadPromise: Promise.resolve(),
  items: [],
  enrichProductData: jest.fn((x) => x),
}));

jest.mock('@middlewares/rate-limiter', () => ({
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  chatbotLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = req._mockUser || { id: 1, role: 'admin', email: 'admin@test.com' };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
  adminAuthenticate: (req, _res, next) => {
    req.user = req._mockUser || { id: 1, role: 'admin', email: 'admin@test.com' };
    next();
  },
}));

jest.mock('@middlewares/admin-auth', () => ({
  adminAuthenticate: (req, _res, next) => {
    req.user = req._mockUser || { id: 1, role: 'admin', email: 'admin@test.com' };
    next();
  },
  requireSuperAdmin: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('@middlewares/validate-request', () => ({
  validateRequest: () => (_req, _res, next) => next(),
  validate: (rules) => [...(Array.isArray(rules) ? rules : []), (_req, _res, next) => next()],
  validateExpressValidator: (_req, _res, next) => next(),
}));

jest.mock('@modules/admin/controllers/admin-import-controller', () => ({
  getImportTemplate: (_req, _res, next) => next(),
  uploadImportFile: (_req, _res, next) => next(),
  importProducts: (_req, _res, next) => next(),
  getImportHistory: (_req, _res, next) => next(),
  exportProducts: (_req, _res, next) => next(),
}));

jest.mock('@modules/discount-code/controllers/discount-code-controller', () => ({
  getAllDiscountCodes: (_req, _res, next) => next(),
  getDiscountCodeById: (_req, _res, next) => next(),
  createDiscountCode: (_req, _res, next) => next(),
  updateDiscountCode: (_req, _res, next) => next(),
  deleteDiscountCode: (_req, _res, next) => next(),
}));

jest.mock('@models', () => {
  const mockTransaction = {
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    LOCK: { UPDATE: 'UPDATE' },
  };

  return {
    User: {
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      sum: jest.fn(),
    },
    Order: {
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      sum: jest.fn(),
      update: jest.fn(),
    },
    OrderItem: { findAll: jest.fn(), create: jest.fn() },
    Product: {
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    ProductVariant: {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      destroy: jest.fn(),
      sum: jest.fn(),
      bulkCreate: jest.fn(),
    },
    ProductImage: { bulkCreate: jest.fn(), destroy: jest.fn() },
    ProductAttribute: {
      findAll: jest.fn(),
      create: jest.fn(),
      destroy: jest.fn(),
      bulkCreate: jest.fn(),
    },
    ProductSpecification: {
      findAll: jest.fn(),
      create: jest.fn(),
      bulkCreate: jest.fn(),
      destroy: jest.fn(),
    },
    ProductCategory: { destroy: jest.fn(), bulkCreate: jest.fn() },
    Review: {
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
      findByPk: jest.fn(),
      count: jest.fn(),
    },
    Category: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
    CartItem: { destroy: jest.fn() },
    Wishlist: { destroy: jest.fn() },
    Address: {},
    SearchHistory: {},
    RecentlyViewed: {},
    InventoryLog: { create: jest.fn(), findAndCountAll: jest.fn() },
    ChatMessage: { count: jest.fn(), findAll: jest.fn(), findOne: jest.fn() },
    Brand: {},
    sequelize: {
      query: jest.fn().mockResolvedValue([[], {}]),
      transaction: jest.fn().mockImplementation(async (cb) => {
        if (typeof cb === 'function') return cb(mockTransaction);
        return mockTransaction;
      }),
      QueryTypes: { UPDATE: 'UPDATE' },
    },
    Op: require('sequelize').Op,
    Sequelize: require('sequelize').Sequelize,
  };
});

// ─── App setup ────────────────────────────────────────────────────────────────

const express = require('express');
const supertest = require('supertest');
const { errorHandler } = require('@middlewares/error-handler');
const adminRouter = require('@modules/admin/routes');
const { User } = require('@models');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use(errorHandler);

const request = supertest(app);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides = {}) {
  const data = {
    id: 99,
    firstName: 'Test',
    lastName: 'User',
    email: 'user@test.com',
    role: 'customer',
    isEmailVerified: false,
    isActive: true,
    ...overrides,
  };
  return {
    ...data,
    toJSON: () => ({ ...data }),
    update: jest.fn().mockResolvedValue({ ...data, ...overrides }),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── getAllUsers ───────────────────────────────────────────────────────────────

describe('getAllUsers — phân trang và filter', () => {
  test('trả về 200 với danh sách users và thông tin phân trang', async () => {
    const rows = [makeUser({ id: 10 }), makeUser({ id: 11 })];
    User.findAndCountAll.mockResolvedValueOnce({ count: 2, rows });

    const res = await request.get('/api/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(2);
    expect(res.body.data.pagination).toMatchObject({
      totalItems: 2,
      currentPage: 1,
    });
  });

  test('filter theo role → truyền role vào where clause', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [makeUser({ role: 'admin' })] });

    const res = await request.get('/api/admin/users?role=admin');
    expect(res.status).toBe(200);

    const callArgs = User.findAndCountAll.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ role: 'admin' });
  });

  test('filter theo search → truyền Op.or với firstName, lastName, email, phone', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

    await request.get('/api/admin/users?search=john');

    const callArgs = User.findAndCountAll.mock.calls[0][0];
    // where phải chứa Op.or array
    const { Op } = require('sequelize');
    expect(callArgs.where[Op.or]).toBeDefined();
    expect(callArgs.where[Op.or]).toHaveLength(4);
  });

  test('limit tối đa 100 dù client gửi limit=500', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

    await request.get('/api/admin/users?limit=500');

    const callArgs = User.findAndCountAll.mock.calls[0][0];
    expect(callArgs.limit).toBeLessThanOrEqual(100);
  });

  test('phân trang page=3, limit=10 → offset=20', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 50, rows: [] });

    const res = await request.get('/api/admin/users?page=3&limit=10');
    expect(res.status).toBe(200);

    const callArgs = User.findAndCountAll.mock.calls[0][0];
    expect(callArgs.offset).toBe(20);
  });

  test('không filter khi search và role đều rỗng', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

    await request.get('/api/admin/users');

    const callArgs = User.findAndCountAll.mock.calls[0][0];
    const { Op } = require('sequelize');
    expect(callArgs.where[Op.or]).toBeUndefined();
    expect(callArgs.where.role).toBeUndefined();
  });
});

// ─── getUserById ──────────────────────────────────────────────────────────────

describe('getUserById — trả về user với associations', () => {
  test('trả về 200 với user khi tìm thấy', async () => {
    const fakeUser = makeUser({ id: 5 });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    const res = await request.get('/api/admin/users/5');
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(5);
  });

  test('trả về 404 (AppError) khi user không tồn tại', async () => {
    User.findByPk.mockResolvedValueOnce(null);

    const res = await request.get('/api/admin/users/9999');
    expect(res.status).toBe(404);
  });
});

// ─── updateUser ───────────────────────────────────────────────────────────────

describe('updateUser — cập nhật fields hợp lệ', () => {
  test('update thành công → trả về 200 với user mới', async () => {
    const fakeUser = makeUser({ id: 50, role: 'customer' });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    const res = await request
      .put('/api/admin/users/50')
      .send({ firstName: 'NewName', role: 'customer' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('user');
    expect(fakeUser.update).toHaveBeenCalled();
  });

  test('user không tồn tại → 404', async () => {
    User.findByPk.mockResolvedValueOnce(null);

    const res = await request.put('/api/admin/users/999').send({ firstName: 'Ghost' });
    expect(res.status).toBe(404);
  });

  test('self-update role → 403 (không cho tự đổi role)', async () => {
    // req.user.id = 1 (mock), user.id = 1
    const selfUser = makeUser({ id: 1, role: 'admin' });
    User.findByPk.mockResolvedValueOnce(selfUser);

    const res = await request.put('/api/admin/users/1').send({ role: 'customer' });
    expect(res.status).toBe(403);
  });

  test('self-deactivate → 403 (không cho tự vô hiệu hóa)', async () => {
    const selfUser = makeUser({ id: 1, role: 'admin', isActive: true });
    User.findByPk.mockResolvedValueOnce(selfUser);

    const res = await request.put('/api/admin/users/1').send({ isActive: false });
    expect(res.status).toBe(403);
  });

  test('update phone=null (hasOwnProperty gửi null) → phone được set null', async () => {
    const fakeUser = makeUser({ id: 55, phone: '0901234567' });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    await request.put('/api/admin/users/55').send({ phone: null });

    expect(fakeUser.update).toHaveBeenCalledWith(expect.objectContaining({ phone: null }));
  });
});

// ─── updateProduct — lines 1242-1258: lưu variant images ────────────────────

describe('updateProduct — lưu ảnh cho variant khi variant có images (lines 1242-1258)', () => {
  const { Product, ProductVariant, ProductImage } = require('@models');

  test('200 và gọi destroyProductImages + bulkCreateProductImages cho variant có images', async () => {
    const savedVariant = {
      id: 50,
      sku: 'V1',
      price: 15000,
      stockQuantity: 5,
      update: jest.fn().mockResolvedValue({ id: 50, stockQuantity: 5, price: 15000 }),
    };
    const fakeProduct = {
      id: 10,
      name: 'Test Product',
      basePrice: 10000,
      stockQuantity: 10,
      update: jest.fn().mockResolvedValue(undefined),
      setCategories: jest.fn().mockResolvedValue(undefined),
    };

    Product.findByPk.mockResolvedValueOnce(fakeProduct);
    // currentVariants = rỗng (không có variant cũ)
    ProductVariant.findAll.mockResolvedValueOnce([]);
    // createProductVariant → tạo variant mới với id 50
    ProductVariant.create.mockResolvedValueOnce(savedVariant);
    ProductImage.destroy.mockResolvedValue(1);
    ProductImage.bulkCreate.mockResolvedValue([]);
    ProductVariant.sum.mockResolvedValue(5);

    const res = await request.put('/api/admin/products/10').send({
      variants: [
        {
          sku: 'V1',
          price: 15000,
          stock: 5,
          images: ['https://img1.jpg', 'https://img2.jpg'],
        },
      ],
    });

    expect(res.status).toBe(200);
    // destroyProductImages được gọi cho variant
    expect(ProductImage.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ variantId: 50 }) }),
    );
    // bulkCreateProductImages được gọi với ảnh variant
    expect(ProductImage.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ variantId: 50, imageUrl: 'https://img1.jpg', isThumbnail: true }),
        expect.objectContaining({
          variantId: 50,
          imageUrl: 'https://img2.jpg',
          isThumbnail: false,
        }),
      ]),
      expect.any(Object),
    );
  });
});

// ─── getAllProducts — lines 1615-1616: tính tổng tồn kho từ variants ────────

describe('getAllProducts — tính tổng tồn kho từ variants (lines 1615-1616)', () => {
  const { Product } = require('@models');

  test('stockQuantity được tính từ variants khi sản phẩm có variants', async () => {
    const productData = {
      id: 1,
      nameVi: 'Sản phẩm test',
      basePrice: 10000,
      stockQuantity: 0, // sẽ bị ghi đè bởi variants
      status: 'active',
      productImages: [],
      categories: [],
      category: null,
      variants: [{ stockQuantity: 3 }, { stockQuantity: 7 }],
    };
    const mockProduct = {
      toJSON: () => ({ ...productData }),
    };

    Product.findAndCountAll.mockResolvedValueOnce({
      count: 1,
      rows: [mockProduct],
    });

    const res = await request.get('/api/admin/products');
    expect(res.status).toBe(200);
    // stockQuantity = 3 + 7 = 10
    expect(res.body.data.products[0].stockQuantity).toBe(10);
  });
});

// ─── updateProductStock — lines 2025-2029: cập nhật variant stock ─────────────

describe('updateProductStock — cập nhật variant stock (lines 2025-2029)', () => {
  const { Product, ProductVariant } = require('@models');

  test('200 khi variantId được cung cấp → cập nhật variant và tổng tồn kho', async () => {
    const fakeVariant = {
      id: 5,
      stockQuantity: 10,
      update: jest.fn().mockResolvedValue(undefined),
    };
    const fakeProduct = {
      id: 1,
      stockQuantity: 20,
      update: jest.fn().mockResolvedValue(undefined),
    };

    Product.findByPk.mockResolvedValueOnce(fakeProduct);
    ProductVariant.findOne.mockResolvedValueOnce(fakeVariant);
    ProductVariant.sum.mockResolvedValueOnce(15); // tổng stock sau update

    const res = await request
      .patch('/api/admin/products/1/stock')
      .send({ stockQuantity: 5, variantId: 5 });

    expect(res.status).toBe(200);
    expect(fakeVariant.update).toHaveBeenCalledWith({ stockQuantity: 5 });
    expect(fakeProduct.update).toHaveBeenCalledWith({ stockQuantity: 15 });
  });

  test('404 khi variant không tìm thấy', async () => {
    const fakeProduct = {
      id: 1,
      update: jest.fn(),
    };

    Product.findByPk.mockResolvedValueOnce(fakeProduct);
    ProductVariant.findOne.mockResolvedValueOnce(null); // variant không tồn tại

    const res = await request
      .patch('/api/admin/products/1/stock')
      .send({ stockQuantity: 5, variantId: 999 });

    expect(res.status).toBe(404);
  });
});

// ─── getLowStockAnalytics — lines 2603-2617 ──────────────────────────────────

describe('getLowStockAnalytics — tính tồn kho từ variants (lines 2603-2617)', () => {
  const { Product } = require('@models');

  test('200 và tính stock từ variants khi sản phẩm có variants', async () => {
    const productWithVariants = {
      toJSON: () => ({
        id: 10,
        nameVi: 'Laptop Test',
        nameEn: null,
        stockQuantity: 0,
        variants: [
          { sku: 'LAP-001', stockQuantity: 2 },
          { sku: 'LAP-002', stockQuantity: 1 },
        ],
        productImages: [{ imageUrl: 'https://img.jpg' }],
      }),
    };
    const productNoVariants = {
      toJSON: () => ({
        id: 11,
        nameVi: null,
        nameEn: 'Phone Test',
        stockQuantity: 5,
        variants: [], // không có variants → dùng stockQuantity
        productImages: [],
      }),
    };

    Product.findAll.mockResolvedValueOnce([productWithVariants, productNoVariants]);

    // threshold = 5 → cả hai đều <= 5
    const res = await request.get('/api/admin/analytics/low-stock?threshold=5');

    expect(res.status).toBe(200);
    const items = res.body.data;
    const laptopItem = items.find((p) => p.id === 10);
    const phoneItem = items.find((p) => p.id === 11);

    // Line 2604: variantStock = 2 + 1 = 3
    // Line 2607: variants.length > 0 → stock = 3
    expect(laptopItem.stockQuantity).toBe(3);
    // Line 2607: không có variants → stockQuantity = 5
    expect(phoneItem.stockQuantity).toBe(5);
  });

  test('200 và lọc chỉ sản phẩm có stock <= threshold', async () => {
    const highStockProduct = {
      toJSON: () => ({
        id: 20,
        nameVi: 'High stock',
        stockQuantity: 100,
        variants: [],
        productImages: [],
      }),
    };
    const lowStockProduct = {
      toJSON: () => ({
        id: 21,
        nameVi: 'Low stock',
        stockQuantity: 2,
        variants: [],
        productImages: [],
      }),
    };

    Product.findAll.mockResolvedValueOnce([highStockProduct, lowStockProduct]);

    const res = await request.get('/api/admin/analytics/low-stock?threshold=10');

    expect(res.status).toBe(200);
    // Line 2617: filter → chỉ giữ item có stockQuantity <= threshold
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(21);
  });

  // Line 240 branch[1]: v.stockQuantity là null/undefined → fallback về 0
  test('variant có stockQuantity null → đóng góp 0 vào variantStock', async () => {
    const product = {
      toJSON: () => ({
        id: 30,
        nameVi: 'Sản phẩm có variant null stock',
        stockQuantity: 0,
        variants: [
          { sku: 'V1', stockQuantity: null },
          { sku: 'V2', stockQuantity: undefined },
          { sku: 'V3', stockQuantity: 3 },
        ],
        productImages: [],
      }),
    };

    Product.findAll.mockResolvedValueOnce([product]);

    const res = await request.get('/api/admin/analytics/low-stock?threshold=5');

    expect(res.status).toBe(200);
    // null + undefined + 3 = 0 + 0 + 3 = 3
    const item = res.body.data.find((p) => p.id === 30);
    expect(item.stockQuantity).toBe(3);
  });

  // Line 246 branch[3]: nameVi, nameEn, name đều falsy → name = ''
  test('sản phẩm không có nameVi, nameEn, name → trả về name rỗng', async () => {
    const product = {
      toJSON: () => ({
        id: 31,
        nameVi: null,
        nameEn: null,
        name: null,
        stockQuantity: 1,
        variants: [],
        productImages: [],
      }),
    };

    Product.findAll.mockResolvedValueOnce([product]);

    const res = await request.get('/api/admin/analytics/low-stock?threshold=5');

    expect(res.status).toBe(200);
    const item = res.body.data.find((p) => p.id === 31);
    expect(item.name).toBe('');
  });
});

// ─── deleteUser ───────────────────────────────────────────────────────────────

describe('deleteUser — xóa user', () => {
  test('xóa thành công → 200', async () => {
    const fakeUser = makeUser({ id: 77 });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    const res = await request.delete('/api/admin/users/77');
    expect(res.status).toBe(200);
    expect(fakeUser.destroy).toHaveBeenCalled();
  });

  test('user không tồn tại → 404', async () => {
    User.findByPk.mockResolvedValueOnce(null);

    const res = await request.delete('/api/admin/users/9999');
    expect(res.status).toBe(404);
  });

  test('self-delete protection → 403 khi xóa chính mình (id=1)', async () => {
    // req.user.id = 1 (mock), id param = 1
    // Kiểm tra: deleteUser check String(req.user.id) === String(id) TRƯỚC khi findByPk
    const res = await request.delete('/api/admin/users/1');
    expect(res.status).toBe(403);
    // findByPk không được gọi vì self-delete check xảy ra trước
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  test('xóa user khác (không phải chính mình) → gọi destroy', async () => {
    const fakeUser = makeUser({ id: 88 });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    const res = await request.delete('/api/admin/users/88');
    expect(res.status).toBe(200);
    expect(fakeUser.destroy).toHaveBeenCalledTimes(1);
  });
});
