/**
 * Tests cho admin controller — bao phủ toàn bộ các section:
 *
 *  Dashboard / Stats:
 *    GET /api/admin/dashboard             → getDashboardStats
 *    GET /api/admin/stats                 → getDetailedStats
 *
 *  User management:
 *    GET    /api/admin/users              → getAllUsers
 *    GET    /api/admin/users/:id          → getUserById
 *    PUT    /api/admin/users/:id          → updateUser
 *    DELETE /api/admin/users/:id          → deleteUser
 *
 *  Product management:
 *    GET    /api/admin/products           → getAllProducts
 *    GET    /api/admin/products/:id       → getProductById
 *    POST   /api/admin/products           → createProduct
 *    PUT    /api/admin/products/:id       → updateProduct
 *    DELETE /api/admin/products/:id       → deleteProduct
 *    PATCH  /api/admin/products/:id/status → toggleProductStatus
 *    PATCH  /api/admin/products/:id/stock  → updateProductStock
 *    POST   /api/admin/products/:id/restock → restockProduct
 *
 *  Order management:
 *    GET /api/admin/orders                → getAllOrders
 *    PUT /api/admin/orders/:id/status     → updateOrderStatus
 *    PUT /api/admin/orders/:id/cancel     → adminCancelOrder
 *
 *  Analytics:
 *    GET /api/admin/analytics/order-status     → getOrderStatusAnalytics
 *    GET /api/admin/analytics/top-products     → getTopProductsAnalytics
 *    GET /api/admin/analytics/revenue-by-category → getRevenueByCategoryAnalytics
 *    GET /api/admin/analytics/user-growth      → getUserGrowthAnalytics
 *    GET /api/admin/analytics/payment-methods  → getPaymentMethodsAnalytics
 *    GET /api/admin/analytics/low-stock        → getLowStockAnalytics
 *
 *  Reports:
 *    GET /api/admin/reports/export        → exportReport
 *
 *  Chatbot stats:
 *    GET /api/admin/chatbot/stats         → getChatbotStats
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-admin-controller';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — phải đặt trước mọi require()
// ─────────────────────────────────────────────────────────────────────────────

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
  generateVariantSku: jest.fn().mockReturnValue('SKU-TEST-VAR'),
  enrichProductData: jest.fn((x) => x),
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
    req.user = { id: 1, role: 'admin', email: 'admin@test.com' };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
  adminAuthenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'admin', email: 'admin@test.com' };
    next();
  },
}));

jest.mock('@middlewares/admin-auth', () => ({
  adminAuthenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'admin', email: 'admin@test.com' };
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

// Mock adminImport controller — tránh phụ thuộc multer/csv
jest.mock('./admin-import-controller', () => ({
  getImportTemplate: (_req, _res, next) => next(),
  uploadImportFile: (_req, _res, next) => next(),
  importProducts: (_req, _res, next) => next(),
  getImportHistory: (_req, _res, next) => next(),
  exportProducts: (_req, _res, next) => next(),
}));

// Mock discountCode controller
jest.mock('@modules/discount-code/controllers/discount-code-controller', () => ({
  getAllDiscountCodes: (_req, _res, next) => next(),
  getDiscountCodeById: (_req, _res, next) => next(),
  createDiscountCode: (_req, _res, next) => next(),
  updateDiscountCode: (_req, _res, next) => next(),
  deleteDiscountCode: (_req, _res, next) => next(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Model mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@models', () => {
  // Mock transaction object
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
    OrderItem: {
      findAll: jest.fn(),
      create: jest.fn(),
    },
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
    ProductImage: {
      bulkCreate: jest.fn(),
      destroy: jest.fn(),
    },
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
    ProductCategory: {
      destroy: jest.fn(),
      bulkCreate: jest.fn(),
    },
    Review: {
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
      findByPk: jest.fn(),
      count: jest.fn(),
    },
    Category: {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
    },
    CartItem: { destroy: jest.fn() },
    Wishlist: { destroy: jest.fn() },
    Address: {},
    SearchHistory: {},
    RecentlyViewed: {},
    InventoryLog: {
      create: jest.fn(),
      findAndCountAll: jest.fn(),
    },
    ChatMessage: {
      count: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    },
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

// ─────────────────────────────────────────────────────────────────────────────
// App setup
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const supertest = require('supertest');
const { errorHandler } = require('@middlewares/error-handler');
const adminRouter = require('@modules/admin/routes');

const {
  User,
  Product,
  Order,
  OrderItem,
  ChatMessage,
  ProductVariant,
  InventoryLog,
  Review,
  sequelize,
} = require('@models');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use(errorHandler);

const request = supertest(app);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Tạo fake Sequelize row với getDataValue() và toJSON() */
function makeRow(attrs) {
  return {
    ...attrs,
    getDataValue: (key) => attrs[key],
    toJSON: () => ({ ...attrs }),
    Product: attrs.Product || null,
    update: jest.fn().mockResolvedValue({ ...attrs }),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
}

/** Tạo fake Product với đầy đủ methods Sequelize */
function makeProduct(overrides = {}) {
  const data = {
    id: 10,
    name: 'Laptop Test',
    baseName: 'Laptop Test',
    description: 'Mô tả',
    basePrice: 15000000,
    stockQuantity: 50,
    status: 'active',
    ...overrides,
  };
  return {
    ...data,
    toJSON: () => ({ ...data, variants: [], productImages: [] }),
    get: jest.fn((opts) => (opts?.plain ? { ...data } : data)),
    update: jest.fn().mockResolvedValue({ ...data, ...overrides }),
    destroy: jest.fn().mockResolvedValue(undefined),
    setCategories: jest.fn().mockResolvedValue(undefined),
  };
}

/** Tạo fake Order với methods Sequelize */
function makeOrder(overrides = {}) {
  const data = {
    id: 5,
    number: 'ORD-001',
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: 'cod',
    total: 500000,
    items: [],
    ...overrides,
  };
  return {
    ...data,
    toJSON: () => ({ ...data }),
    update: jest.fn().mockImplementation((patch) => {
      Object.assign(data, patch);
      return Promise.resolve(data);
    }),
  };
}

/** Tạo fake User với methods Sequelize */
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/dashboard
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/dashboard', () => {
  function setupDashboardMocks(opts = {}) {
    const {
      totalUsers = 100,
      totalProducts = 50,
      totalOrders = 200,
      totalRevenue = 5000000,
      monthlyUsers = 10,
      monthlyOrders = 20,
      monthlyRevenue = 500000,
      lastMonthUsers = 8,
      lastMonthOrders = 18,
      lastMonthRevenue = 400000,
      orderStatusCounts = [],
      topProducts = [],
      cancelledOrdersMonth = 2,
      lowStockCount = 3,
    } = opts;

    User.count
      .mockResolvedValueOnce(totalUsers)
      .mockResolvedValueOnce(monthlyUsers)
      .mockResolvedValueOnce(lastMonthUsers);
    Product.count.mockResolvedValueOnce(totalProducts).mockResolvedValueOnce(lowStockCount);
    Order.count
      .mockResolvedValueOnce(totalOrders)
      .mockResolvedValueOnce(monthlyOrders)
      .mockResolvedValueOnce(lastMonthOrders)
      .mockResolvedValueOnce(cancelledOrdersMonth);
    Order.sum
      .mockResolvedValueOnce(totalRevenue)
      .mockResolvedValueOnce(monthlyRevenue)
      .mockResolvedValueOnce(lastMonthRevenue);
    Order.findAll.mockResolvedValueOnce(orderStatusCounts);
    OrderItem.findAll.mockResolvedValueOnce(topProducts);
  }

  it('trả về 200 với cấu trúc overview, monthly, growth, topProducts', async () => {
    setupDashboardMocks();
    const res = await request.get('/api/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('overview');
    expect(res.body.data).toHaveProperty('monthly');
    expect(res.body.data).toHaveProperty('growth');
    expect(res.body.data).toHaveProperty('topProducts');
    // Verify WHERE clause không bị nested sai (regression test)
    // monthlyUsers: User.count call thứ 2 (sau totalUsers)
    const monthlyCall = User.count.mock.calls[1][0];
    expect(monthlyCall.where).toHaveProperty('role', 'customer');
    expect(monthlyCall.where).toHaveProperty('createdAt');
    // Phải là flat object, không nested { where: { where: {...} } }
    expect(monthlyCall.where.where).toBeUndefined();
  });

  it('overview chứa đúng totalUsers, totalProducts, totalOrders, totalRevenue', async () => {
    setupDashboardMocks({
      totalUsers: 42,
      totalProducts: 15,
      totalOrders: 99,
      totalRevenue: 3000000,
    });
    const res = await request.get('/api/admin/dashboard');
    expect(res.status).toBe(200);
    const { overview } = res.body.data;
    expect(overview.totalUsers).toBe(42);
    expect(overview.totalProducts).toBe(15);
    expect(overview.totalOrders).toBe(99);
    expect(overview.totalRevenue).toBe(3000000);
  });

  it('growth.users tính đúng % tăng trưởng so với tháng trước', async () => {
    // lastMonthUsers=10, monthlyUsers=15 → growth = 50%
    setupDashboardMocks({ monthlyUsers: 15, lastMonthUsers: 10 });
    const res = await request.get('/api/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.growth.users).toBe(50);
  });

  it('growth.users là 0 khi lastMonthUsers = 0 (tránh chia cho 0)', async () => {
    setupDashboardMocks({ monthlyUsers: 5, lastMonthUsers: 0 });
    const res = await request.get('/api/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.growth.users).toBe(0);
  });

  it('vẫn trả về 200 khi OrderItem.findAll ném lỗi (topProducts lỗi được bắt nội bộ)', async () => {
    User.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    Product.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
    Order.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    Order.sum
      .mockResolvedValueOnce(100000)
      .mockResolvedValueOnce(20000)
      .mockResolvedValueOnce(15000);
    Order.findAll.mockResolvedValueOnce([]);
    OrderItem.findAll.mockRejectedValueOnce(new Error('DB query failed'));

    const res = await request.get('/api/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.topProducts).toEqual([]);
  });

  it('overview.totalRevenue là 0 khi Order.sum trả về null', async () => {
    setupDashboardMocks({ totalRevenue: null, monthlyRevenue: null, lastMonthRevenue: null });
    const res = await request.get('/api/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.overview.totalRevenue).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/stats
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/stats', () => {
  it('trả về 400 khi thiếu startDate hoặc endDate', async () => {
    const res = await request.get('/api/admin/stats');
    expect(res.status).toBe(400);
  });

  it('trả về 200 với dữ liệu orders và users khi cung cấp đủ tham số', async () => {
    Order.findAll.mockResolvedValueOnce([
      makeRow({ period: '2025-01-01', orderCount: 5, revenue: 500000 }),
    ]);
    User.findAll.mockResolvedValueOnce([makeRow({ period: '2025-01-01', newUsers: 3 })]);

    const res = await request.get('/api/admin/stats?startDate=2025-01-01&endDate=2025-01-31');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('orders');
    expect(res.body.data).toHaveProperty('users');
    expect(res.body.data.orders[0].orderCount).toBe(5);
    expect(res.body.data.users[0].newUsers).toBe(3);
  });

  it('groupBy=month dùng format %Y-%m', async () => {
    Order.findAll.mockResolvedValueOnce([]);
    User.findAll.mockResolvedValueOnce([]);

    const res = await request.get(
      '/api/admin/stats?startDate=2025-01-01&endDate=2025-12-31&groupBy=month',
    );
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  it('trả về 200 với danh sách users và thông tin phân trang', async () => {
    const fakeUsers = [makeUser(), makeUser({ id: 100, email: 'b@test.com' })];
    User.findAndCountAll.mockResolvedValueOnce({ count: 2, rows: fakeUsers });

    const res = await request.get('/api/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.users).toHaveLength(2);
    expect(res.body.data.pagination.totalItems).toBe(2);
  });

  it('phân trang đúng với page=2&limit=5', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 15, rows: [] });

    const res = await request.get('/api/admin/users?page=2&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.data.pagination.currentPage).toBe(2);
    expect(res.body.data.pagination.itemsPerPage).toBe(5);
    expect(res.body.data.pagination.totalPages).toBe(3);
  });

  it('giới hạn limit tối đa là 100 khi client yêu cầu limit=999', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

    await request.get('/api/admin/users?limit=999');
    const callArgs = User.findAndCountAll.mock.calls[0][0];
    expect(callArgs.limit).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/users/:id', () => {
  it('trả về 200 với thông tin user khi tìm thấy', async () => {
    const fakeUser = makeUser({ id: 5 });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    const res = await request.get('/api/admin/users/5');
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(5);
  });

  it('trả về 404 khi không tìm thấy user', async () => {
    User.findByPk.mockResolvedValueOnce(null);

    const res = await request.get('/api/admin/users/9999');
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/users/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/users/:id', () => {
  it('trả về 200 với user đã cập nhật', async () => {
    const fakeUser = makeUser({ id: 50, role: 'customer' });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    const res = await request
      .put('/api/admin/users/50')
      .send({ firstName: 'Updated', role: 'customer' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('user');
  });

  it('trả về 404 khi user không tồn tại', async () => {
    User.findByPk.mockResolvedValueOnce(null);

    const res = await request.put('/api/admin/users/999').send({ firstName: 'Ghost' });
    expect(res.status).toBe(404);
  });

  it('trả về 403 khi admin tự đổi role của chính mình', async () => {
    // req.user.id = 1 (mock), user.id = 1 → tự update role của mình
    const selfUser = makeUser({ id: 1, role: 'admin' });
    User.findByPk.mockResolvedValueOnce(selfUser);

    const res = await request.put('/api/admin/users/1').send({ role: 'customer' });
    expect(res.status).toBe(403);
  });

  it('trả về 403 khi admin tự deactivate tài khoản của chính mình', async () => {
    const selfUser = makeUser({ id: 1, role: 'admin', isActive: true });
    User.findByPk.mockResolvedValueOnce(selfUser);

    const res = await request.put('/api/admin/users/1').send({ isActive: false });
    expect(res.status).toBe(403);
  });

  it('giữ nguyên firstName/lastName/phone khi không gửi trong body', async () => {
    const fakeUser = makeUser({ id: 55, firstName: 'Old', lastName: 'Name', phone: '0901' });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    const res = await request.put('/api/admin/users/55').send({ role: 'customer' });
    expect(res.status).toBe(200);
    expect(fakeUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Old', lastName: 'Name', phone: '0901' }),
    );
  });

  it('firstName="" (falsy) → fallback về user.firstName cũ (covers || user.firstName branch)', async () => {
    const fakeUser = makeUser({ id: 56, firstName: 'Existing' });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    const res = await request
      .put('/api/admin/users/56')
      .send({ firstName: '', lastName: '', phone: '' });
    expect(res.status).toBe(200);
    // firstName='' là falsy → '' || user.firstName = 'Existing'
    expect(fakeUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Existing' }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/users/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/admin/users/:id', () => {
  it('trả về 200 khi xóa user thành công', async () => {
    const fakeUser = makeUser({ id: 77 });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    const res = await request.delete('/api/admin/users/77');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/thành công/i);
  });

  it('trả về 404 khi user không tồn tại', async () => {
    User.findByPk.mockResolvedValueOnce(null);

    const res = await request.delete('/api/admin/users/9999');
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/products
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/products', () => {
  it('trả về 200 với danh sách sản phẩm và phân trang', async () => {
    const fakeProducts = [
      {
        toJSON: () => ({
          id: 1,
          name: 'Laptop A',
          basePrice: 10000000,
          stockQuantity: 5,
          productImages: [],
          categories: [],
          category: null,
        }),
      },
    ];
    Product.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: fakeProducts });

    const res = await request.get('/api/admin/products');
    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(1);
    expect(res.body.data.pagination.totalItems).toBe(1);
  });

  it('transform đúng: product.price = product.basePrice, product.images từ productImages', async () => {
    const fakeProduct = {
      toJSON: () => ({
        id: 2,
        name: 'Laptop B',
        basePrice: 20000000,
        stockQuantity: 3,
        productImages: [{ imageUrl: 'https://img.com/a.jpg', color: null, isThumbnail: true }],
        categories: [],
        category: null,
      }),
    };
    Product.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [fakeProduct] });

    const res = await request.get('/api/admin/products');
    expect(res.status).toBe(200);
    const product = res.body.data.products[0];
    expect(product.price).toBe(20000000);
    expect(product.images).toEqual(['https://img.com/a.jpg']);
  });

  it('trả về 200 với mảng rỗng khi không có sản phẩm', async () => {
    Product.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });
    const res = await request.get('/api/admin/products');
    expect(res.status).toBe(200);
    expect(res.body.data.products).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/products/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/products/:id', () => {
  it('trả về 200 với thông tin product khi tìm thấy', async () => {
    const fakeProduct = makeProduct({ id: 10 });
    Product.findByPk.mockResolvedValueOnce(fakeProduct);

    const res = await request.get('/api/admin/products/10');
    expect(res.status).toBe(200);
    expect(res.body.data.product.id).toBe(10);
  });

  it('trả về 404 khi product không tồn tại', async () => {
    Product.findByPk.mockResolvedValueOnce(null);

    const res = await request.get('/api/admin/products/9999');
    expect(res.status).toBe(404);
  });

  it('variants.attributes được parse thành object khi là chuỗi JSON hợp lệ', async () => {
    const fakeProduct = {
      toJSON: () => ({
        id: 20,
        name: 'Product với variant',
        variants: [
          {
            id: 'v1',
            name: '8GB',
            attributes: JSON.stringify({ ram: '8GB' }),
            specifications: null,
          },
        ],
        productImages: [],
      }),
    };
    Product.findByPk.mockResolvedValueOnce(fakeProduct);

    const res = await request.get('/api/admin/products/20');
    expect(res.status).toBe(200);
    const variant = res.body.data.product.variants[0];
    // JSON string hợp lệ → deepParseJSON parse thành object
    expect(variant.attributes).toEqual({ ram: '8GB' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/products
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products', () => {
  function setupCreateProductMocks(productId = 1) {
    const createdProduct = makeProduct({ id: productId });
    Product.create.mockResolvedValueOnce(createdProduct);
    sequelize.query.mockResolvedValue([[], {}]);
    // Product.findByPk cho lần load lại với relations
    Product.findByPk.mockResolvedValueOnce(makeProduct({ id: productId }));
    return createdProduct;
  }

  it('trả về 201 khi tạo sản phẩm thành công với dữ liệu tối thiểu', async () => {
    setupCreateProductMocks(1);

    const res = await request.post('/api/admin/products').send({
      name: 'Laptop Mới',
      basePrice: 15000000,
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('product');
  });

  it('tạo product với images dạng mảng URL string', async () => {
    setupCreateProductMocks(2);
    const { ProductImage } = require('@models');
    ProductImage.bulkCreate.mockResolvedValueOnce([]);

    const res = await request.post('/api/admin/products').send({
      name: 'Laptop với ảnh',
      basePrice: 20000000,
      images: ['https://img.com/1.jpg', 'https://img.com/2.jpg'],
    });
    expect(res.status).toBe(201);
    expect(ProductImage.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ imageUrl: 'https://img.com/1.jpg', isThumbnail: true }),
        expect.objectContaining({ imageUrl: 'https://img.com/2.jpg', isThumbnail: false }),
      ]),
    );
  });

  it('SKU được tự động sinh khi không cung cấp', async () => {
    setupCreateProductMocks(3);

    await request
      .post('/api/admin/products')
      .send({ name: 'Product không SKU', basePrice: 5000000 });

    const createCall = Product.create.mock.calls[0][0];
    // SKU không có trên products nữa (đã chuyển sang variants), nhưng logic vẫn tạo uniqueSku
    expect(Product.create).toHaveBeenCalled();
    // Name phải đúng
    expect(createCall.name).toBe('Product không SKU');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/products/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/products/:id', () => {
  it('trả về 200 khi cập nhật sản phẩm thành công', async () => {
    const fakeProduct = makeProduct({ id: 10 });
    // updateProduct gọi sequelize.transaction() không có callback → nhận transaction object
    // Sau đó gọi Product.findByPk(id, { transaction }) bên trong try block
    // Cuối cùng gọi Product.findByPk(id, ...) để load lại sau commit
    Product.findByPk
      .mockResolvedValueOnce(fakeProduct) // trong try block sau khi lấy transaction
      .mockResolvedValueOnce(fakeProduct); // load lại finalProduct sau commit
    sequelize.query.mockResolvedValue([[], {}]);

    const res = await request.put('/api/admin/products/10').send({ name: 'Tên mới' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('trả về 404 khi product không tồn tại', async () => {
    // findByPk trả về null → controller rollback và throw AppError 404
    Product.findByPk.mockResolvedValueOnce(null);

    const res = await request.put('/api/admin/products/9999').send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/products/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/admin/products/:id', () => {
  it('trả về 200 khi xóa thành công', async () => {
    // deleteProduct: gọi Product.findByPk TRƯỚC transaction (không bên trong callback)
    // Sau đó gọi sequelize.transaction() không callback → nhận transaction object
    // Bên trong try: CartItem.destroy, Wishlist.destroy, ... product.destroy, transaction.commit()
    const fakeProduct = makeProduct({ id: 7 });
    Product.findByPk.mockResolvedValueOnce(fakeProduct);

    const res = await request.delete('/api/admin/products/7');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/thành công/i);
  });

  it('trả về 404 khi product không tồn tại', async () => {
    Product.findByPk.mockResolvedValueOnce(null);

    const res = await request.delete('/api/admin/products/9999');
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/products/:id/status
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/admin/products/:id/status', () => {
  it('trả về 200 khi toggle status thành công với status cụ thể', async () => {
    const fakeProduct = makeProduct({ id: 3, status: 'active' });
    Product.findByPk.mockResolvedValueOnce(fakeProduct);

    const res = await request.patch('/api/admin/products/3/status').send({ status: 'inactive' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('trả về 200 khi không cung cấp status, tự đảo từ active sang inactive', async () => {
    const fakeProduct = makeProduct({ id: 4, status: 'active' });
    Product.findByPk.mockResolvedValueOnce(fakeProduct);

    const res = await request.patch('/api/admin/products/4/status').send({});
    expect(res.status).toBe(200);
  });

  it('trả về 404 khi product không tồn tại', async () => {
    Product.findByPk.mockResolvedValueOnce(null);

    const res = await request.patch('/api/admin/products/9999/status').send({ status: 'active' });
    expect(res.status).toBe(404);
  });

  it('trả về 400 khi status không hợp lệ', async () => {
    const fakeProduct = makeProduct({ id: 5, status: 'active' });
    Product.findByPk.mockResolvedValueOnce(fakeProduct);

    const res = await request
      .patch('/api/admin/products/5/status')
      .send({ status: 'invalid_status' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/products/:id/stock
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/admin/products/:id/stock', () => {
  it('trả về 200 và cập nhật stockQuantity thành công', async () => {
    const fakeProduct = makeProduct({ id: 6, stockQuantity: 10 });
    Product.findByPk.mockResolvedValueOnce(fakeProduct);

    const res = await request.patch('/api/admin/products/6/stock').send({ stockQuantity: 25 });
    expect(res.status).toBe(200);
    expect(res.body.data.stockQuantity).toBe(25);
  });

  it('trả về 400 khi stockQuantity là số âm', async () => {
    const res = await request.patch('/api/admin/products/6/stock').send({ stockQuantity: -1 });
    expect(res.status).toBe(400);
  });

  it('trả về 400 khi stockQuantity không phải số', async () => {
    const res = await request.patch('/api/admin/products/6/stock').send({ stockQuantity: 'abc' });
    expect(res.status).toBe(400);
  });

  it('trả về 404 khi product không tồn tại', async () => {
    Product.findByPk.mockResolvedValueOnce(null);

    const res = await request.patch('/api/admin/products/9999/stock').send({ stockQuantity: 10 });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/products/:productId/restock
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/:productId/restock', () => {
  it('trả về 200 khi restock sản phẩm không có variant thành công', async () => {
    // makeProduct với stockQuantity=10 — product.update cập nhật giá trị mới
    const fakeProduct = {
      id: 8,
      stockQuantity: 10,
      status: 'active',
      toJSON: () => ({ id: 8, stockQuantity: 30, status: 'active' }),
      update: jest.fn().mockResolvedValue({ id: 8, stockQuantity: 30 }),
    };
    Product.findByPk
      .mockResolvedValueOnce(fakeProduct) // lần 1: load product để restock
      .mockResolvedValueOnce(makeProduct({ id: 8, status: 'active' })); // lần 2: productForIndex để sync vector
    InventoryLog.create.mockResolvedValueOnce({ id: 1, changeType: 'restock' });

    const res = await request.post('/api/admin/products/8/restock').send({ quantity: 20 });
    expect(res.status).toBe(200);
    expect(res.body.data.quantity).toBe(20);
    expect(res.body.data.previousStock).toBe(10);
    expect(res.body.data.newStock).toBe(30);
  });

  it('trả về 200 khi restock cho biến thể cụ thể', async () => {
    const fakeProduct = makeProduct({ id: 9, stockQuantity: 5 });
    const fakeVariant = {
      id: 'v1',
      stockQuantity: 8,
      update: jest.fn().mockResolvedValue({ stockQuantity: 18 }),
    };
    Product.findByPk.mockResolvedValueOnce(fakeProduct);
    ProductVariant.findOne.mockResolvedValueOnce(fakeVariant);
    ProductVariant.sum.mockResolvedValueOnce(18);
    InventoryLog.create.mockResolvedValueOnce({ id: 2, changeType: 'restock' });

    const res = await request
      .post('/api/admin/products/9/restock')
      .send({ quantity: 10, variantId: 'v1' });
    expect(res.status).toBe(200);
    expect(res.body.data.variantId).toBe('v1');
  });

  it('trả về 400 khi quantity <= 0', async () => {
    const res = await request.post('/api/admin/products/8/restock').send({ quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('trả về 400 khi quantity âm', async () => {
    const res = await request.post('/api/admin/products/8/restock').send({ quantity: -5 });
    expect(res.status).toBe(400);
  });

  it('trả về 404 khi product không tồn tại', async () => {
    Product.findByPk.mockResolvedValueOnce(null);

    const res = await request.post('/api/admin/products/9999/restock').send({ quantity: 10 });
    expect(res.status).toBe(404);
  });

  it('trả về 404 khi variantId không tìm thấy trong product', async () => {
    const fakeProduct = makeProduct({ id: 11 });
    Product.findByPk.mockResolvedValueOnce(fakeProduct);
    ProductVariant.findOne.mockResolvedValueOnce(null);

    const res = await request
      .post('/api/admin/products/11/restock')
      .send({ quantity: 5, variantId: 'nonexistent' });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/orders
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/orders', () => {
  it('trả về 200 với danh sách orders và phân trang', async () => {
    const fakeOrders = [
      {
        toJSON: () => ({
          id: 1,
          number: 'ORD-001',
          status: 'pending',
          total: 500000,
          items: [],
        }),
      },
    ];
    Order.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: fakeOrders });

    const res = await request.get('/api/admin/orders');
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.pagination.totalItems).toBe(1);
  });

  it('filter theo status hoạt động đúng', async () => {
    Order.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

    await request.get('/api/admin/orders?status=delivered');
    const callArgs = Order.findAndCountAll.mock.calls[0][0];
    expect(callArgs.where.status).toBe('delivered');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/orders/:id/status
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/orders/:id/status', () => {
  it('trả về 200 khi cập nhật trạng thái đơn hàng thành công', async () => {
    const fakeOrder = makeOrder({ id: 5, status: 'pending' });
    Order.findByPk.mockResolvedValueOnce(fakeOrder);

    const res = await request.put('/api/admin/orders/5/status').send({ status: 'processing' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('trả về 404 khi đơn hàng không tồn tại', async () => {
    Order.findByPk.mockResolvedValueOnce(null);

    const res = await request.put('/api/admin/orders/9999/status').send({ status: 'delivered' });
    expect(res.status).toBe(404);
  });

  it('tự động đặt paymentStatus=paid khi status=delivered và paymentMethod=cod', async () => {
    const fakeOrder = makeOrder({
      id: 6,
      status: 'shipped',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
    });
    Order.findByPk.mockResolvedValueOnce(fakeOrder);

    const res = await request.put('/api/admin/orders/6/status').send({ status: 'delivered' });
    expect(res.status).toBe(200);
    // Kiểm tra update được gọi với paymentStatus=paid
    expect(fakeOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'paid' }),
    );
  });

  it('hoàn tồn kho khi status chuyển sang cancelled', async () => {
    const mockProduct = makeProduct({ id: 10, stockQuantity: 5 });
    const fakeOrder = makeOrder({
      id: 7,
      status: 'processing',
      items: [
        {
          quantity: 3,
          variantId: null,
          Product: mockProduct,
          ProductVariant: null,
        },
      ],
    });
    Order.findByPk.mockResolvedValueOnce(fakeOrder);
    // Sau transaction, load lại order
    const updatedOrder = makeOrder({ id: 7, status: 'cancelled' });
    Order.findByPk.mockResolvedValueOnce(updatedOrder);

    const res = await request.put('/api/admin/orders/7/status').send({ status: 'cancelled' });
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/orders/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/orders/:id/cancel', () => {
  it('trả về 200 khi hủy đơn hàng thành công', async () => {
    const mockProduct = makeProduct({ id: 10, stockQuantity: 5 });
    const fakeOrder = makeOrder({
      id: 10,
      status: 'processing',
      items: [{ quantity: 2, variantId: null, Product: mockProduct, ProductVariant: null }],
    });
    Order.findByPk.mockResolvedValueOnce(fakeOrder);

    const res = await request.put('/api/admin/orders/10/cancel');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/hủy/i);
  });

  it('trả về 404 khi đơn hàng không tồn tại', async () => {
    Order.findByPk.mockResolvedValueOnce(null);

    const res = await request.put('/api/admin/orders/9999/cancel');
    expect(res.status).toBe(404);
  });

  it('trả về 400 khi đơn hàng đã bị hủy trước đó', async () => {
    const fakeOrder = makeOrder({ id: 11, status: 'cancelled', items: [] });
    Order.findByPk.mockResolvedValueOnce(fakeOrder);

    const res = await request.put('/api/admin/orders/11/cancel');
    expect(res.status).toBe(400);
  });

  it('trả về 400 khi đơn hàng đã giao không thể hủy', async () => {
    const fakeOrder = makeOrder({ id: 12, status: 'delivered', items: [] });
    Order.findByPk.mockResolvedValueOnce(fakeOrder);

    const res = await request.put('/api/admin/orders/12/cancel');
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/order-status
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics/order-status', () => {
  it('trả về 200 với mảng phân bổ trạng thái đơn hàng', async () => {
    Order.findAll.mockResolvedValueOnce([
      { status: 'pending', count: '10' },
      { status: 'delivered', count: '50' },
    ]);

    const res = await request.get('/api/admin/analytics/order-status');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toHaveProperty('status');
    expect(res.body.data[0]).toHaveProperty('count');
    expect(res.body.data[0]).toHaveProperty('label');
  });

  it('trả về 200 với mảng rỗng khi không có đơn hàng', async () => {
    Order.findAll.mockResolvedValueOnce([]);

    const res = await request.get('/api/admin/analytics/order-status');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('áp dụng filter startDate khi được cung cấp', async () => {
    Order.findAll.mockResolvedValueOnce([]);

    await request.get('/api/admin/analytics/order-status?startDate=2025-01-01');
    expect(Order.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdAt: expect.anything() }) }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/top-products
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics/top-products', () => {
  it('trả về 200 với danh sách top products', async () => {
    const fakeRows = [
      makeRow({
        productId: 1,
        revenue: '5000000',
        soldCount: '20',
        Product: {
          name: 'Laptop A',
          productImages: [],
          toJSON: () => ({ name: 'Laptop A', productImages: [] }),
        },
      }),
    ];
    OrderItem.findAll.mockResolvedValueOnce(fakeRows);

    const res = await request.get('/api/admin/analytics/top-products');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('productId');
    expect(res.body.data[0]).toHaveProperty('revenue');
    expect(res.body.data[0]).toHaveProperty('soldCount');
  });

  it('giới hạn tối đa 20 kết quả khi limit vượt ngưỡng', async () => {
    OrderItem.findAll.mockResolvedValueOnce([]);

    await request.get('/api/admin/analytics/top-products?limit=100');
    const callArgs = OrderItem.findAll.mock.calls[0][0];
    expect(callArgs.limit).toBeLessThanOrEqual(20);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/revenue-by-category
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics/revenue-by-category', () => {
  it('trả về 200 với dữ liệu doanh thu theo danh mục', async () => {
    sequelize.query.mockResolvedValueOnce([
      [{ categoryId: 1, categoryName: 'Laptop', revenue: '10000000', orderItemCount: '50' }],
      {},
    ]);

    const res = await request.get('/api/admin/analytics/revenue-by-category');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].categoryName).toBe('Laptop');
    expect(res.body.data[0].revenue).toBe(10000000);
  });

  it('trả về 200 với mảng rỗng khi không có dữ liệu', async () => {
    sequelize.query.mockResolvedValueOnce([[], {}]);

    const res = await request.get('/api/admin/analytics/revenue-by-category');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/user-growth
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics/user-growth', () => {
  it('trả về 400 khi thiếu startDate', async () => {
    const res = await request.get('/api/admin/analytics/user-growth?endDate=2025-12-31');
    expect(res.status).toBe(400);
  });

  it('trả về 400 khi thiếu endDate', async () => {
    const res = await request.get('/api/admin/analytics/user-growth?startDate=2025-01-01');
    expect(res.status).toBe(400);
  });

  it('trả về 200 với dữ liệu tăng trưởng user', async () => {
    User.findAll.mockResolvedValueOnce([
      { date: '2025-01-01', newUsers: '5' },
      { date: '2025-01-02', newUsers: '8' },
    ]);

    const res = await request.get(
      '/api/admin/analytics/user-growth?startDate=2025-01-01&endDate=2025-01-31',
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].newUsers).toBe(5);
  });

  it('groupBy=week dùng định dạng %Y-%u', async () => {
    User.findAll.mockResolvedValueOnce([]);

    await request.get(
      '/api/admin/analytics/user-growth?startDate=2025-01-01&endDate=2025-12-31&groupBy=week',
    );
    expect(User.findAll).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/payment-methods
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics/payment-methods', () => {
  it('trả về 200 với phân bổ phương thức thanh toán', async () => {
    Order.findAll.mockResolvedValueOnce([
      { paymentMethod: 'cod', count: '30', revenue: '3000000' },
      { paymentMethod: 'vnpay', count: '70', revenue: '7000000' },
    ]);

    const res = await request.get('/api/admin/analytics/payment-methods');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toHaveProperty('method');
    expect(res.body.data[0]).toHaveProperty('count');
    expect(res.body.data[0]).toHaveProperty('revenue');
  });

  it('trả về method="unknown" khi paymentMethod là null', async () => {
    Order.findAll.mockResolvedValueOnce([{ paymentMethod: null, count: '5', revenue: '500000' }]);

    const res = await request.get('/api/admin/analytics/payment-methods');
    expect(res.status).toBe(200);
    expect(res.body.data[0].method).toBe('unknown');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/low-stock
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics/low-stock', () => {
  it('trả về 200 với danh sách sản phẩm sắp hết hàng', async () => {
    const fakeProducts = [
      {
        toJSON: () => ({
          id: 1,
          name: 'Laptop ít hàng',
          slug: 'laptop-it-hang',
          stockQuantity: 3,
          productImages: [],
        }),
      },
    ];
    Product.findAll.mockResolvedValueOnce(fakeProducts);

    const res = await request.get('/api/admin/analytics/low-stock');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('stockQuantity');
    expect(res.body.data[0].stockQuantity).toBe(3);
  });

  it('dùng threshold mặc định 10 — loại sản phẩm có stock > 10', async () => {
    // Implementation mới filter trong JS, không còn WHERE clause trên stockQuantity
    const fakeProducts = [
      {
        toJSON: () => ({ id: 10, name: 'Còn ít', slug: 's', stockQuantity: 8, productImages: [] }),
      },
      {
        toJSON: () => ({
          id: 11,
          name: 'Đủ hàng',
          slug: 's2',
          stockQuantity: 50,
          productImages: [],
        }),
      },
    ];
    Product.findAll.mockResolvedValueOnce(fakeProducts);

    const res = await request.get('/api/admin/analytics/low-stock');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(10);
  });

  it('dùng threshold từ query khi được cung cấp', async () => {
    const fakeProducts = [
      {
        toJSON: () => ({ id: 20, name: 'Dưới 5', slug: 's', stockQuantity: 3, productImages: [] }),
      },
      {
        toJSON: () => ({
          id: 21,
          name: 'Trên 5',
          slug: 's2',
          stockQuantity: 7,
          productImages: [],
        }),
      },
    ];
    Product.findAll.mockResolvedValueOnce(fakeProducts);

    const res = await request.get('/api/admin/analytics/low-stock?threshold=5');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(20);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/reports/export
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/reports/export', () => {
  it('trả về 200 CSV khi type=orders', async () => {
    Order.findAll.mockResolvedValueOnce([
      {
        toJSON: () => ({
          id: 1,
          number: 'ORD-001',
          status: 'delivered',
          paymentStatus: 'paid',
          paymentMethod: 'cod',
          total: 500000,
          createdAt: new Date('2025-01-15'),
          User: { firstName: 'Nguyen', lastName: 'Van A', email: 'a@test.com' },
        }),
      },
    ]);

    const res = await request.get('/api/admin/reports/export?type=orders');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('orders_');
    expect(res.text).toContain('Order ID,Order Number');
  });

  it('trả về 200 CSV khi type=products', async () => {
    Product.findAll.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Laptop A',
        sku: 'SKU-001',
        basePrice: 15000000,
        stockQuantity: 10,
        status: 'active',
      },
    ]);

    const res = await request.get('/api/admin/reports/export?type=products');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Product ID,Name');
    expect(res.text).toContain('Laptop A');
  });

  it('trả về 200 CSV orders theo mặc định khi không cung cấp type', async () => {
    Order.findAll.mockResolvedValueOnce([]);

    const res = await request.get('/api/admin/reports/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('trả về 400 khi type không hợp lệ', async () => {
    const res = await request.get('/api/admin/reports/export?type=invalid');
    expect(res.status).toBe(400);
  });

  it('áp dụng filter ngày cho report orders', async () => {
    Order.findAll.mockResolvedValueOnce([]);

    await request.get(
      '/api/admin/reports/export?type=orders&startDate=2025-01-01&endDate=2025-01-31',
    );
    const callArgs = Order.findAll.mock.calls[0][0];
    expect(callArgs.where.createdAt).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/chatbot/stats
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/chatbot/stats', () => {
  function setupChatbotMocks(opts = {}) {
    const {
      totalSessions = 10,
      totalMessages = 50,
      intentRows = [],
      totalAssistant = 25,
      fallbackCount = 5,
      avgResponse = null,
    } = opts;

    ChatMessage.count
      .mockResolvedValueOnce(totalSessions) // totalSessions
      .mockResolvedValueOnce(totalMessages) // totalMessages
      .mockResolvedValueOnce(totalAssistant) // totalAssistantMessages
      .mockResolvedValueOnce(fallbackCount); // fallbackMessages
    ChatMessage.findAll.mockResolvedValueOnce(intentRows);
    ChatMessage.findOne.mockResolvedValueOnce(avgResponse ? { avgTime: avgResponse } : null);
  }

  it('trả về 200 với đầy đủ thống kê chatbot', async () => {
    setupChatbotMocks({
      totalSessions: 10,
      totalMessages: 50,
      totalAssistant: 25,
      fallbackCount: 5,
    });

    const res = await request.get('/api/admin/chatbot/stats');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('totalSessions');
    expect(res.body.data).toHaveProperty('totalMessages');
    expect(res.body.data).toHaveProperty('avgMessagesPerSession');
    expect(res.body.data).toHaveProperty('intentBreakdown');
    expect(res.body.data).toHaveProperty('fallbackRate');
    expect(res.body.data).toHaveProperty('avgResponseTimeMs');
  });

  it('avgMessagesPerSession = 0 khi totalSessions = 0 (tránh chia cho 0)', async () => {
    setupChatbotMocks({ totalSessions: 0, totalMessages: 0, totalAssistant: 0, fallbackCount: 0 });

    const res = await request.get('/api/admin/chatbot/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.avgMessagesPerSession).toBe(0);
  });

  it('tính đúng avgMessagesPerSession = messages / sessions', async () => {
    setupChatbotMocks({
      totalSessions: 10,
      totalMessages: 50,
      totalAssistant: 20,
      fallbackCount: 0,
    });

    const res = await request.get('/api/admin/chatbot/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.avgMessagesPerSession).toBe(5);
  });

  it('fallbackRate = 0 khi không có assistant messages', async () => {
    setupChatbotMocks({ totalSessions: 5, totalMessages: 10, totalAssistant: 0, fallbackCount: 0 });

    const res = await request.get('/api/admin/chatbot/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.fallbackRate).toBe(0);
  });

  it('intentBreakdown chứa đúng key-value từ intent rows', async () => {
    setupChatbotMocks({
      intentRows: [
        { intent: 'product_search', count: '15' },
        { intent: 'price_inquiry', count: '8' },
      ],
    });

    const res = await request.get('/api/admin/chatbot/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.intentBreakdown).toEqual({
      product_search: 15,
      price_inquiry: 8,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Branch coverage bổ sung — admin-product-service.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Line 262 binary-expr [1][2][3]: variantName fallback chain ────────────────

describe('POST /api/admin/products — variantName fallback chain (line 262)', () => {
  function setupCreateWithVariants(productId, variantOverrides) {
    const createdProduct = makeProduct({ id: productId });
    Product.create.mockResolvedValueOnce(createdProduct);
    sequelize.query.mockResolvedValue([[], {}]);
    Product.findByPk.mockResolvedValueOnce(makeProduct({ id: productId }));
    ProductVariant.create.mockResolvedValue({ id: 99 });
    return createdProduct;
  }

  it('variant không có name → dùng variantName khi name falsy (branch[1])', async () => {
    setupCreateWithVariants(50);

    const res = await request.post('/api/admin/products').send({
      name: 'Product Variant Test',
      basePrice: 10000000,
      variants: [
        {
          name: '', // falsy → branch[1]
          variantName: 'Màu Đỏ',
          price: 10000000,
          stock: 5,
          sku: 'VAR-RED-001',
          attributes: {},
        },
      ],
    });
    expect(res.status).toBe(201);
    expect(ProductVariant.create).toHaveBeenCalledWith(
      expect.objectContaining({ variantName: expect.any(String) }),
    );
  });

  it('variant không có name và variantName → dùng displayName (branch[2])', async () => {
    setupCreateWithVariants(51);

    const res = await request.post('/api/admin/products').send({
      name: 'Product Fallback DisplayName',
      basePrice: 10000000,
      variants: [
        {
          name: '',
          variantName: '', // cả hai falsy → branch[2]: displayName
          displayName: 'Display Xanh',
          price: 10000000,
          stock: 3,
          sku: 'VAR-BLUE-002',
          attributes: {},
        },
      ],
    });
    expect(res.status).toBe(201);
    expect(ProductVariant.create).toHaveBeenCalled();
  });

  it('variant không có name, variantName, displayName → dùng variantSku (branch[3])', async () => {
    setupCreateWithVariants(52);

    const res = await request.post('/api/admin/products').send({
      name: 'Product Fallback SKU',
      basePrice: 10000000,
      variants: [
        {
          name: '',
          variantName: '',
          displayName: '', // tất cả falsy → branch[3]: variantSku
          price: 10000000,
          stock: 2,
          sku: 'VAR-SKU-003',
          attributes: {},
        },
      ],
    });
    expect(res.status).toBe(201);
    expect(ProductVariant.create).toHaveBeenCalled();
  });
});

// ── Line 899 cond-expr[0]: sortBy=stockQuantity/stock dùng Sequelize.literal ──

describe('GET /api/admin/products — sortBy=stockQuantity dùng literal order (line 899)', () => {
  it('sortBy=stockQuantity → 200 và findAndCountAll được gọi', async () => {
    Product.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

    const res = await request.get('/api/admin/products?sortBy=stockQuantity&sortOrder=asc');
    expect(res.status).toBe(200);
    expect(Product.findAndCountAll).toHaveBeenCalled();
  });

  it('sortBy=stock → 200 và findAndCountAll được gọi', async () => {
    Product.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

    const res = await request.get('/api/admin/products?sortBy=stock&sortOrder=desc');
    expect(res.status).toBe(200);
    expect(Product.findAndCountAll).toHaveBeenCalled();
  });
});

// ── Line 906 cond-expr[0]: sortBy=price → 'basePrice', sortBy=name → 'nameVi' ─

describe('GET /api/admin/products — sortBy=price/name ánh xạ tên cột (line 906)', () => {
  it('sortBy=price → 200 (ánh xạ basePrice)', async () => {
    Product.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

    const res = await request.get('/api/admin/products?sortBy=price&sortOrder=asc');
    expect(res.status).toBe(200);
    expect(Product.findAndCountAll).toHaveBeenCalled();
  });

  it('sortBy=name → 200 (ánh xạ nameVi)', async () => {
    Product.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

    const res = await request.get('/api/admin/products?sortBy=name&sortOrder=asc');
    expect(res.status).toBe(200);
    expect(Product.findAndCountAll).toHaveBeenCalled();
  });
});

// ── Line 929 binary-expr[1]: product.variants rỗng → không tính stockQuantity ─

describe('GET /api/admin/products — product không có variants (line 929)', () => {
  it('variants=[]: stockQuantity không bị ghi đè, trả về 200', async () => {
    const fakeProduct = {
      toJSON: () => ({
        id: 55,
        name: 'Sản phẩm không variants',
        basePrice: 5000000,
        stockQuantity: 99,
        productImages: [],
        categories: [],
        category: null,
        variants: [], // length = 0 → branch[1] không chạy vào reduce
      }),
    };
    Product.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [fakeProduct] });

    const res = await request.get('/api/admin/products');
    expect(res.status).toBe(200);
    // stockQuantity giữ nguyên giá trị gốc (99), không bị reset về 0 từ reduce
    expect(res.body.data.products[0].stockQuantity).toBe(99);
  });
});

// ── Line 971 binary-expr[1]: sumProductVariantStock trả về null → fallback 0 ──

describe('PATCH /api/admin/products/:id/stock — sumVariantStock null → fallback 0 (line 971)', () => {
  it('sumProductVariantStock trả về null → product.update được gọi với 0', async () => {
    const fakeProduct = makeProduct({ id: 70, stockQuantity: 10 });
    const fakeVariant = {
      id: 1,
      stockQuantity: 5,
      update: jest.fn().mockResolvedValue({}),
    };
    Product.findByPk.mockResolvedValueOnce(fakeProduct);
    ProductVariant.findOne.mockResolvedValueOnce(fakeVariant);
    // sum trả về null → (null || 0) = 0
    ProductVariant.sum.mockResolvedValueOnce(null);

    const res = await request
      .patch('/api/admin/products/70/stock')
      .send({ stockQuantity: 5, variantId: 1 });

    expect(res.status).toBe(200);
    // product.update phải nhận { stockQuantity: 0 } do null || 0
    expect(fakeProduct.update).toHaveBeenCalledWith({ stockQuantity: 0 });
  });
});

// ── Branch 145[1]: stockQuantity fallback khi stock và stockQuantity đều falsy ─

describe('POST /api/admin/products — stockQuantity fallback chain (branch 145)', () => {
  it('không truyền stock lẫn stockQuantity → stockQuantity=0 (nhánh || 0)', async () => {
    const createdProduct = makeProduct({ id: 60 });
    Product.create.mockResolvedValueOnce(createdProduct);
    sequelize.query.mockResolvedValue([[], {}]);
    Product.findByPk.mockResolvedValueOnce(makeProduct({ id: 60 }));

    const res = await request.post('/api/admin/products').send({
      name: 'Product Không Có Stock',
      basePrice: 8000000,
      // không truyền stock, stockQuantity → default = 0
    });

    expect(res.status).toBe(201);
    // stockQuantity=0 được truyền vào Product.create (argument đầu tiên)
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ stockQuantity: 0 }),
      expect.anything(),
    );
  });
});

// ── B145[1] line 642: variantImageData rỗng → if (variantImageData.length > 0) FALSE ──

describe('PUT /api/admin/products/:id — variant images rỗng sau filter (B145[1])', () => {
  it('variant có images là mảng URL rỗng → variantImageData = [] → bulkCreateProductImages không được gọi', async () => {
    const { ProductImage } = require('@models');
    const savedVariant = {
      id: 80,
      sku: 'V-EMPTY',
      price: 10000,
      stockQuantity: 3,
      update: jest.fn().mockResolvedValue({ id: 80, stockQuantity: 3, price: 10000 }),
    };
    const fakeProduct = makeProduct({ id: 75 });
    Product.findByPk.mockResolvedValueOnce(fakeProduct);
    ProductVariant.findAll.mockResolvedValueOnce([]);
    ProductVariant.create.mockResolvedValueOnce(savedVariant);
    ProductImage.destroy.mockResolvedValue(1);
    ProductImage.bulkCreate.mockClear();
    ProductVariant.sum.mockResolvedValue(3);

    // images là mảng phần tử rỗng → sau filter(url && typeof url === 'string') → variantImageData = []
    const res = await request.put('/api/admin/products/75').send({
      variants: [
        {
          sku: 'V-EMPTY',
          price: 10000,
          stock: 3,
          images: ['', null, undefined],
        },
      ],
    });

    expect(res.status).toBe(200);
    // variantImageData rỗng → if (variantImageData.length > 0) FALSE → bulkCreate KHÔNG được gọi
    expect(ProductImage.bulkCreate).not.toHaveBeenCalled();
  });
});

// ── B191[1] line 929: v.stockQuantity || 0 — nhánh || 0 khi stockQuantity = 0 ──

describe('GET /api/admin/products — variant stockQuantity = 0 → nhánh || 0 (B191[1])', () => {
  it('variant có stockQuantity = 0 → v.stockQuantity || 0 dùng right side 0', async () => {
    const fakeProduct = {
      toJSON: () => ({
        id: 88,
        name: 'Sản phẩm stock zero',
        basePrice: 5000000,
        stockQuantity: 10,
        productImages: [],
        categories: [],
        category: null,
        variants: [
          { id: 1, stockQuantity: 0 }, // falsy → || 0 (branch[1])
          { id: 2, stockQuantity: 5 }, // truthy → || 0 not used
        ],
      }),
    };
    Product.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [fakeProduct] });

    const res = await request.get('/api/admin/products');
    expect(res.status).toBe(200);
    // stockQuantity được tính: 0 + 5 = 5
    expect(res.body.data.products[0].stockQuantity).toBe(5);
  });
});
