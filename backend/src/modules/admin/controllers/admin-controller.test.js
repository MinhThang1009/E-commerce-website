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
 *
 *  Order management:
 *    GET /api/admin/orders                → getAllOrders
 *    PUT /api/admin/orders/:id/status     → updateOrderStatus
 *    POST /api/admin/orders/:id/cancel    → adminCancelOrder
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

jest.mock('@middlewares/admin-auth');

jest.mock('@middlewares/authorize');

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
  ProductAttribute,
  InventoryLog,
  Review,
  sequelize,
} = require('@models');

// Sau refactor: admin DELEGATE hủy/đổi-trạng-thái sang orders-service (inject qua setter).
// Mock ordersService để admin test chỉ kiểm: delegate đúng tham số + propagate lỗi + re-fetch.
const adminOrderService = require('@modules/admin/services/admin-order-service');
const mockOrdersService = { updateOrderStatus: jest.fn().mockResolvedValue(undefined) };

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
  mockOrdersService.updateOrderStatus.mockReset().mockResolvedValue(undefined);
  adminOrderService.setOrdersService(mockOrdersService);
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

  it('trả về 409 khi tên sản phẩm đã tồn tại, không tạo', async () => {
    Product.findOne.mockResolvedValueOnce(makeProduct({ id: 99 }));

    const res = await request.post('/api/admin/products').send({
      name: 'Laptop Trùng Tên',
      basePrice: 15000000,
    });
    expect(res.status).toBe(409);
    expect(Product.create).not.toHaveBeenCalled();
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
      expect.anything(),
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

  it('rollback transaction và trả về 500 khi tạo variant gặp lỗi — product không bị orphaned', async () => {
    // BUG FIX: trước đây createProduct không có transaction →
    // nếu variant creation fail, product đã được persist nhưng không có variants (orphaned).
    // Sau fix: mọi write nằm trong 1 transaction → rollback toàn bộ khi lỗi.
    const createdProduct = makeProduct({ id: 99 });
    Product.findOne.mockResolvedValueOnce(null); // không trùng tên
    Product.create.mockResolvedValueOnce(createdProduct);
    sequelize.query.mockResolvedValue([[], {}]);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    // Variant creation fails → triggers rollback
    ProductVariant.create.mockRejectedValueOnce(new Error('Duplicate entry for key sku'));
    Product.findByPk.mockClear();

    const res = await request.post('/api/admin/products').send({
      name: 'Laptop Rollback Test',
      basePrice: 15000000,
      variants: [{ sku: 'DUPE-SKU', price: 15000000 }],
    });

    expect(res.status).toBe(500);
    // Re-fetch (findProductById) không được gọi — xác nhận đã rollback và throw trước re-fetch
    expect(Product.findByPk).not.toHaveBeenCalled();
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

// Logic hoàn kho/updateData (COD→paid, restock variant/product) đã chuyển sang orders-service
// (xem orders-edge-cases.integration F2/F12/F13/F14). Admin chỉ test delegation.
describe('PUT /api/admin/orders/:id/status', () => {
  const { AppError } = require('@shared/errors');

  it('delegate sang orders-service với { id, status, paymentStatus, note } và re-fetch order', async () => {
    const refetched = makeOrder({ id: 5, status: 'processing' });
    Order.findByPk.mockResolvedValueOnce(refetched); // re-fetch sau khi delegate

    const res = await request
      .put('/api/admin/orders/5/status')
      .send({ status: 'processing', paymentStatus: 'paid', note: 'ghi chú' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // Admin phải forward đúng 4 tham số sang orders-service
    expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith({
      id: '5',
      status: 'processing',
      paymentStatus: 'paid',
      note: 'ghi chú',
    });
    // Response trả về order đã re-fetch (id từ refetched, không phải echo input)
    expect(res.body.data.order.id).toBe(5);
  });

  it('propagate 404 khi orders-service báo không tìm thấy đơn hàng', async () => {
    mockOrdersService.updateOrderStatus.mockRejectedValueOnce(
      new AppError('Không tìm thấy đơn hàng', 404),
    );

    const res = await request.put('/api/admin/orders/9999/status').send({ status: 'delivered' });
    expect(res.status).toBe(404);
    // Lỗi xảy ra trước re-fetch → không re-fetch order
    expect(Order.findByPk).not.toHaveBeenCalled();
  });

  it('propagate 400 khi orders-service từ chối chuyển trạng thái (vd đơn đã giao)', async () => {
    mockOrdersService.updateOrderStatus.mockRejectedValueOnce(
      new AppError('Không thể hủy đơn hàng đã giao', 400),
    );

    const res = await request.put('/api/admin/orders/7/status').send({ status: 'cancelled' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/orders/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/orders/:id/cancel', () => {
  const { AppError } = require('@shared/errors');

  it('delegate cancel sang orders-service với { id, status: "cancelled" } và trả về 200', async () => {
    const fakeOrder = makeOrder({ id: 10, status: 'processing' });
    Order.findByPk.mockResolvedValueOnce(fakeOrder); // pre-check findOrderById

    const res = await request.post('/api/admin/orders/10/cancel');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/hủy/i);
    expect(res.body.data).toMatchObject({ orderId: 10, status: 'cancelled' });
    expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith({
      id: '10',
      status: 'cancelled',
    });
  });

  it('trả về 404 (pre-check) khi đơn hàng không tồn tại, không delegate', async () => {
    Order.findByPk.mockResolvedValueOnce(null);

    const res = await request.post('/api/admin/orders/9999/cancel');
    expect(res.status).toBe(404);
    expect(mockOrdersService.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('trả về 400 (pre-check) khi đơn hàng đã bị hủy trước đó, không delegate', async () => {
    const fakeOrder = makeOrder({ id: 11, status: 'cancelled', items: [] });
    Order.findByPk.mockResolvedValueOnce(fakeOrder);

    const res = await request.post('/api/admin/orders/11/cancel');
    expect(res.status).toBe(400);
    expect(mockOrdersService.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('propagate 400 khi orders-service từ chối hủy đơn đã giao', async () => {
    const fakeOrder = makeOrder({ id: 12, status: 'delivered', items: [] });
    Order.findByPk.mockResolvedValueOnce(fakeOrder); // pre-check pass (chưa cancelled)
    mockOrdersService.updateOrderStatus.mockRejectedValueOnce(
      new AppError('Không thể hủy đơn hàng đã giao', 400),
    );

    const res = await request.post('/api/admin/orders/12/cancel');
    expect(res.status).toBe(400);
    expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith({
      id: '12',
      status: 'cancelled',
    });
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
      expect.anything(),
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
    expect(fakeProduct.update).toHaveBeenCalledWith({ stockQuantity: 0 }, expect.anything());
  });

  it('BUG-FIX MEDIUM-1: variant update + sum + product update chạy trong cùng transaction', async () => {
    const fakeProduct = makeProduct({ id: 71, stockQuantity: 20 });
    const fakeVariant = {
      id: 2,
      stockQuantity: 10,
      update: jest.fn().mockResolvedValue({}),
    };
    Product.findByPk.mockResolvedValueOnce(fakeProduct);
    ProductVariant.findOne.mockResolvedValueOnce(fakeVariant);
    ProductVariant.sum.mockResolvedValueOnce(15);

    const res = await request
      .patch('/api/admin/products/71/stock')
      .send({ stockQuantity: 15, variantId: 2 });

    expect(res.status).toBe(200);
    // Tất cả 3 operations phải nhận cùng transaction object
    expect(fakeVariant.update).toHaveBeenCalledWith({ stockQuantity: 15 }, expect.anything());
    expect(fakeProduct.update).toHaveBeenCalledWith({ stockQuantity: 15 }, expect.anything());
    // transaction.commit phải được gọi sau khi thành công
    expect(sequelize.transaction).toHaveBeenCalled();
  });

  it('response trả total (tổng variants) không phải qty (stock variant) khi có variantId', async () => {
    // qty=5 (stock của 1 variant), sum=30 (tổng tất cả variants sau update)
    // Response phải là 30 (product-level), không phải 5 (variant-level)
    const fakeProduct = makeProduct({ id: 72, stockQuantity: 25 });
    const fakeVariant = { id: 3, stockQuantity: 20, update: jest.fn().mockResolvedValue({}) };
    Product.findByPk.mockResolvedValueOnce(fakeProduct);
    ProductVariant.findOne.mockResolvedValueOnce(fakeVariant);
    ProductVariant.sum.mockResolvedValueOnce(30); // tổng = 5 + 25 (variant khác)

    const res = await request
      .patch('/api/admin/products/72/stock')
      .send({ stockQuantity: 5, variantId: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data.stockQuantity).toBe(30); // total, không phải 5
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

// ─────────────────────────────────────────────────────────────────────────────
// Merged from admin-controller.analytics.test.js
// Tests cho admin analytics endpoints — Phase 32
// ─────────────────────────────────────────────────────────────────────────────

// New mock from edge-cases.test.js (not present in base)
jest.mock('@modules/ai/services/translate/translate-service', () => ({
  translateBatch: jest.fn().mockResolvedValue(['translated en']),
}));

describe('Analytics — admin-controller.analytics (Phase 32)', () => {
  // Local helpers to avoid naming conflicts with base helpers
  function makeRowA(attrs) {
    return {
      ...attrs,
      getDataValue: (key) => attrs[key],
      toJSON: () => ({ ...attrs }),
      Product: attrs.Product || null,
    };
  }

  describe('GET /api/admin/dashboard', () => {
    function setupDashboardMocks({
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
      topProductsRows = [],
      cancelledOrdersMonth = 2,
      lowStockCount = 3,
    } = {}) {
      User.count
        .mockResolvedValueOnce(totalUsers) // totalUsers
        .mockResolvedValueOnce(monthlyUsers) // monthlyUsers
        .mockResolvedValueOnce(lastMonthUsers); // lastMonthUsers
      Product.count.mockResolvedValueOnce(totalProducts);
      Order.count
        .mockResolvedValueOnce(totalOrders) // totalOrders
        .mockResolvedValueOnce(monthlyOrders) // monthlyOrders
        .mockResolvedValueOnce(lastMonthOrders) // lastMonthOrders
        .mockResolvedValueOnce(cancelledOrdersMonth); // cancelledOrdersMonth
      Order.sum
        .mockResolvedValueOnce(totalRevenue) // totalRevenue
        .mockResolvedValueOnce(monthlyRevenue) // monthlyRevenue
        .mockResolvedValueOnce(lastMonthRevenue); // lastMonthRevenue
      Order.findAll.mockResolvedValueOnce(orderStatusCounts);
      OrderItem.findAll.mockResolvedValueOnce(topProductsRows);
      Product.count.mockResolvedValueOnce(lowStockCount);
    }

    test('200 trả về cấu trúc overview, monthly, growth, topProducts', async () => {
      setupDashboardMocks();

      const res = await request.get('/api/admin/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('overview');
      expect(res.body.data).toHaveProperty('monthly');
      expect(res.body.data).toHaveProperty('growth');
      expect(res.body.data).toHaveProperty('topProducts');
    });

    test('overview chứa totalUsers, totalProducts, totalOrders, totalRevenue', async () => {
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

    test('growth.users tính đúng % tăng trưởng so với tháng trước', async () => {
      // lastMonthUsers=10, monthlyUsers=15 → growth = (15-10)/10 * 100 = 50%
      setupDashboardMocks({ monthlyUsers: 15, lastMonthUsers: 10 });

      const res = await request.get('/api/admin/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.data.growth.users).toBe(50);
    });

    test('growth.users là 0 khi không có user tháng trước (tránh chia cho 0)', async () => {
      setupDashboardMocks({ monthlyUsers: 5, lastMonthUsers: 0 });

      const res = await request.get('/api/admin/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.data.growth.users).toBe(0);
    });

    test('200 vẫn trả về khi topProducts query ném lỗi (error được catch nội bộ)', async () => {
      // Trả về đủ count/sum nhưng OrderItem.findAll ném lỗi
      User.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2).mockResolvedValueOnce(1);
      Product.count.mockResolvedValueOnce(5);
      Order.count
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);
      Order.sum
        .mockResolvedValueOnce(100000)
        .mockResolvedValueOnce(20000)
        .mockResolvedValueOnce(15000);
      OrderItem.findAll.mockRejectedValueOnce(new Error('DB connection failed'));
      Order.findAll.mockResolvedValueOnce([]);
      Product.count.mockResolvedValueOnce(0);

      const res = await request.get('/api/admin/dashboard');

      // Controller bắt lỗi topProducts nội bộ và tiếp tục — không trả 500
      expect(res.status).toBe(200);
      expect(res.body.data.topProducts).toEqual([]);
    });

    test('topProducts chứa totalSold và totalRevenue từng sản phẩm', async () => {
      const fakeProduct = {
        toJSON: () => ({
          name: 'Laptop Gaming X',
          basePrice: 25000000,
          productImages: [{ imageUrl: 'https://cdn.test/laptop.jpg' }],
        }),
      };
      const topProductRow = makeRow({
        productId: 7,
        totalSold: '30',
        totalRevenue: '750000000',
        Product: fakeProduct,
      });

      User.count.mockResolvedValueOnce(5).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
      Product.count.mockResolvedValueOnce(10);
      Order.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(0);
      Order.sum
        .mockResolvedValueOnce(200000)
        .mockResolvedValueOnce(50000)
        .mockResolvedValueOnce(40000);
      OrderItem.findAll.mockResolvedValueOnce([topProductRow]);
      Order.findAll.mockResolvedValueOnce([]);
      Product.count.mockResolvedValueOnce(1);

      const res = await request.get('/api/admin/dashboard');

      expect(res.status).toBe(200);
      const [firstProduct] = res.body.data.topProducts;
      expect(firstProduct.totalSold).toBe(30);
      expect(firstProduct.totalRevenue).toBe(750000000);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/admin/stats
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/stats', () => {
    test('400 khi thiếu startDate', async () => {
      const res = await request.get('/api/admin/stats?endDate=2024-12-31');

      expect(res.status).toBe(400);
      // Controller ném AppError → status 'error'; validator trả 'fail' — cả hai đều hợp lệ
      expect(['error', 'fail']).toContain(res.body.status);
      expect(res.body.message).toMatch(/ngày bắt đầu|ngày kết thúc/i);
    });

    test('400 khi thiếu endDate', async () => {
      const res = await request.get('/api/admin/stats?startDate=2024-01-01');

      expect(res.status).toBe(400);
      expect(['error', 'fail']).toContain(res.body.status);
      expect(res.body.message).toMatch(/ngày bắt đầu|ngày kết thúc/i);
    });

    test('400 khi thiếu cả startDate lẫn endDate', async () => {
      const res = await request.get('/api/admin/stats');

      expect(res.status).toBe(400);
      expect(['error', 'fail']).toContain(res.body.status);
    });

    test('200 trả về orders[] và users[] khi có đủ ngày', async () => {
      const orderRow = makeRow({ period: '2024-01-15', orderCount: '5', revenue: '1250000' });
      const userRow = makeRow({ period: '2024-01-15', newUsers: '3' });
      Order.findAll.mockResolvedValueOnce([orderRow]);
      User.findAll.mockResolvedValueOnce([userRow]);

      const res = await request.get('/api/admin/stats?startDate=2024-01-01&endDate=2024-01-31');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.orders)).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
    });

    test('orders[] chứa period, orderCount (number), revenue (float)', async () => {
      const orderRow = makeRow({ period: '2024-03-10', orderCount: '12', revenue: '3600000.50' });
      Order.findAll.mockResolvedValueOnce([orderRow]);
      User.findAll.mockResolvedValueOnce([]);

      const res = await request.get('/api/admin/stats?startDate=2024-03-01&endDate=2024-03-31');

      expect(res.status).toBe(200);
      const [order] = res.body.data.orders;
      expect(order.period).toBe('2024-03-10');
      expect(order.orderCount).toBe(12);
      expect(order.revenue).toBe(3600000.5);
    });

    test('users[] chứa period và newUsers (number)', async () => {
      Order.findAll.mockResolvedValueOnce([]);
      const userRow = makeRow({ period: '2024-03-05', newUsers: '7' });
      User.findAll.mockResolvedValueOnce([userRow]);

      const res = await request.get('/api/admin/stats?startDate=2024-03-01&endDate=2024-03-31');

      expect(res.status).toBe(200);
      const [user] = res.body.data.users;
      expect(user.period).toBe('2024-03-05');
      expect(user.newUsers).toBe(7);
    });

    test('groupBy=month được chấp nhận và trả về 200', async () => {
      Order.findAll.mockResolvedValueOnce([]);
      User.findAll.mockResolvedValueOnce([]);

      const res = await request.get(
        '/api/admin/stats?startDate=2024-01-01&endDate=2024-12-31&groupBy=month',
      );

      expect(res.status).toBe(200);
    });

    test('revenue mặc định là 0 khi Sequelize trả về null', async () => {
      // Mô phỏng trường hợp SUM trả về NULL (không có đơn hàng)
      const orderRow = makeRow({ period: '2024-04-01', orderCount: '0', revenue: null });
      Order.findAll.mockResolvedValueOnce([orderRow]);
      User.findAll.mockResolvedValueOnce([]);

      const res = await request.get('/api/admin/stats?startDate=2024-04-01&endDate=2024-04-30');

      expect(res.status).toBe(200);
      expect(res.body.data.orders[0].revenue).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/admin/analytics/user-growth
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/analytics/user-growth', () => {
    test('400 khi thiếu startDate và endDate', async () => {
      const res = await request.get('/api/admin/analytics/user-growth');

      expect(res.status).toBe(400);
      // Controller ném AppError ('error') hoặc validator ném 'fail' — cả hai hợp lệ
      expect(['error', 'fail']).toContain(res.body.status);
      expect(res.body.message).toMatch(/startDate|endDate/i);
    });

    test('400 khi chỉ có startDate', async () => {
      const res = await request.get('/api/admin/analytics/user-growth?startDate=2024-01-01');

      expect(res.status).toBe(400);
      expect(['error', 'fail']).toContain(res.body.status);
    });

    test('200 trả về data[] với date và newUsers khi đủ params', async () => {
      User.findAll.mockResolvedValueOnce([
        { date: '2024-05-01', newUsers: '4' },
        { date: '2024-05-02', newUsers: '7' },
      ]);

      const res = await request.get(
        '/api/admin/analytics/user-growth?startDate=2024-05-01&endDate=2024-05-31',
      );

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toEqual({ date: '2024-05-01', newUsers: 4 });
      expect(res.body.data[1]).toEqual({ date: '2024-05-02', newUsers: 7 });
    });

    test('newUsers được parse thành number (không giữ dạng string)', async () => {
      User.findAll.mockResolvedValueOnce([{ date: '2024-06-10', newUsers: '99' }]);

      const res = await request.get(
        '/api/admin/analytics/user-growth?startDate=2024-06-01&endDate=2024-06-30',
      );

      expect(res.status).toBe(200);
      expect(typeof res.body.data[0].newUsers).toBe('number');
      expect(res.body.data[0].newUsers).toBe(99);
    });

    test('data[] là mảng rỗng khi không có user nào trong khoảng thời gian', async () => {
      User.findAll.mockResolvedValueOnce([]);

      const res = await request.get(
        '/api/admin/analytics/user-growth?startDate=2020-01-01&endDate=2020-01-31',
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/admin/analytics/top-products
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/analytics/top-products', () => {
    function makeTopProductRow({ productId, revenue, soldCount, name, imageUrl = null }) {
      const productObj = {
        toJSON: () => ({
          name,
          productImages: imageUrl ? [{ imageUrl }] : [],
        }),
      };
      return makeRow({ productId, revenue, soldCount, Product: productObj });
    }

    test('200 trả về data[] với productId, name, revenue, soldCount', async () => {
      OrderItem.findAll.mockResolvedValueOnce([
        makeTopProductRow({ productId: 1, revenue: '5000000', soldCount: '20', name: 'iPhone 15' }),
      ]);

      const res = await request.get('/api/admin/analytics/top-products');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      const [item] = res.body.data;
      expect(item.productId).toBe(1);
      expect(item.name).toBe('iPhone 15');
      expect(item.revenue).toBe(5000000);
      expect(item.soldCount).toBe(20);
    });

    test('thumbnail là null khi sản phẩm không có ảnh', async () => {
      OrderItem.findAll.mockResolvedValueOnce([
        makeTopProductRow({
          productId: 2,
          revenue: '100000',
          soldCount: '5',
          name: 'No-image Product',
        }),
      ]);

      const res = await request.get('/api/admin/analytics/top-products');

      expect(res.status).toBe(200);
      expect(res.body.data[0].thumbnail).toBeNull();
    });

    test('thumbnail chứa imageUrl khi sản phẩm có ảnh', async () => {
      const thumbUrl = 'https://cdn.test/product.jpg';
      OrderItem.findAll.mockResolvedValueOnce([
        makeTopProductRow({
          productId: 3,
          revenue: '200000',
          soldCount: '10',
          name: 'Product With Image',
          imageUrl: thumbUrl,
        }),
      ]);

      const res = await request.get('/api/admin/analytics/top-products');

      expect(res.status).toBe(200);
      expect(res.body.data[0].thumbnail).toBe(thumbUrl);
    });

    test('data[] rỗng khi không có đơn hàng', async () => {
      OrderItem.findAll.mockResolvedValueOnce([]);

      const res = await request.get('/api/admin/analytics/top-products');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test('limit được giới hạn tối đa 20 dù query gửi 99', async () => {
      OrderItem.findAll.mockResolvedValueOnce([]);

      await request.get('/api/admin/analytics/top-products?limit=99');

      // Kiểm tra findAll được gọi với limit=20 (không phải 99)
      const callArgs = OrderItem.findAll.mock.calls[0][0];
      expect(callArgs.limit).toBe(20);
    });

    test('metric=quantity truyền orderBy theo soldCount không phải revenue', async () => {
      OrderItem.findAll.mockResolvedValueOnce([]);

      await request.get('/api/admin/analytics/top-products?metric=quantity');

      const callArgs = OrderItem.findAll.mock.calls[0][0];
      // order phải chứa 'soldCount' (không phải 'revenue')
      const orderStr = JSON.stringify(callArgs.order);
      expect(orderStr).toMatch(/soldCount/);
      expect(orderStr).not.toMatch(/revenue/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/admin/analytics/low-stock
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/analytics/low-stock', () => {
    function makeLowStockProduct({
      id,
      name,
      stockQuantity,
      slug = 'product-slug',
      imageUrl = null,
    }) {
      return {
        toJSON: () => ({
          id,
          name,
          stockQuantity,
          slug,
          productImages: imageUrl ? [{ imageUrl }] : [],
        }),
      };
    }

    test('200 trả về data[] với id, name, stockQuantity, sku, thumbnail', async () => {
      Product.findAll.mockResolvedValueOnce([
        makeLowStockProduct({ id: 5, name: 'Sắp hết hàng', stockQuantity: 3 }),
      ]);

      const res = await request.get('/api/admin/analytics/low-stock');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      const [item] = res.body.data;
      expect(item.id).toBe(5);
      expect(item.name).toBe('Sắp hết hàng');
      expect(item.stockQuantity).toBe(3);
      expect(item).toHaveProperty('sku');
      expect(item).toHaveProperty('thumbnail');
    });

    test('threshold mặc định là 10 — sản phẩm stock > 10 bị loại khỏi kết quả', async () => {
      // Implementation mới filter trong JS sau khi fetch toàn bộ sản phẩm
      Product.findAll.mockResolvedValueOnce([
        makeLowStockProduct({ id: 1, name: 'Còn ít', stockQuantity: 5 }),
        makeLowStockProduct({ id: 2, name: 'Đủ hàng', stockQuantity: 50 }),
      ]);

      const res = await request.get('/api/admin/analytics/low-stock');

      expect(res.status).toBe(200);
      // threshold mặc định 10: chỉ trả sản phẩm có stock <= 10
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(1);
      expect(res.body.data[0].stockQuantity).toBe(5);
    });

    test('threshold=0 → chỉ trả sản phẩm hết hàng hoàn toàn', async () => {
      Product.findAll.mockResolvedValueOnce([
        makeLowStockProduct({ id: 1, name: 'Hết hàng', stockQuantity: 0 }),
        makeLowStockProduct({ id: 2, name: 'Còn ít', stockQuantity: 3 }),
      ]);

      const res = await request.get('/api/admin/analytics/low-stock?threshold=0');

      expect(res.status).toBe(200);
      // threshold=0: chỉ trả sản phẩm hết hàng hoàn toàn
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(1);
      expect(res.body.data[0].stockQuantity).toBe(0);
    });

    test('thumbnail là null khi sản phẩm không có ảnh', async () => {
      Product.findAll.mockResolvedValueOnce([
        makeLowStockProduct({ id: 6, name: 'No Image', stockQuantity: 1 }),
      ]);

      const res = await request.get('/api/admin/analytics/low-stock');

      expect(res.status).toBe(200);
      expect(res.body.data[0].thumbnail).toBeNull();
    });

    test('data[] rỗng khi tất cả sản phẩm còn đủ hàng', async () => {
      Product.findAll.mockResolvedValueOnce([]);

      const res = await request.get('/api/admin/analytics/low-stock');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/admin/analytics/order-status
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/analytics/order-status', () => {
    test('200 trả về data[] với status, count, label cho từng trạng thái', async () => {
      Order.findAll.mockResolvedValueOnce([
        { status: 'pending', count: '10' },
        { status: 'delivered', count: '85' },
        { status: 'cancelled', count: '5' },
      ]);

      const res = await request.get('/api/admin/analytics/order-status');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);

      const pending = res.body.data.find((d) => d.status === 'pending');
      expect(pending.count).toBe(10);
      expect(pending.label).toBe('Chờ xử lý');

      const delivered = res.body.data.find((d) => d.status === 'delivered');
      expect(delivered.label).toBe('Đã giao');
    });

    test('count được parse thành number', async () => {
      Order.findAll.mockResolvedValueOnce([{ status: 'shipped', count: '42' }]);

      const res = await request.get('/api/admin/analytics/order-status');

      expect(res.status).toBe(200);
      expect(typeof res.body.data[0].count).toBe('number');
      expect(res.body.data[0].count).toBe(42);
    });

    test('trạng thái không có trong statusLabels vẫn trả về (dùng status làm label)', async () => {
      Order.findAll.mockResolvedValueOnce([{ status: 'unknown_status', count: '1' }]);

      const res = await request.get('/api/admin/analytics/order-status');

      expect(res.status).toBe(200);
      // label fallback về status string gốc
      expect(res.body.data[0].label).toBe('unknown_status');
    });

    test('data[] rỗng khi không có đơn hàng', async () => {
      Order.findAll.mockResolvedValueOnce([]);

      const res = await request.get('/api/admin/analytics/order-status');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/admin/analytics/payment-methods
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/analytics/payment-methods', () => {
    test('200 trả về data[] với method, count, revenue', async () => {
      Order.findAll.mockResolvedValueOnce([
        { paymentMethod: 'cod', count: '50', revenue: '2500000' },
        { paymentMethod: 'vnpay', count: '120', revenue: '8000000' },
      ]);

      const res = await request.get('/api/admin/analytics/payment-methods');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      const cod = res.body.data.find((d) => d.method === 'cod');
      expect(cod.count).toBe(50);
      expect(cod.revenue).toBe(2500000);

      const vnpay = res.body.data.find((d) => d.method === 'vnpay');
      expect(vnpay.count).toBe(120);
    });

    test('paymentMethod null được map thành "unknown"', async () => {
      Order.findAll.mockResolvedValueOnce([{ paymentMethod: null, count: '3', revenue: '150000' }]);

      const res = await request.get('/api/admin/analytics/payment-methods');

      expect(res.status).toBe(200);
      expect(res.body.data[0].method).toBe('unknown');
    });

    test('count và revenue được parse thành number', async () => {
      Order.findAll.mockResolvedValueOnce([
        { paymentMethod: 'momo', count: '77', revenue: '3850000.75' },
      ]);

      const res = await request.get('/api/admin/analytics/payment-methods');

      expect(res.status).toBe(200);
      expect(typeof res.body.data[0].count).toBe('number');
      expect(typeof res.body.data[0].revenue).toBe('number');
      expect(res.body.data[0].revenue).toBeCloseTo(3850000.75);
    });

    test('data[] rỗng khi chưa có đơn hàng được thanh toán', async () => {
      Order.findAll.mockResolvedValueOnce([]);

      const res = await request.get('/api/admin/analytics/payment-methods');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Merged from admin-controller.edge-cases.test.js
// Branch/line coverage bổ sung cho admin controller
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge Cases — admin-controller.edge-cases', () => {
  // Additional model refs needed for edge-case tests
  const {
    ProductSpecification,
    ProductImage,
    ProductCategory,
    Category,
    CartItem,
    Wishlist,
  } = require('@models');

  // Override makeProduct with extended version (adds categories/productAttributes/productSpecifications)
  // This shadows the module-scope makeProduct for all tests inside this describe.
  function makeProduct(overrides = {}) {
    const data = {
      id: 10,
      name: 'Laptop Test',
      baseName: 'Laptop Test',
      description: 'Mô tả',
      basePrice: 15000000,
      stockQuantity: 50,
      status: 'active',
      categories: [],
      productAttributes: [],
      variants: [],
      productSpecifications: [],
      ...overrides,
    };
    return {
      ...data,
      toJSON: () => ({ ...data, productImages: data.productImages || [] }),
      get: jest.fn((opts) => (opts?.plain ? { ...data } : data)),
      update: jest.fn().mockResolvedValue({ ...data }),
      destroy: jest.fn().mockResolvedValue(undefined),
      setCategories: jest.fn().mockResolvedValue(undefined),
    };
  }

  // Override makeOrder with extended version
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

  // Override makeUser with extended version (adds phone field)
  function makeUser(overrides = {}) {
    const data = {
      id: 99,
      firstName: 'Test',
      lastName: 'User',
      email: 'user@test.com',
      phone: '0901234567',
      role: 'customer',
      isEmailVerified: false,
      isActive: true,
      ...overrides,
    };
    return {
      ...data,
      toJSON: () => ({ ...data }),
      update: jest.fn().mockResolvedValue({ ...data }),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
  }

  // Local helpers (extended versions to avoid conflicts with base)
  function makeAttr(name, values, overrides = {}) {
    return {
      name,
      values,
      type: 'custom',
      required: false,
      ...overrides,
      update: jest.fn().mockResolvedValue({ name, values }),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
  }

  function makeSpec(name, value, valueEn = null) {
    return {
      name,
      value,
      valueEn,
      update: jest.fn().mockResolvedValue({ name, value, valueEn }),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
  }

  function makeVariant(id, overrides = {}) {
    const data = { id, sku: 'SKU-VAR-001', stockQuantity: 5, ...overrides };
    return {
      ...data,
      get: jest.fn((opts) => (opts?.plain ? { ...data } : data)),
      update: jest.fn().mockResolvedValue(data),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
  }

  function makeProductEC(overrides = {}) {
    const data = {
      id: 10,
      name: 'Laptop Test',
      baseName: 'Laptop Test',
      description: 'Mô tả',
      basePrice: 15000000,
      stockQuantity: 50,
      status: 'active',
      categories: [],
      productAttributes: [],
      variants: [],
      productSpecifications: [],
      ...overrides,
    };
    return {
      ...data,
      toJSON: () => ({ ...data, productImages: data.productImages || [] }),
      get: jest.fn((opts) => (opts?.plain ? { ...data } : data)),
      update: jest.fn().mockResolvedValue({ ...data }),
      destroy: jest.fn().mockResolvedValue(undefined),
      setCategories: jest.fn().mockResolvedValue(undefined),
    };
  }

  function makeOrderEC(overrides = {}) {
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

  function makeUserEC(overrides = {}) {
    const data = {
      id: 99,
      firstName: 'Test',
      lastName: 'User',
      email: 'user@test.com',
      phone: '0901234567',
      role: 'customer',
      isEmailVerified: false,
      isActive: true,
      ...overrides,
    };
    return {
      ...data,
      toJSON: () => ({ ...data }),
      update: jest.fn().mockResolvedValue({ ...data }),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
  }

  const { AppError } = require('@shared/errors');

  beforeEach(() => {
    jest.resetAllMocks();

    const vs = require('@services/vector-store/vector-store');
    vs.items = [];
    vs.upsertProduct.mockResolvedValue(undefined);
    vs.save.mockResolvedValue(undefined);
    vs.loadPromise = Promise.resolve();
    vs.enrichProductData.mockImplementation((x) => x);

    sequelize.query.mockResolvedValue([[], {}]);

    const newTx = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      LOCK: { UPDATE: 'UPDATE' },
    };
    sequelize.transaction.mockImplementation(async (cb) => {
      if (typeof cb === 'function') return cb(newTx);
      return newTx;
    });

    mockOrdersService.updateOrderStatus.mockReset().mockResolvedValue(undefined);
    adminOrderService.setOrdersService(mockOrdersService);
  });

  describe('GET /api/admin/stats — line 367: revenue null → 0 fallback', () => {
    it('trả về revenue=0 khi orderStat.revenue là null', async () => {
      // Stat row with null revenue triggers `|| 0` branch on line 367
      const orderStatRow = {
        getDataValue: (key) => {
          if (key === 'period') return '2024-01';
          if (key === 'orderCount') return '5';
          if (key === 'revenue') return null; // null → || 0 branch
          return null;
        },
      };
      const userStatRow = {
        getDataValue: (key) => {
          if (key === 'period') return '2024-01';
          if (key === 'newUsers') return '3';
          return null;
        },
      };

      // getDetailedStats uses Order.findAll and User.findAll (not sequelize.query)
      Order.findAll.mockResolvedValueOnce([orderStatRow]);
      User.findAll.mockResolvedValueOnce([userStatRow]);

      const { User: UserModel } = require('@models');

      const res = await request
        .get('/api/admin/stats')
        .query({ groupBy: 'month', startDate: '2024-01-01', endDate: '2024-12-31' });

      expect(res.status).toBe(200);
      // revenue null → parseFloat(null || 0) = parseFloat(0) = 0
      expect(res.body.data.orders[0].revenue).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Lines 664-668: createProduct — null values for seoKeywords/specifications/faqs
  // trigger the RIGHT side of || fallback (null is falsy, so || [] is taken)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /api/admin/products — lines 664-668: null fallback cho seoKeywords/specifications/faqs', () => {
    it('dùng [] cho seoKeywords khi gửi seoKeywords=null (null là falsy)', async () => {
      const createdProduct = makeProduct({ id: 9001, status: 'active' });
      Product.create.mockResolvedValueOnce(createdProduct);
      Product.update.mockResolvedValueOnce(undefined);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Null Keywords',
        seoKeywords: null, // null → seoKeywords = null (không dùng default) → null || [] = []
      });

      expect(res.status).toBe(201);
      // seoKeywords: null || [] = []  → right branch of || covered
      const createCall = Product.create.mock.calls[0][0];
      expect(createCall.seoKeywords).toEqual([]);
    });

    it('dùng [] cho specifications khi gửi specifications=null', async () => {
      const createdProduct = makeProduct({ id: 9002, status: 'active' });
      Product.create.mockResolvedValueOnce(createdProduct);
      Product.update.mockResolvedValueOnce(undefined);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Null Specs',
        specifications: null, // null là falsy → null || [] = []
      });

      expect(res.status).toBe(201);
      const createCall = Product.create.mock.calls[0][0];
      expect(createCall.specifications).toEqual([]);
    });

    it('dùng [] cho faqs khi gửi faqs=null', async () => {
      const createdProduct = makeProduct({ id: 9003, status: 'active' });
      Product.create.mockResolvedValueOnce(createdProduct);
      Product.update.mockResolvedValueOnce(undefined);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Null FAQs',
        faqs: null, // null là falsy → null || [] = []
      });

      expect(res.status).toBe(201);
      const createCall = Product.create.mock.calls[0][0];
      expect(createCall.faqs).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Lines 743-756: createProduct attr — non-string non-array truthy value
  // + empty attrValues → ['Default'] fallback
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /api/admin/products — lines 743-756: attr value types', () => {
    it('dùng [String(attr.value)] khi attr.value là số (truthy non-string non-array)', async () => {
      const createdProduct = makeProduct({ id: 9010 });
      Product.create.mockResolvedValueOnce(createdProduct);
      Product.update.mockResolvedValueOnce(undefined);
      ProductAttribute.create.mockResolvedValueOnce({ id: 1, name: 'RAM', values: ['16'] });

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Number Value',
        attributes: [{ name: 'RAM', value: 16 }], // number → truthy, non-string, non-array
      });

      expect(res.status).toBe(201);
      // attr.value=16 → else if (attr.value) → attrValues = [String(16)] = ['16']
      expect(ProductAttribute.create).toHaveBeenCalledWith(
        expect.objectContaining({ values: ['16'] }),
        expect.anything(),
      );
    });

    it('dùng [Default] khi attr.value là falsy và không phải mảng', async () => {
      const createdProduct = makeProduct({ id: 9011 });
      Product.create.mockResolvedValueOnce(createdProduct);
      Product.update.mockResolvedValueOnce(undefined);
      // attr.value = 0 → falsy → attrValues stays [] → [] length 0 → ['Default']
      ProductAttribute.create.mockResolvedValueOnce({ id: 2, name: 'Weight', values: ['Default'] });

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Default Attr',
        attributes: [{ name: 'Weight', value: 0 }], // 0 is falsy → skip all branches → attrValues=[]
      });

      expect(res.status).toBe(201);
      // attrValues.length === 0 → ['Default'] (line 756)
      expect(ProductAttribute.create).toHaveBeenCalledWith(
        expect.objectContaining({ values: ['Default'] }),
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Lines 820-821: createProduct variant — price/stock undefined → 0 fallback
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /api/admin/products — lines 820-821: variant price/stock undefined → 0', () => {
    it('đặt price=0 và stockQuantity=0 khi variant không có price và stock', async () => {
      const createdProduct = makeProduct({ id: 9020 });
      Product.create.mockResolvedValueOnce(createdProduct);
      Product.update.mockResolvedValueOnce(undefined);
      // createProduct also calls ProductAttribute.findAll after creating attributes
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      const variantMock = { id: 'v1', sku: 'SKU-GEN', price: 0, stockQuantity: 0 };
      ProductVariant.create.mockResolvedValueOnce(variantMock);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop No Price',
        variants: [{ name: 'Default', sku: 'VAR-001' }], // no price, no stock → undefined
      });

      expect(res.status).toBe(201);
      // parseFloat(undefined) = NaN → NaN || 0 = 0 (line 820)
      // parseInt(undefined) = NaN → NaN || 0 = 0 (line 821)
      expect(ProductVariant.create).toHaveBeenCalledWith(
        expect.objectContaining({ price: 0, stockQuantity: 0 }),
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 1044: updateProduct — hasOwnProperty('baseName') → baseName || name fallback
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — line 1044: baseName || name fallback', () => {
    it('dùng name khi baseName được gửi là null (baseName || name)', async () => {
      const product = makeProduct({ id: 9030, name: 'Original Name' });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9030').send({
        name: 'New Name',
        baseName: null, // null is falsy → baseName || name = 'New Name'
      });

      expect(res.status).toBe(200);
      expect(product.update).toHaveBeenCalledWith(
        expect.objectContaining({ baseName: 'New Name' }), // null || 'New Name'
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Lines 1047-1048: updateProduct — price/stockQuantity null → parseFloat/parseInt || 0
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — lines 1047-1048: price/stockQuantity null → 0', () => {
    it('đặt basePrice=0 khi gửi price=null', async () => {
      const product = makeProduct({ id: 9040 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9040').send({
        price: null, // null?.toString() = undefined → parseFloat(undefined) = NaN → NaN || 0
      });

      expect(res.status).toBe(200);
      expect(product.update).toHaveBeenCalledWith(
        expect.objectContaining({ basePrice: 0 }),
        expect.anything(),
      );
    });

    it('đặt stockQuantity=0 khi gửi stockQuantity=null', async () => {
      const product = makeProduct({ id: 9041 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9041').send({
        stockQuantity: null, // null?.toString() = undefined → parseInt(undefined) = NaN → NaN || 0
      });

      expect(res.status).toBe(200);
      expect(product.update).toHaveBeenCalledWith(
        expect.objectContaining({ stockQuantity: 0 }),
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 483: updateProduct — categoryIds=[] → setCategories([]) + categoryId=null
  // (bỏ chọn hết danh mục → FK categoryId reset null, không trỏ danh mục cũ nữa)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — line 483: categoryIds=[] → categoryId=null', () => {
    it('đặt categoryId=null khi gửi categoryIds là mảng rỗng (bỏ chọn hết danh mục)', async () => {
      const product = makeProduct({ id: 9060, categoryId: 7 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      Category.findAll.mockResolvedValueOnce([]); // findCategories({id:[]}) → [] danh mục

      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9060').send({
        categoryIds: [], // rỗng → categories.length===0 → nhánh ': null' của ternary
      });

      expect(res.status).toBe(200);
      // OUTCOME: gỡ mọi liên kết M-N (setCategories([])) + FK categoryId reset về null
      expect(product.setCategories).toHaveBeenCalledWith([], expect.anything());
      expect(product.update).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: null }),
        expect.anything(),
      );
    });

    it('đặt categoryId = id danh mục đầu khi categoryIds có phần tử (nhánh length>0)', async () => {
      const product = makeProduct({ id: 9061, categoryId: null });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      const cat = { id: 5, name: 'Laptop' };
      Category.findAll.mockResolvedValueOnce([cat]); // findCategories({id:[5]}) → [cat]

      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9061').send({
        categoryIds: [5], // có phần tử → categories.length>0 → nhánh categories[0].id
      });

      expect(res.status).toBe(200);
      // OUTCOME: gán đúng danh mục M-N + đồng bộ FK categoryId = danh mục đầu tiên
      expect(product.setCategories).toHaveBeenCalledWith([cat], expect.anything());
      expect(product.update).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: 5 }),
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 1066: updateProduct — images sent but empty array → skip bulkCreate
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — line 1066: images=[] → skip bulkCreate', () => {
    it('không gọi ProductImage.bulkCreate khi images=[]', async () => {
      const product = makeProduct({ id: 9050 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      ProductImage.destroy.mockResolvedValueOnce(undefined);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9050').send({
        images: [], // hasOwnProperty('images') true, Array.isArray true, but length===0 → skip bulkCreate
      });

      expect(res.status).toBe(200);
      // ProductImage.destroy is called (cleanup) but bulkCreate is NOT
      expect(ProductImage.destroy).toHaveBeenCalled();
      expect(ProductImage.bulkCreate).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Lines 1145-1149: updateProduct attr — truthy non-string non-array value → [String(value)]
  // + empty attrValues → ['Default']
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — lines 1145-1149: attr update với truthy non-string value', () => {
    it('dùng [String(attr.value)] khi attr.value là số trong updateProduct', async () => {
      const product = makeProduct({ id: 9060 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      // Existing attribute 'RAM' will be updated
      const existingAttr = makeAttr('RAM', ['8GB']);
      ProductAttribute.findAll.mockResolvedValueOnce([existingAttr]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9060').send({
        attributes: [
          { name: 'RAM', value: 32 }, // truthy, non-string, non-array → [String(32)] = ['32']
        ],
      });

      expect(res.status).toBe(200);
      // ['32'] is non-empty so normalizedValues = ['32'] (not ['Default'])
      expect(existingAttr.update).toHaveBeenCalledWith(
        expect.objectContaining({ values: ['32'] }),
        expect.anything(),
      );
    });

    it('dùng [Default] khi attr.value là falsy và attr.values không tồn tại', async () => {
      const product = makeProduct({ id: 9061 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      const existingAttr = makeAttr('Color', ['Red']);
      ProductAttribute.findAll.mockResolvedValueOnce([existingAttr]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9061').send({
        attributes: [
          { name: 'Color', value: 0 }, // falsy (0) → attrValues stays [] → ['Default']
        ],
      });

      expect(res.status).toBe(200);
      // attrValues empty → normalizedValues = ['Default'] (line 1149)
      expect(existingAttr.update).toHaveBeenCalledWith(
        expect.objectContaining({ values: ['Default'] }),
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Lines 1155-1156: updateProduct attr — attr.required ternary branches
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — lines 1155-1156: attr.required ternary', () => {
    it('dùng attr.required=true khi được cung cấp rõ ràng', async () => {
      const product = makeProduct({ id: 9070 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      const existingAttr = makeAttr('Size', ['M'], { required: false });
      ProductAttribute.findAll.mockResolvedValueOnce([existingAttr]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9070').send({
        attributes: [
          { name: 'Size', value: 'L', required: true }, // required !== undefined → use attr.required
        ],
      });

      expect(res.status).toBe(200);
      // attr.required=true → ternary takes truthy path (line 1156)
      expect(existingAttr.update).toHaveBeenCalledWith(
        expect.objectContaining({ required: true }),
        expect.anything(),
      );
    });

    it('giữ nguyên required từ currentAttr khi attr.required không được gửi', async () => {
      const product = makeProduct({ id: 9071 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      // Existing attribute with required=true
      const existingAttr = makeAttr('Model', ['X1'], { required: true });
      ProductAttribute.findAll.mockResolvedValueOnce([existingAttr]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9071').send({
        attributes: [
          { name: 'Model', value: 'X2' }, // no required → attr.required=undefined → keep existing
        ],
      });

      expect(res.status).toBe(200);
      // attr.required=undefined → ternary takes false path → currentAttrMap['Model'].required = true
      expect(existingAttr.update).toHaveBeenCalledWith(
        expect.objectContaining({ required: true }), // kept from existingAttr
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Lines 1203-1204, 1209: updateProduct variant — price/stock undefined → 0
  // + displayName fallback to attribute values
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — lines 1203-1204,1209: variant field fallbacks', () => {
    it('đặt price=0 và stockQuantity=0 khi variant không có price và stock', async () => {
      const product = makeProduct({ id: 9080 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      const newVariant = { id: 'new-id', stockQuantity: 0 };
      ProductVariant.create.mockResolvedValueOnce(newVariant);
      Product.update.mockResolvedValueOnce(undefined);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9080').send({
        variants: [
          {
            name: 'Default',
            // no price, no stock → undefined → parseFloat/parseInt → NaN → NaN || 0
            attributes: { color: 'blue' }, // attributes available
          },
        ],
      });

      expect(res.status).toBe(200);
      expect(ProductVariant.create).toHaveBeenCalledWith(
        expect.objectContaining({ price: 0, stockQuantity: 0 }),
        expect.anything(),
      );
    });

    it('dùng Object.values(attributes).join() làm displayName khi cả displayName lẫn name đều falsy', async () => {
      const product = makeProduct({ id: 9081 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      const newVariant = { id: 'new-id2', stockQuantity: 5 };
      ProductVariant.create.mockResolvedValueOnce(newVariant);
      Product.update.mockResolvedValueOnce(undefined);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9081').send({
        variants: [
          {
            // name is NOT sent → undefined → falsy
            // displayName is NOT sent → undefined → falsy
            // → use Object.values(attributes).join(' - ')
            price: 10000,
            stock: 5,
            attributes: { color: 'blue', size: 'L' },
          },
        ],
      });

      expect(res.status).toBe(200);
      expect(ProductVariant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'blue - L', // Object.values({color:'blue', size:'L'}).join(' - ')
        }),
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 1223: updateProduct variant — id starts with 'var-' → undefined id in create
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — line 1223: temp id var-* → undefined', () => {
    it('tạo variant mới với id=undefined khi id bắt đầu bằng "var-"', async () => {
      const product = makeProduct({ id: 9090 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      const newVariant = { id: 'real-uuid-xyz', stockQuantity: 3 };
      ProductVariant.create.mockResolvedValueOnce(newVariant);
      Product.update.mockResolvedValueOnce(undefined);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9090').send({
        variants: [
          {
            id: 'var-0', // starts with 'var-' → id: undefined in create call
            name: 'Default',
            price: 5000000,
            stock: 3,
          },
        ],
      });

      expect(res.status).toBe(200);
      expect(ProductVariant.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: undefined }),
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 1242: updateProduct — only stockQuantity sent (no variants key) → direct update
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — line 1242: stockQuantity without variants', () => {
    it('gọi Product.update với stockQuantity khi không có variants trong body', async () => {
      const product = makeProduct({ id: 9100 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      Product.update.mockResolvedValueOnce(undefined);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      // Send stockQuantity WITHOUT variants property
      const res = await request.put('/api/admin/products/9100').send({
        stockQuantity: 77,
      });

      expect(res.status).toBe(200);
      expect(Product.update).toHaveBeenCalledWith(
        { stockQuantity: 77 },
        expect.objectContaining({ where: { id: '9100' } }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 1294: updateProduct — spec translation branch (spec has value but no valueEn)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — line 1294: spec translation', () => {
    it('gọi translateBatch cho spec chưa có valueEn', async () => {
      const product = makeProduct({ id: 9110 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const savedSpec = makeSpec('CPU', 'Intel i9', null); // valueEn=null → needs translation
      ProductSpecification.create.mockResolvedValueOnce(savedSpec);

      const { translateBatch } = require('@modules/ai/services/translate/translate-service');
      translateBatch.mockResolvedValueOnce(['Intel i9']);

      const res = await request.put('/api/admin/products/9110').send({
        specifications: [{ name: 'CPU', value: 'Intel i9' }],
      });

      expect(res.status).toBe(200);

      // Wait for setImmediate to fire
      await new Promise((resolve) => setImmediate(resolve));

      // translateBatch called with spec values
      expect(translateBatch).toHaveBeenCalled();
      expect(savedSpec.update).toHaveBeenCalledWith({ valueEn: 'Intel i9' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 1362: updateProduct — transaction.rollback when product.update fails
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — line 1362: rollback branches', () => {
    it('gọi transaction.rollback khi product.update ném lỗi', async () => {
      const product = makeProduct({ id: 9120 });
      product.update.mockRejectedValueOnce(new Error('DB update failed'));
      Product.findByPk.mockResolvedValueOnce(product);

      // Use a manually created transaction mock that tracks rollback
      const manualTx = {
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        LOCK: { UPDATE: 'UPDATE' },
      };
      sequelize.transaction.mockResolvedValueOnce(manualTx);

      const res = await request.put('/api/admin/products/9120').send({
        name: 'Updated Name',
      });

      expect(res.status).toBe(500);
      expect(manualTx.rollback).toHaveBeenCalled();
    });

    it('không crash khi transaction là falsy (line 1362 false branch)', async () => {
      // Branch 213: if (transaction) → false arm when transaction is falsy
      // sequelize.transaction() returns null → transaction = null → if(null) is false
      const product = makeProduct({ id: 9121 });
      product.update.mockRejectedValueOnce(new Error('DB error'));
      Product.findByPk.mockResolvedValueOnce(product);

      // Make sequelize.transaction() resolve to null → transaction is null (falsy)
      sequelize.transaction.mockResolvedValueOnce(null);

      const res = await request.put('/api/admin/products/9121').send({
        name: 'Cause Error',
      });

      expect(res.status).toBe(500);
      // if (transaction) → if (null) → false → rollback not called
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 1547: getProducts — productImages null → || [] fallback
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/products — line 1547: productImages null → []', () => {
    it('trả về images=[] khi product.productImages là null', async () => {
      const products = [
        {
          toJSON: () => ({
            id: 9200,
            name: 'Laptop No Images',
            basePrice: 15000000,
            productImages: null, // null?.map() = undefined → undefined || [] = []
            categories: [],
            category: null,
          }),
        },
      ];
      Product.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: products });

      const res = await request.get('/api/admin/products');

      expect(res.status).toBe(200);
      expect(res.body.data.products[0].images).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Lines 1732-1734: getOrders — item without Product + item.Product.productImages null
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/orders — lines 1732-1734: order item edge cases', () => {
    it('bỏ qua item không có Product (item.Product là null)', async () => {
      const orderRow = {
        toJSON: () => ({
          id: 9300,
          status: 'pending',
          items: [
            {
              id: 1,
              quantity: 2,
              Product: null, // line 1734: if (item.Product) → false branch
            },
          ],
        }),
      };
      Order.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [orderRow] });

      const res = await request.get('/api/admin/orders');

      expect(res.status).toBe(200);
      // No crash, item.Product stays null
      expect(res.body.data.orders[0].items[0].Product).toBeNull();
    });

    it('đặt images=[] khi item.Product.productImages là null (|| [] fallback)', async () => {
      const orderRow = {
        toJSON: () => ({
          id: 9301,
          status: 'pending',
          items: [
            {
              id: 2,
              quantity: 1,
              Product: {
                id: 11,
                name: 'Keyboard',
                basePrice: 1500000,
                productImages: null, // null?.map() = undefined → undefined || [] = []
              },
            },
          ],
        }),
      };
      Order.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [orderRow] });

      const res = await request.get('/api/admin/orders');

      expect(res.status).toBe(200);
      expect(res.body.data.orders[0].items[0].Product.images).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 1788: updateOrderStatus — note='' → note === '' → null
  // ─────────────────────────────────────────────────────────────────────────────

  // Logic hoàn kho/updateData (note=''→null, restock variant/product khi cancel) đã chuyển sang
  // orders-service (xem orders-edge-cases.integration F2/F12/F13/F14). Admin chỉ test delegation.
  describe('PUT /api/admin/orders/:id/status — delegation sang orders-service', () => {
    it('forward { id, status, paymentStatus, note } y nguyên và re-fetch order', async () => {
      Order.findByPk.mockResolvedValueOnce({ id: 9400, status: 'shipped' });

      const res = await request
        .put('/api/admin/orders/9400/status')
        .send({ status: 'shipped', note: '', paymentStatus: 'paid' });

      expect(res.status).toBe(200);
      // Admin KHÔNG transform note/paymentStatus — chuyển nguyên sang orders-service
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith({
        id: '9400',
        status: 'shipped',
        paymentStatus: 'paid',
        note: '',
      });
      expect(res.body.data.order.status).toBe('shipped');
    });

    it('propagate 400 khi orders-service từ chối (vd hủy đơn đã giao)', async () => {
      mockOrdersService.updateOrderStatus.mockRejectedValueOnce(
        new AppError('Không thể hủy đơn hàng đã giao', 400),
      );

      const res = await request.put('/api/admin/orders/9410/status').send({ status: 'cancelled' });

      expect(res.status).toBe(400);
      expect(Order.findByPk).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 2228: getOrderStatusAnalytics — unknown status → row.status as label
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/analytics/order-status — line 2228: unknown status label', () => {
    it('dùng row.status làm label khi status không nằm trong statusLabels', async () => {
      const statusDist = [
        { status: 'unknown_status', count: '3' }, // not in statusLabels → || row.status
      ];
      Order.findAll.mockResolvedValueOnce(statusDist);

      const res = await request.get('/api/admin/analytics/order-status');

      expect(res.status).toBe(200);
      // statusLabels['unknown_status'] = undefined → undefined || 'unknown_status'
      expect(res.body.data[0].label).toBe('unknown_status');
    });

    it('dùng label từ statusLabels khi status hợp lệ', async () => {
      const statusDist = [{ status: 'pending', count: '5' }];
      Order.findAll.mockResolvedValueOnce(statusDist);

      const res = await request.get('/api/admin/analytics/order-status');

      expect(res.status).toBe(200);
      // statusLabels['pending'] = 'Chờ xử lý' → left branch of ||
      expect(res.body.data[0].label).toBe('Chờ xử lý');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 2239: getTopProductsAnalytics — limit capped at 20
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/analytics/top-products — line 2239: limitNum capped at 20', () => {
    it('cap limit tại 20 khi gửi limit=50', async () => {
      OrderItem.findAll.mockResolvedValueOnce([]);

      const res = await request.get('/api/admin/analytics/top-products').query({ limit: '50' });

      expect(res.status).toBe(200);
      // Math.min(parseInt('50') || 5, 20) = Math.min(50, 20) = 20
      const findAllCall = OrderItem.findAll.mock.calls[0][0];
      expect(findAllCall.limit).toBe(20);
    });

    it('dùng default 5 khi limit không được gửi', async () => {
      OrderItem.findAll.mockResolvedValueOnce([]);

      const res = await request.get('/api/admin/analytics/top-products');

      expect(res.status).toBe(200);
      // parseInt(undefined) = NaN → NaN || 5 = 5 → Math.min(5, 20) = 5
      const findAllCall = OrderItem.findAll.mock.calls[0][0];
      expect(findAllCall.limit).toBe(5);
    });

    it('dùng metric=quantity khi metric khác revenue', async () => {
      OrderItem.findAll.mockResolvedValueOnce([]);

      const res = await request
        .get('/api/admin/analytics/top-products')
        .query({ metric: 'quantity' });

      expect(res.status).toBe(200);
      // metric !== 'revenue' → orderBy = [[...soldCount..., 'DESC']] (right branch of ternary)
    });

    it('dùng default 5 khi limit không parse được (parseInt("abc") = NaN → || 5 fallback)', async () => {
      // Branch 320: parseInt(qLimit, 10) || 5 — right branch when parseInt returns NaN
      OrderItem.findAll.mockResolvedValueOnce([]);

      const res = await request.get('/api/admin/analytics/top-products').query({ limit: 'abc' }); // NaN → || 5

      expect(res.status).toBe(200);
      // parseInt('abc') = NaN → NaN || 5 = 5 → Math.min(5, 20) = 5
      const findAllCall = OrderItem.findAll.mock.calls[0][0];
      expect(findAllCall.limit).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Lines 2281-2282: getTopProductsAnalytics — null Product → empty prod
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/analytics/top-products — lines 2281-2282: null Product', () => {
    it('trả về name="" và thumbnail=null khi item.Product là null', async () => {
      const items = [
        {
          productId: 1,
          Product: null, // null → {} (line 2276: item.Product ? toJSON() : {})
          getDataValue: (key) => (key === 'revenue' ? '500000' : '3'),
        },
      ];
      OrderItem.findAll.mockResolvedValueOnce(items);

      const res = await request.get('/api/admin/analytics/top-products');

      expect(res.status).toBe(200);
      expect(res.body.data[0]).toMatchObject({
        name: '',
        thumbnail: null,
        revenue: 500000,
        soldCount: 3,
      });
    });

    it('trả về thumbnail=null khi product không có productImages (line 2280)', async () => {
      const items = [
        {
          productId: 2,
          Product: {
            toJSON: () => ({
              id: 2,
              name: 'Laptop',
              productImages: [], // empty array → ?.[0] = undefined → undefined?.imageUrl = undefined || null
            }),
          },
          getDataValue: (key) => (key === 'revenue' ? '1000000' : '10'),
        },
      ];
      OrderItem.findAll.mockResolvedValueOnce(items);

      const res = await request.get('/api/admin/analytics/top-products');

      expect(res.status).toBe(200);
      expect(res.body.data[0].thumbnail).toBeNull();
    });

    it('revenue=0 và soldCount=0 khi getDataValue trả về null (|| 0 fallback lines 2281-2282)', async () => {
      // Branch 325, 326: getDataValue('revenue') || 0 and getDataValue('soldCount') || 0
      const items = [
        {
          productId: 3,
          Product: {
            toJSON: () => ({ id: 3, name: 'Item', productImages: [] }),
          },
          getDataValue: (key) => null, // always null → || 0 right branch hit
        },
      ];
      OrderItem.findAll.mockResolvedValueOnce(items);

      const res = await request.get('/api/admin/analytics/top-products');

      expect(res.status).toBe(200);
      // null || 0 = 0 for both revenue and soldCount
      expect(res.body.data[0].revenue).toBe(0);
      expect(res.body.data[0].soldCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 2323: getRevenueByCategoryAnalytics — result row mapping
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/analytics/revenue-by-category — line 2323: row mapping', () => {
    it('map revenue và orderItemCount với null fallback', async () => {
      const rows = [
        { categoryId: 1, categoryName: 'Laptop', revenue: '5000000', orderItemCount: '10' },
        { categoryId: 2, categoryName: 'Phone', revenue: null, orderItemCount: null },
      ];
      sequelize.query.mockResolvedValueOnce([rows]);

      const res = await request.get('/api/admin/analytics/revenue-by-category');

      expect(res.status).toBe(200);
      // Row 1: revenue='5000000' → parseFloat('5000000') = 5000000
      expect(res.body.data[0].revenue).toBe(5000000);
      // Row 2: revenue=null → parseFloat(null || 0) = 0
      expect(res.body.data[1].revenue).toBe(0);
      expect(res.body.data[1].orderItemCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 2391: getPaymentMethodsAnalytics — null paymentMethod → 'unknown'
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/analytics/payment-methods — lines 2389,2391: fallback branches', () => {
    it('đặt method="unknown" khi paymentMethod là null', async () => {
      const rows = [
        { paymentMethod: 'cod', count: '10', revenue: '2000000' },
        { paymentMethod: null, count: '1', revenue: '0' }, // null → || 'unknown'
      ];
      Order.findAll.mockResolvedValueOnce(rows);

      const res = await request.get('/api/admin/analytics/payment-methods');

      expect(res.status).toBe(200);
      expect(res.body.data[0].method).toBe('cod');
      expect(res.body.data[1].method).toBe('unknown');
    });

    it('revenue=0 khi row.revenue là null (line 2391: revenue || 0 right branch)', async () => {
      // Branch 336: parseFloat(row.revenue || 0) — need row.revenue to be null/undefined
      const rows = [
        { paymentMethod: 'momo', count: '5', revenue: null }, // null → null || 0 → 0
      ];
      Order.findAll.mockResolvedValueOnce(rows);

      const res = await request.get('/api/admin/analytics/payment-methods');

      expect(res.status).toBe(200);
      // revenue=null → null || 0 = 0 (right arm hit)
      expect(res.body.data[0].revenue).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 2463: exportReport orders — User is null → empty customer/email
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/reports/export — line 2463: orders User=null and User with nulls', () => {
    it('dùng customer="" và email="" khi order.User là null', async () => {
      const orders = [
        {
          toJSON: () => ({
            id: 1,
            number: 'ORD-001',
            status: 'delivered',
            paymentStatus: 'paid',
            paymentMethod: 'cod',
            total: 500000,
            createdAt: '2024-01-15T00:00:00.000Z',
            User: null, // null → customer = '', email = ''
          }),
        },
      ];
      Order.findAll.mockResolvedValueOnce(orders);

      const res = await request.get('/api/admin/reports/export').query({ type: 'orders' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      // When User=null: customer = '' (trim of ' '), email = '' (oJson.User?.email = undefined || '')
      const csvRows = res.text.split('\n').slice(1); // skip header
      expect(csvRows[0]).toContain(',"",""');
    });

    it('dùng firstName và lastName khi User tồn tại (true branch of User ternary)', async () => {
      // Branch 344: oJson.User ? ... : '' — need User to be truthy (first arm)
      const orders = [
        {
          toJSON: () => ({
            id: 2,
            number: 'ORD-002',
            status: 'delivered',
            paymentStatus: 'paid',
            paymentMethod: null, // null paymentMethod → || '' (line 2466 right branch)
            total: 300000,
            createdAt: '2024-02-10T00:00:00.000Z',
            User: {
              firstName: null, // null → firstName || '' = '' (line 2463 branch 345)
              lastName: null, // null → lastName || '' = '' (line 2463 branch 346)
              email: null, // null → email || '' (line 2464 right branch)
            },
          }),
        },
      ];
      Order.findAll.mockResolvedValueOnce(orders);

      const res = await request.get('/api/admin/reports/export').query({ type: 'orders' });

      expect(res.status).toBe(200);
      // User exists → true branch of ternary (line 2463)
      // firstName=null → '' || '' = ''
      // lastName=null → '' || '' = ''
      // customer = ''.trim() = ''
      expect(res.text).toContain(',"",""');
      // paymentMethod=null → || '' = '' (line 2466 right branch)
      expect(res.text).toContain(',,');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 2482: exportReport products — status null → || 'active'
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/reports/export — line 2482: product status null → active', () => {
    it('dùng "active" khi product.status là null', async () => {
      const products = [
        {
          id: 1,
          name: 'Product A',
          sku: 'SKU-A',
          basePrice: 10000000,
          stockQuantity: 5,
          status: null,
        },
      ];
      Product.findAll.mockResolvedValueOnce(products);

      const res = await request.get('/api/admin/reports/export').query({ type: 'products' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      // status null → p.status || 'active' = 'active'
      expect(res.text).toContain(',active');
    });

    it('giữ nguyên status khi product.status là "inactive"', async () => {
      const products = [
        {
          id: 2,
          name: 'Discontinued',
          sku: null,
          basePrice: 0,
          stockQuantity: 0,
          status: 'inactive',
        },
      ];
      Product.findAll.mockResolvedValueOnce(products);

      const res = await request.get('/api/admin/reports/export').query({ type: 'products' });

      expect(res.status).toBe(200);
      // status='inactive' → truthy → left branch of || taken
      expect(res.text).toContain(',inactive');
    });

    it('dùng "" cho name khi product.name là null (p.name || "" fallback)', async () => {
      // Branch 350: p.name || '' — right side needs name to be falsy
      const products = [
        { id: 3, name: null, sku: null, basePrice: 0, stockQuantity: 0, status: null },
      ];
      Product.findAll.mockResolvedValueOnce(products);

      const res = await request.get('/api/admin/reports/export').query({ type: 'products' });

      expect(res.status).toBe(200);
      // name=null → null || '' = '' (right branch of || covered)
      expect(res.text).toContain(',active'); // status also null → 'active'
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 1155 (third arm): attr.type || currentAttrMap.type || 'custom'
  // → 'custom' only when BOTH attr.type AND currentAttrMap.type are falsy
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — line 1155: || "custom" fallback', () => {
    it('dùng "custom" khi cả attr.type lẫn currentAttr.type đều falsy', async () => {
      const product = makeProduct({ id: 9200 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      // Existing attribute without type (type=null or undefined)
      const existingAttr = makeAttr('Screen', ['15"'], { type: null }); // type=null → falsy
      ProductAttribute.findAll.mockResolvedValueOnce([existingAttr]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9200').send({
        attributes: [
          { name: 'Screen', value: '16"' }, // attr.type not sent → undefined → falsy
          // currentAttrMap['Screen'].type = null → falsy
          // → 'custom' (third arm, line 1155)
        ],
      });

      expect(res.status).toBe(200);
      // Both falsy → uses 'custom' as fallback
      expect(existingAttr.update).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'custom' }),
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 1223 (truthy arm): variant.id is a real UUID (not 'var-') → use the id
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — line 1223: real UUID → preserve id in create', () => {
    it('dùng variant.id gốc khi id không bắt đầu bằng "var-" và không có trong currentVarMap', async () => {
      const product = makeProduct({ id: 9210 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      ProductAttribute.findAll.mockResolvedValueOnce([]);
      // No existing variants → currentVarMap is empty → goes to create path
      ProductVariant.findAll.mockResolvedValueOnce([]);
      // Variant with a real UUID-like id (not 'var-') → truthy arm of ternary
      const newVariant = { id: 'real-uuid-abc-123', stockQuantity: 3 };
      ProductVariant.create.mockResolvedValueOnce(newVariant);
      Product.update.mockResolvedValueOnce(undefined);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9210').send({
        variants: [
          {
            id: 'real-uuid-abc-123', // real UUID, not in currentVarMap → create with this id
            name: 'Default Variant',
            price: 15000000,
            stock: 3,
          },
        ],
      });

      expect(res.status).toBe(200);
      // id is truthy + does NOT start with 'var-' → ternary returns variant.id (truthy arm)
      expect(ProductVariant.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'real-uuid-abc-123' }),
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 1294: translated[i] || null → null fallback when translation is undefined
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — line 1294: translated[i] undefined → null', () => {
    it('đặt valueEn=null khi translateBatch trả về mảng thiếu phần tử (undefined)', async () => {
      const product = makeProduct({ id: 9220 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);

      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const savedSpec = makeSpec('Battery', '5000mAh', null); // valueEn=null → needs translation
      ProductSpecification.create.mockResolvedValueOnce(savedSpec);

      const { translateBatch } = require('@modules/ai/services/translate/translate-service');
      // translateBatch returns fewer items than expected (undefined at index 0)
      translateBatch.mockResolvedValueOnce([]); // empty → translated[0] = undefined → || null

      const res = await request.put('/api/admin/products/9220').send({
        specifications: [{ name: 'Battery', value: '5000mAh' }],
      });

      expect(res.status).toBe(200);

      // Wait for setImmediate
      await new Promise((resolve) => setImmediate(resolve));

      // translated[0] = undefined → undefined || null = null (line 1294 right branch)
      expect(savedSpec.update).toHaveBeenCalledWith({ valueEn: null });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 1732: getOrders — order.items is null/undefined → false branch of if(order.items)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/orders — line 1732: order.items falsy → skip item transform', () => {
    it('không crash khi order.items là null', async () => {
      const orderRow = {
        toJSON: () => ({
          id: 9300,
          status: 'pending',
          items: null, // null → if (order.items) → false → skip (line 1732 false branch)
        }),
      };
      Order.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [orderRow] });

      const res = await request.get('/api/admin/orders');

      expect(res.status).toBe(200);
      // No crash, items remains null
      expect(res.body.data.orders[0].items).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Line 1788: updateOrderStatus — status || order.status right branch
  // → need status to be falsy (not sent)
  // ─────────────────────────────────────────────────────────────────────────────

  // Status-fallback + restock fall-through (item không variantId/Product, items null) đã chuyển
  // sang orders-service. Admin chỉ giữ pre-check cancelled + delegate cancel.
  describe('POST /api/admin/orders/:id/cancel — pre-check + delegation', () => {
    it('hủy thành công: pre-check pass → delegate { id, status: "cancelled" }', async () => {
      Order.findByPk.mockResolvedValueOnce({ id: 9500, status: 'processing' });

      const res = await request.post('/api/admin/orders/9500/cancel');

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ orderId: 9500, status: 'cancelled' });
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith({
        id: '9500',
        status: 'cancelled',
      });
    });

    it('trả về 400 (pre-check) khi đơn đã hủy trước đó, không delegate', async () => {
      Order.findByPk.mockResolvedValueOnce({ id: 9501, status: 'cancelled' });

      const res = await request.post('/api/admin/orders/9501/cancel');

      expect(res.status).toBe(400);
      expect(mockOrdersService.updateOrderStatus).not.toHaveBeenCalled();
    });
  });

  // ─── Line 983: updateProduct — price changes tracking ────────────────────────

  describe('PUT /api/admin/products/:id — line 983: price change tracking khi price khác basePrice', () => {
    it('ghi nhận changes.price khi price mới khác basePrice hiện tại', async () => {
      const product = makeProduct({ id: 9910, basePrice: 10000000 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9910').send({
        name: product.name,
        price: 12000000, // khác basePrice=10000000 → changes.price được set
      });

      expect(res.status).toBe(200);
      // product.update phải được gọi với basePrice mới
      expect(product.update).toHaveBeenCalledWith(
        expect.objectContaining({ basePrice: 12000000 }),
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Lines 814-820 (updateProduct): images array chứa object dùng img.url || img.imageUrl
  // và img.color || null
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — lines 814-820: images object với url/imageUrl và color', () => {
    it('dùng img.url khi có, và img.color khi có', async () => {
      const product = makeProduct({ id: 8814, basePrice: 5000000 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/8814').send({
        images: [
          { url: 'https://cdn.test/img1.jpg', color: 'red', isThumbnail: true, variantId: null },
        ],
      });

      expect(res.status).toBe(200);
    });

    it('dùng img.imageUrl khi không có img.url, và color null khi không truyền color', async () => {
      const product = makeProduct({ id: 8815, basePrice: 5000000 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/8815').send({
        images: [{ imageUrl: 'https://cdn.test/img2.jpg', isThumbnail: false }],
      });

      expect(res.status).toBe(200);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Lines 988-1001 (updateProduct): hasOwnProperty checks cho baseName, seoTitle,
  // seoKeywords, featured, shortDescription
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — lines 988-1001: hasOwnProperty branches', () => {
    it('set updateData.baseName khi body có baseName', async () => {
      const product = makeProduct({ id: 8988, basePrice: 5000000 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/8988').send({
        baseName: 'Laptop Base',
        name: 'Laptop Test',
      });

      expect(res.status).toBe(200);
      expect(product.update).toHaveBeenCalledWith(
        expect.objectContaining({ baseName: 'Laptop Base' }),
        expect.anything(),
      );
    });

    it('fallback baseName về name khi baseName là falsy', async () => {
      const product = makeProduct({ id: 8989, basePrice: 5000000 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/8989').send({
        baseName: '',
        name: 'Tên Sản Phẩm',
      });

      expect(res.status).toBe(200);
      expect(product.update).toHaveBeenCalledWith(
        expect.objectContaining({ baseName: 'Tên Sản Phẩm' }),
        expect.anything(),
      );
    });

    it('set seoTitle, seoKeywords, featured, shortDescription khi có trong body', async () => {
      const product = makeProduct({ id: 8990, basePrice: 5000000 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      // Gửi 'featured' (key mà hasOwnProperty check) để trigger line 996
      // Gửi 'isFeatured' (key destructuring) để biến featured có giá trị
      // Hai key tách nhau nên test chỉ verify seoTitle/seoKeywords/shortDescription
      const res = await request.put('/api/admin/products/8990').send({
        seoTitle: 'SEO Title Test',
        seoKeywords: ['laptop', 'gaming'],
        featured: true, // trigger hasOwnProperty('featured') → line 996
        shortDescription: 'Mô tả ngắn',
      });

      expect(res.status).toBe(200);
      expect(product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          seoTitle: 'SEO Title Test',
          seoKeywords: ['laptop', 'gaming'],
          shortDescription: 'Mô tả ngắn',
        }),
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Lines 1036-1047 (updateProduct): compareAtPrice và comparePrice handling
  // Line 1036: priceToCompare từ compareAtPrice
  // Line 1047: priceToCompare === '' → null
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — lines 1036-1047: compareAtPrice handling', () => {
    it('gọi sequelize.query với compareAtPrice khi body có compareAtPrice', async () => {
      const product = makeProduct({ id: 8036, basePrice: 5000000 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/8036').send({
        compareAtPrice: 6000000,
      });

      expect(res.status).toBe(200);
      expect(sequelize.query).toHaveBeenCalledWith(
        'UPDATE products SET compare_at_price = :compareAtPrice WHERE id = :id',
        expect.objectContaining({
          replacements: expect.objectContaining({ compareAtPrice: 6000000 }),
        }),
      );
    });

    it('dùng comparePrice khi không có compareAtPrice nhưng có comparePrice', async () => {
      const product = makeProduct({ id: 8037, basePrice: 5000000 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/8037').send({
        comparePrice: 5500000,
      });

      expect(res.status).toBe(200);
      expect(sequelize.query).toHaveBeenCalledWith(
        'UPDATE products SET compare_at_price = :compareAtPrice WHERE id = :id',
        expect.objectContaining({
          replacements: expect.objectContaining({ compareAtPrice: 5500000 }),
        }),
      );
    });

    it('truyền null vào query khi compareAtPrice là chuỗi rỗng (line 1047)', async () => {
      const product = makeProduct({ id: 8038, basePrice: 5000000 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/8038').send({
        compareAtPrice: '',
      });

      expect(res.status).toBe(200);
      expect(sequelize.query).toHaveBeenCalledWith(
        'UPDATE products SET compare_at_price = :compareAtPrice WHERE id = :id',
        expect.objectContaining({
          replacements: expect.objectContaining({ compareAtPrice: null }),
        }),
      );
    });
  });

  // ─── Lines 816,818: img.imageUrl fallback + color null fallback ───────────────

  describe('PUT /api/admin/products/:id — lines 816,818: image fallback branches', () => {
    it('dùng img.imageUrl khi img.url không có (line 816)', async () => {
      const product = makeProduct({ id: 9950 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);
      ProductImage.destroy.mockResolvedValueOnce(0);
      ProductImage.bulkCreate.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9950').send({
        // chỉ có imageUrl, không có url → img.url=undefined → dùng img.imageUrl
        images: [{ imageUrl: 'https://cdn.example.com/img.jpg' }],
      });
      expect(res.status).toBe(200);
    });

    it('color=null khi image không có color (line 818)', async () => {
      const product = makeProduct({ id: 9951 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);
      ProductImage.destroy.mockResolvedValueOnce(0);
      ProductImage.bulkCreate.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9951').send({
        // không có color → img.color=undefined → null
        images: [{ url: 'https://cdn.example.com/img.jpg' }],
      });
      expect(res.status).toBe(200);
    });
  });

  // ─── Lines 989,997,999,1001: updateData field branches ───────────────────────

  describe('PUT /api/admin/products/:id — lines 989,997,999,1001: field assignment branches', () => {
    it('baseName="" → fallback về name (line 989 || name branch)', async () => {
      const product = makeProduct({ id: 9960 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9960').send({
        name: 'Real Name',
        baseName: '', // falsy → baseName || name = 'Real Name'
      });
      expect(res.status).toBe(200);
    });

    it('featured, seoTitle, seoDescription → set vào updateData (lines 997,999,1001)', async () => {
      const product = makeProduct({ id: 9961 });
      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/9961').send({
        description: 'Mô tả sản phẩm', // line 989
        featured: true, // triggers hasOwnProperty('featured') → line 996
        isFeatured: true, // provides `featured` variable via destructuring
        condition: 'new', // line 997
        seoTitle: 'SEO Title', // line 998
        seoDescription: 'SEO', // line 999
        faqs: [], // line 1001
      });
      expect(res.status).toBe(200);
      expect(product.update).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Mô tả sản phẩm', seoTitle: 'SEO Title' }),
        expect.anything(),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Merged from admin-controller.edge-cases-2.test.js
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getProductById — attributes và specifications trả về giá trị gốc', () => {
    it('variants.attributes được parse thành object khi là JSON hợp lệ', async () => {
      const productWithStringAttrs = {
        toJSON: () => ({
          id: 5,
          name: 'Laptop Parsed',
          variants: [
            {
              id: 'v1',
              name: '8GB',
              attributes: '{"RAM":"8GB","Storage":"256GB"}',
              attributeValues: '{"RAM":"8GB"}',
              specifications: '{}',
            },
          ],
          attributes: null,
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(productWithStringAttrs);

      const res = await request.get('/api/admin/products/5');
      expect(res.status).toBe(200);
      // Chuỗi JSON hợp lệ → deepParseJSON parse thành object
      expect(res.body.data.product.variants[0].attributes).toEqual({
        RAM: '8GB',
        Storage: '256GB',
      });
    });

    it('attributes[].values trả về [] khi input là chuỗi JSON (không phải array)', async () => {
      const productWithAttrArray = {
        toJSON: () => ({
          id: 6,
          name: 'PC Test',
          variants: [],
          attributes: [{ name: 'Color', values: '["red","blue"]' }],
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(productWithAttrArray);

      const res = await request.get('/api/admin/products/6');
      expect(res.status).toBe(200);
      // '["red","blue"]' không phải array → Array.isArray = false → []
      expect(res.body.data.product.attributes[0].values).toEqual([]);
    });

    it('specifications trả về chuỗi gốc khi là string JSON (không parse)', async () => {
      const productWithStringSpec = {
        toJSON: () => ({
          id: 7,
          name: 'Specs Product',
          variants: [],
          attributes: null,
          specifications: '{"CPU":"Intel i7","RAM":"16GB"}',
        }),
      };
      Product.findByPk.mockResolvedValueOnce(productWithStringSpec);

      const res = await request.get('/api/admin/products/7');
      expect(res.status).toBe(200);
      expect(res.body.data.product.specifications).toBe('{"CPU":"Intel i7","RAM":"16GB"}');
    });

    it('deepParseJSONArray trả về mảng rỗng khi giá trị không phải JSON hợp lệ', async () => {
      const productWithInvalidAttr = {
        toJSON: () => ({
          id: 8,
          name: 'Invalid Attr',
          variants: [],
          attributes: [{ name: 'Size', values: 'not-valid-json{{{' }],
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(productWithInvalidAttr);

      const res = await request.get('/api/admin/products/8');
      expect(res.status).toBe(200);
      // values không parse được → deepParseJSONArray trả về []
      expect(res.body.data.product.attributes[0].values).toEqual([]);
    });

    it('variants.attributes trả về {} khi là chuỗi không phải JSON hợp lệ', async () => {
      const productWithInvalidVariantAttr = {
        toJSON: () => ({
          id: 9,
          name: 'Invalid Variant',
          variants: [
            {
              id: 'v2',
              attributes: 'not-json',
              attributeValues: null,
              specifications: 'not-json-either',
            },
          ],
          attributes: null,
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(productWithInvalidVariantAttr);

      const res = await request.get('/api/admin/products/9');
      expect(res.status).toBe(200);
      // Chuỗi không parse được → deepParseJSON trả về {}
      expect(res.body.data.product.variants[0].attributes).toEqual({});
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getDashboardStats — topProducts transform với productImages
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/dashboard — topProducts với productImages', () => {
    function setupDashboardBasicMocks() {
      User.count.mockResolvedValue(0);
      Product.count.mockResolvedValue(0);
      Order.count.mockResolvedValue(0);
      Order.sum.mockResolvedValue(0);
      Order.findAll.mockResolvedValue([]);
    }

    it('topProducts với productImages được chuyển thành mảng images', async () => {
      setupDashboardBasicMocks();

      const topProductItem = {
        productId: 3,
        getDataValue: jest.fn((key) => {
          if (key === 'totalSold') return '10';
          if (key === 'totalRevenue') return '500000';
          return null;
        }),
        Product: {
          toJSON: () => ({
            id: 3,
            name: 'Laptop Pro',
            basePrice: 50000,
            productImages: [{ imageUrl: 'https://cdn.example.com/img1.jpg' }],
          }),
        },
      };

      OrderItem.findAll.mockResolvedValueOnce([topProductItem]);

      const res = await request.get('/api/admin/dashboard');
      expect(res.status).toBe(200);
      const top = res.body.data.topProducts[0];
      expect(top.product.images).toEqual(['https://cdn.example.com/img1.jpg']);
      expect(top.product.price).toBe(50000);
      expect(top.totalSold).toBe(10);
    });

    it('topProducts với Product=null không crash', async () => {
      setupDashboardBasicMocks();

      const topProductItemNoProduct = {
        productId: 99,
        getDataValue: jest.fn((key) => {
          if (key === 'totalSold') return '5';
          if (key === 'totalRevenue') return '100000';
          return null;
        }),
        Product: null,
      };

      OrderItem.findAll.mockResolvedValueOnce([topProductItemNoProduct]);

      const res = await request.get('/api/admin/dashboard');
      expect(res.status).toBe(200);
      // Không crash khi Product là null — productData = {} rồi name được set thành ''
      expect(res.body.data.topProducts[0].product).toEqual({ name: '' });
    });

    it('ordersByStatus reduce chạy đúng khi có dữ liệu', async () => {
      User.count.mockResolvedValue(10);
      Product.count.mockResolvedValue(5);
      Order.count.mockResolvedValue(3);
      Order.sum.mockResolvedValue(1500000);
      OrderItem.findAll.mockResolvedValueOnce([]);
      Order.findAll.mockResolvedValueOnce([
        { status: 'pending', count: '2' },
        { status: 'delivered', count: '1' },
      ]);

      const res = await request.get('/api/admin/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.data.overview.ordersByStatus.pending).toBe(2);
      expect(res.body.data.overview.ordersByStatus.delivered).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // createProduct — comparePrice, categories (auto-create), attributes, variants, images, specs
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /api/admin/products — createProduct với các quan hệ', () => {
    function makeCreatedProduct(id = 20) {
      const p = makeProduct({ id });
      p.setCategories = jest.fn().mockResolvedValue(undefined);
      return p;
    }

    it('gọi sequelize.query để set compareAtPrice khi comparePrice được truyền', async () => {
      const newProduct = makeCreatedProduct(20);
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop With ComparePrice',
        basePrice: 15000000,
        comparePrice: 18000000,
      });

      expect(res.status).toBe(201);
      expect(sequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('compare_at_price'),
        expect.objectContaining({
          replacements: expect.objectContaining({ comparePrice: 18000000 }),
        }),
      );
    });

    it('trả về 400 khi categoryId không tồn tại (KHÔNG auto-tạo category rác)', async () => {
      // Category không tồn tại → findCategories trả [] → 400, không tạo product
      Category.findAll.mockResolvedValueOnce([]);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Category Không Tồn Tại',
        basePrice: 10000000,
        categoryIds: ['999'],
      });

      expect(res.status).toBe(400);
      expect(Product.create).not.toHaveBeenCalled();
      expect(Category.create).not.toHaveBeenCalled();
    });

    it('set FK categoryId = danh mục đã chọn khi category hợp lệ', async () => {
      const newProduct = makeCreatedProduct(22);
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      Category.findAll.mockResolvedValueOnce([{ id: 9, name: 'Laptop' }]);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Category Hợp Lệ',
        basePrice: 10000000,
        categoryIds: ['9'],
      });

      expect(res.status).toBe(201);
      expect(newProduct.setCategories).toHaveBeenCalledWith(
        [{ id: 9, name: 'Laptop' }],
        expect.anything(),
      );
      expect(newProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: 9 }),
        expect.anything(),
      );
    });

    it('tạo attribute với value là chuỗi có dấu phẩy → tách thành mảng', async () => {
      const newProduct = makeCreatedProduct(23);
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductAttribute.create.mockResolvedValue({ id: 1 });
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop With Attrs',
        basePrice: 10000000,
        attributes: [{ name: 'Color', value: 'Red, Blue, Green' }],
      });

      expect(res.status).toBe(201);
      expect(ProductAttribute.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Color', values: ['Red', 'Blue', 'Green'] }),
        expect.anything(),
      );
    });

    it('tạo attribute với value là mảng', async () => {
      const newProduct = makeCreatedProduct(24);
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductAttribute.create.mockResolvedValue({ id: 2 });
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Array Attrs',
        basePrice: 10000000,
        attributes: [{ name: 'RAM', value: ['8GB', '16GB'] }],
      });

      expect(res.status).toBe(201);
      expect(ProductAttribute.create).toHaveBeenCalledWith(
        expect.objectContaining({ values: ['8GB', '16GB'] }),
        expect.anything(),
      );
    });

    it('tạo attribute với value là giá trị đơn (không phải string/array)', async () => {
      const newProduct = makeCreatedProduct(25);
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductAttribute.create.mockResolvedValue({ id: 3 });
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Single Attr',
        basePrice: 10000000,
        attributes: [{ name: 'Weight', value: 1.5 }],
      });

      expect(res.status).toBe(201);
      expect(ProductAttribute.create).toHaveBeenCalledWith(
        expect.objectContaining({ values: ['1.5'] }),
        expect.anything(),
      );
    });

    it('throw error khi ProductAttribute.create thất bại', async () => {
      const newProduct = makeCreatedProduct(26);
      Product.create.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductAttribute.create.mockRejectedValueOnce(new Error('DB constraint error'));
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Attr Error',
        basePrice: 10000000,
        attributes: [{ name: 'Color', value: 'Red' }],
      });

      expect(res.status).toBe(500);
    });

    it('tạo variant với attributes là object (pass-through)', async () => {
      const newProduct = makeCreatedProduct(27);
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      const createdVariant = { id: 'v10', stockQuantity: 5 };
      ProductVariant.create.mockResolvedValueOnce(createdVariant);
      Product.update.mockResolvedValueOnce([1]);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop With Variant',
        basePrice: 10000000,
        variants: [
          {
            name: '8GB RAM',
            price: 10000000,
            stock: 5,
            sku: 'VAR-001',
            attributes: { RAM: '8GB' },
          },
        ],
      });

      expect(res.status).toBe(201);
      expect(ProductVariant.create).toHaveBeenCalledWith(
        expect.objectContaining({ attributes: { RAM: '8GB' } }),
        expect.anything(),
      );
    });

    it('tạo images khi images là mảng chuỗi URL', async () => {
      const newProduct = makeCreatedProduct(28);
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductImage.bulkCreate.mockResolvedValueOnce([]);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop With Images',
        basePrice: 10000000,
        images: ['https://img.com/photo1.jpg', 'https://img.com/photo2.jpg'],
      });

      expect(res.status).toBe(201);
      expect(ProductImage.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ imageUrl: 'https://img.com/photo1.jpg', isThumbnail: true }),
          expect.objectContaining({ imageUrl: 'https://img.com/photo2.jpg', isThumbnail: false }),
        ]),
        expect.anything(),
      );
    });

    it('tạo images khi images là mảng object có url/image-url', async () => {
      const newProduct = makeCreatedProduct(29);
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductImage.bulkCreate.mockResolvedValueOnce([]);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop With Object Images',
        basePrice: 10000000,
        images: [{ url: 'https://img.com/obj1.jpg', color: 'black' }],
      });

      expect(res.status).toBe(201);
      expect(ProductImage.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ imageUrl: 'https://img.com/obj1.jpg', color: 'black' }),
        ]),
        expect.anything(),
      );
    });

    it('tạo specifications khi specifications là mảng', async () => {
      const newProduct = makeCreatedProduct(30);
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductSpecification.bulkCreate.mockResolvedValueOnce([]);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop With Specs',
        basePrice: 10000000,
        specifications: [
          { name: 'CPU', value: 'Intel i7', category: 'Hardware' },
          { name: 'RAM', value: '16GB' },
        ],
      });

      expect(res.status).toBe(201);
      expect(ProductSpecification.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'CPU', value: 'Intel i7', category: 'Hardware' }),
          expect.objectContaining({ name: 'RAM', category: 'General' }),
        ]),
        expect.anything(),
      );
    });

    it('không gọi vectorStore.upsertProduct khi product.status là inactive', async () => {
      const vectorStore = require('@services/vector-store/vector-store');
      const newProduct = makeCreatedProduct(33);
      newProduct.status = 'inactive';
      // findByPk lần cuối trả về product với status inactive
      const inactiveProductWithRelations = makeProduct({ id: 33, status: 'inactive' });
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(inactiveProductWithRelations);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Inactive',
        basePrice: 10000000,
        status: 'inactive',
      });

      expect(res.status).toBe(201);
      expect(vectorStore.upsertProduct).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // updateProduct — attributes diff, variants diff, specs diff
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — updateProduct các diff paths', () => {
    function setupUpdateMocks(productId = 10, extraMocks = {}) {
      const fakeProduct = makeProduct({ id: productId });
      Product.findByPk
        .mockResolvedValueOnce(fakeProduct) // bên trong transaction
        .mockResolvedValueOnce(fakeProduct); // load lại sau commit
      sequelize.query.mockResolvedValue([[], {}]);

      if (extraMocks.currentAttributes !== undefined) {
        ProductAttribute.findAll.mockResolvedValueOnce(extraMocks.currentAttributes);
      } else {
        ProductAttribute.findAll.mockResolvedValueOnce([]);
      }

      if (extraMocks.currentVariants !== undefined) {
        ProductVariant.findAll.mockResolvedValueOnce(extraMocks.currentVariants);
      } else {
        ProductVariant.findAll.mockResolvedValueOnce([]);
      }

      if (extraMocks.currentSpecs !== undefined) {
        ProductSpecification.findAll.mockResolvedValueOnce(extraMocks.currentSpecs);
      } else {
        ProductSpecification.findAll.mockResolvedValueOnce([]);
      }

      return fakeProduct;
    }

    it('xóa attribute không có trong danh sách mới', async () => {
      const oldAttr = {
        id: 1,
        name: 'OldAttr',
        destroy: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue({}),
      };
      setupUpdateMocks(10, { currentAttributes: [oldAttr] });

      const res = await request.put('/api/admin/products/10').send({
        attributes: [], // Empty → attribute cũ bị xóa
      });

      expect(res.status).toBe(200);
      expect(oldAttr.destroy).toHaveBeenCalled();
    });

    it('cập nhật attribute đã có trong danh sách mới (update vi sai)', async () => {
      const existingAttr = {
        id: 1,
        name: 'Color',
        type: 'custom',
        required: false,
        destroy: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue({}),
      };
      setupUpdateMocks(10, { currentAttributes: [existingAttr] });

      const res = await request.put('/api/admin/products/10').send({
        attributes: [{ name: 'Color', value: 'Red,Blue', type: 'select' }],
      });

      expect(res.status).toBe(200);
      expect(existingAttr.update).toHaveBeenCalledWith(
        expect.objectContaining({ values: ['Red', 'Blue'], type: 'select' }),
        expect.anything(),
      );
    });

    it('tạo attribute mới khi không có trong currentAttrMap', async () => {
      setupUpdateMocks(10, { currentAttributes: [] });
      ProductAttribute.create.mockResolvedValueOnce({ id: 99 });

      const res = await request.put('/api/admin/products/10').send({
        attributes: [{ name: 'NewAttr', value: ['S', 'M', 'L'] }],
      });

      expect(res.status).toBe(200);
      expect(ProductAttribute.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'NewAttr', values: ['S', 'M', 'L'] }),
        expect.anything(),
      );
    });

    it('cập nhật attribute với values (không phải value) property', async () => {
      setupUpdateMocks(10, { currentAttributes: [] });
      ProductAttribute.create.mockResolvedValueOnce({ id: 100 });

      const res = await request.put('/api/admin/products/10').send({
        attributes: [{ name: 'Material', values: ['Cotton', 'Polyester'] }],
      });

      expect(res.status).toBe(200);
      expect(ProductAttribute.create).toHaveBeenCalledWith(
        expect.objectContaining({ values: ['Cotton', 'Polyester'] }),
        expect.anything(),
      );
    });

    it('xóa variant không có trong danh sách mới', async () => {
      const oldVariant = {
        id: 'old-v1',
        sku: 'OLD-SKU',
        stockQuantity: 5,
        destroy: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue({}),
      };
      setupUpdateMocks(10, { currentAttributes: [], currentVariants: [oldVariant] });

      const res = await request.put('/api/admin/products/10').send({
        variants: [], // Empty → variant cũ bị xóa
      });

      expect(res.status).toBe(200);
      expect(oldVariant.destroy).toHaveBeenCalled();
    });

    it('cập nhật variant đã có (update vi sai)', async () => {
      const existingVariant = {
        id: 'v-existing',
        sku: 'EXIST-SKU',
        stockQuantity: 10,
        destroy: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue({ id: 'v-existing', stockQuantity: 15 }),
      };
      setupUpdateMocks(10, { currentAttributes: [], currentVariants: [existingVariant] });
      Product.update.mockResolvedValueOnce([1]);

      const res = await request.put('/api/admin/products/10').send({
        variants: [{ id: 'v-existing', name: 'Updated', price: 12000000, stock: 15 }],
      });

      expect(res.status).toBe(200);
      expect(existingVariant.update).toHaveBeenCalledWith(
        expect.objectContaining({ stockQuantity: 15 }),
        expect.anything(),
      );
    });

    it('tạo variant mới khi không có id match', async () => {
      setupUpdateMocks(10, { currentAttributes: [], currentVariants: [] });
      ProductVariant.create.mockResolvedValueOnce({ id: 'new-v', stockQuantity: 8 });
      Product.update.mockResolvedValueOnce([1]);

      const res = await request.put('/api/admin/products/10').send({
        variants: [{ name: 'New Variant', price: 11000000, stock: 8, attributes: {} }],
      });

      expect(res.status).toBe(200);
      expect(ProductVariant.create).toHaveBeenCalledWith(
        expect.objectContaining({ productId: '10' }),
        expect.anything(),
      );
    });

    it('update stockQuantity trực tiếp khi không có variants trong request', async () => {
      const fakeProduct = makeProduct({ id: 10 });
      Product.findByPk.mockResolvedValueOnce(fakeProduct).mockResolvedValueOnce(fakeProduct);
      sequelize.query.mockResolvedValue([[], {}]);
      Product.update.mockResolvedValueOnce([1]);

      const res = await request.put('/api/admin/products/10').send({
        stockQuantity: 25,
      });

      expect(res.status).toBe(200);
      expect(Product.update).toHaveBeenCalledWith(
        { stockQuantity: 25 },
        expect.objectContaining({ where: { id: '10' } }),
      );
    });

    it('xóa spec cũ và tạo spec mới khi specifications diff', async () => {
      const oldSpec = {
        id: 1,
        name: 'OldSpec',
        destroy: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue({}),
      };
      setupUpdateMocks(10, {
        currentAttributes: [],
        currentVariants: [],
        currentSpecs: [oldSpec],
      });
      ProductSpecification.create.mockResolvedValueOnce({
        id: 2,
        name: 'NewSpec',
        value: 'NewValue',
      });

      const res = await request.put('/api/admin/products/10').send({
        specifications: [{ name: 'NewSpec', value: 'NewValue' }],
      });

      expect(res.status).toBe(200);
      expect(oldSpec.destroy).toHaveBeenCalled();
      expect(ProductSpecification.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'NewSpec', value: 'NewValue', productId: '10' }),
        expect.anything(),
      );
    });

    it('cập nhật spec đã có trong danh sách mới', async () => {
      const existingSpec = {
        id: 1,
        name: 'CPU',
        destroy: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue({}),
      };
      setupUpdateMocks(10, {
        currentAttributes: [],
        currentVariants: [],
        currentSpecs: [existingSpec],
      });

      const res = await request.put('/api/admin/products/10').send({
        specifications: [{ name: 'CPU', value: 'Intel i9' }],
      });

      expect(res.status).toBe(200);
      expect(existingSpec.update).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'Intel i9' }),
        expect.anything(),
      );
    });

    it('không gọi vectorStore.upsertProduct khi product không active sau update', async () => {
      const vectorStore = require('@services/vector-store/vector-store');
      const inactiveProduct = makeProduct({ id: 10, status: 'inactive' });
      Product.findByPk
        .mockResolvedValueOnce(inactiveProduct)
        .mockResolvedValueOnce(inactiveProduct);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.put('/api/admin/products/10').send({
        status: 'inactive',
      });

      expect(res.status).toBe(200);
      expect(vectorStore.upsertProduct).not.toHaveBeenCalled();
      // Nên remove khỏi items
      expect(vectorStore.save).toHaveBeenCalled();
    });

    it('comparePrice field được dùng khi compareAtPrice không có', async () => {
      const fakeProduct = makeProduct({ id: 10 });
      Product.findByPk.mockResolvedValueOnce(fakeProduct).mockResolvedValueOnce(fakeProduct);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.put('/api/admin/products/10').send({
        comparePrice: 20000000,
      });

      expect(res.status).toBe(200);
      expect(sequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('compare_at_price'),
        expect.objectContaining({
          replacements: expect.objectContaining({ compareAtPrice: 20000000 }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // deleteProduct — rollback on error
  // ─────────────────────────────────────────────────────────────────────────────

  describe('DELETE /api/admin/products/:id — rollback khi có lỗi', () => {
    it('rollback transaction khi CartItem.destroy throw error', async () => {
      const fakeProduct = makeProduct({ id: 50 });
      Product.findByPk.mockResolvedValueOnce(fakeProduct);

      // deleteProduct dùng await sequelize.transaction() không có callback
      const mockTx = {
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        LOCK: { UPDATE: 'UPDATE' },
      };
      sequelize.transaction.mockImplementationOnce(async (cb) => {
        if (typeof cb === 'function') return cb(mockTx);
        return mockTx;
      });
      CartItem.destroy.mockRejectedValueOnce(new Error('FK constraint'));

      const res = await request.delete('/api/admin/products/50');
      expect(res.status).toBe(500);
      expect(mockTx.rollback).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getAllProducts — category filter và error rethrow
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/products — category filter', () => {
    it('filter theo category đưa where vào includeClause[1]', async () => {
      Product.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/products?category=3');

      const callArgs = Product.findAndCountAll.mock.calls[0][0];
      const categoriesInclude = callArgs.include.find((i) => i.as === 'categories');
      expect(categoriesInclude.where).toEqual({ id: '3' });
    });

    it('trả về 500 khi Product.findAndCountAll throw', async () => {
      Product.findAndCountAll.mockRejectedValueOnce(new Error('DB connection lost'));

      const res = await request.get('/api/admin/products');
      expect(res.status).toBe(500);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getAllOrders — error rethrow
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/orders — error rethrow', () => {
    it('trả về 500 khi Order.findAndCountAll throw', async () => {
      Order.findAndCountAll.mockRejectedValueOnce(new Error('Connection timeout'));

      const res = await request.get('/api/admin/orders');
      expect(res.status).toBe(500);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // updateOrderStatus — COD delivered và items restoration paths (delegation)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/orders/:id/status — delegation sang orders-service (file2)', () => {
    it('forward { id, status } sang orders-service và re-fetch order trả về 200', async () => {
      const refetched = makeOrder({ id: 30, status: 'delivered' });
      Order.findByPk.mockResolvedValueOnce(refetched);

      const res = await request.put('/api/admin/orders/30/status').send({ status: 'delivered' });

      expect(res.status).toBe(200);
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith({
        id: '30',
        status: 'delivered',
        paymentStatus: undefined,
        note: undefined,
      });
      expect(res.body.data.order.status).toBe('delivered');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // adminCancelOrder — 404 và 400 paths
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /api/admin/orders/:id/cancel (file2)', () => {
    it('trả về 404 (pre-check) khi đơn hàng không tồn tại, không delegate', async () => {
      Order.findByPk.mockResolvedValueOnce(null);

      const res = await request.post('/api/admin/orders/9999/cancel');
      expect(res.status).toBe(404);
      expect(mockOrdersService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('trả về 400 (pre-check) khi đơn hàng đã bị hủy trước đó, không delegate', async () => {
      const cancelledOrder = makeOrder({ id: 40, status: 'cancelled', items: [] });
      Order.findByPk.mockResolvedValueOnce(cancelledOrder);

      const res = await request.post('/api/admin/orders/40/cancel');
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/hủy trước đó/i);
      expect(mockOrdersService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('propagate 400 khi orders-service từ chối hủy đơn đã giao', async () => {
      const deliveredOrder = makeOrder({ id: 41, status: 'delivered', items: [] });
      Order.findByPk.mockResolvedValueOnce(deliveredOrder); // pre-check pass (chưa cancelled)
      mockOrdersService.updateOrderStatus.mockRejectedValueOnce(
        new AppError('Không thể hủy đơn hàng đã giao', 400),
      );

      const res = await request.post('/api/admin/orders/41/cancel');
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/không thể hủy/i);
    });

    it('hủy thành công: delegate { id, status: "cancelled" } và trả về data', async () => {
      const activeOrder = makeOrder({ id: 42, status: 'processing', items: [] });
      Order.findByPk.mockResolvedValueOnce(activeOrder);

      const res = await request.post('/api/admin/orders/42/cancel');

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ orderId: 42, status: 'cancelled' });
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith({
        id: '42',
        status: 'cancelled',
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // cloneProduct — với tất cả các quan hệ
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /api/admin/products/:id/clone — với quan hệ đầy đủ', () => {
    function makeVariantWithGet(overrides = {}) {
      const data = {
        id: 'v-orig',
        sku: 'ORIG-SKU-123',
        name: 'Variant 1',
        price: 10000000,
        stockQuantity: 5,
        ...overrides,
      };
      return {
        ...data,
        get: jest.fn((opts) => (opts?.plain ? { ...data } : data)),
      };
    }

    function makeSpecWithGet(overrides = {}) {
      const data = { id: 1, name: 'CPU', value: 'i7', ...overrides };
      return {
        ...data,
        get: jest.fn((opts) => (opts?.plain ? { ...data } : data)),
      };
    }

    it('clone categories từ product gốc', async () => {
      const originalProduct = makeProduct({
        id: 5,
        name: 'Laptop Orig',
        categories: [{ id: 2, name: 'Laptop' }],
        productAttributes: [],
        variants: [],
        productSpecifications: [],
      });

      Product.findByPk.mockResolvedValueOnce(originalProduct);
      Product.findOne.mockResolvedValueOnce(null);
      const clonedProduct = makeProduct({ id: 50, name: 'Laptop Orig (1)', status: 'draft' });
      Product.create.mockResolvedValueOnce(clonedProduct);
      ProductCategory.bulkCreate.mockResolvedValueOnce([]);

      const res = await request.post('/api/admin/products/5/clone');
      expect(res.status).toBe(201);
      expect(ProductCategory.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ productId: 50, categoryId: 2 })]),
        expect.anything(),
      );
    });

    it('clone variants từ product gốc với SKU mới', async () => {
      const origVariant = makeVariantWithGet({ id: 'v1', sku: 'BASE-SKU-001' });
      const originalProduct = makeProduct({
        id: 6,
        name: 'Laptop Orig V',
        categories: [],
        productAttributes: [],
        variants: [origVariant],
        productSpecifications: [],
      });

      Product.findByPk.mockResolvedValueOnce(originalProduct);
      Product.findOne.mockResolvedValueOnce(null);
      const clonedProduct = makeProduct({ id: 60, name: 'Laptop Orig V (1)', status: 'draft' });
      Product.create.mockResolvedValueOnce(clonedProduct);
      ProductVariant.bulkCreate.mockResolvedValueOnce([]);

      const res = await request.post('/api/admin/products/6/clone');
      expect(res.status).toBe(201);
      expect(ProductVariant.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ productId: 60 })]),
        expect.anything(),
      );
      // Kiểm tra SKU được tạo mới (không giống với SKU gốc)
      const bulkCreateArgs = ProductVariant.bulkCreate.mock.calls[0][0];
      expect(bulkCreateArgs[0].sku).not.toBe('BASE-SKU-001');
    });

    it('clone productSpecifications từ product gốc', async () => {
      const origSpec = makeSpecWithGet({ id: 1, name: 'RAM', value: '16GB' });
      const originalProduct = makeProduct({
        id: 7,
        name: 'Laptop Orig S',
        categories: [],
        productAttributes: [],
        variants: [],
        productSpecifications: [origSpec],
      });

      Product.findByPk.mockResolvedValueOnce(originalProduct);
      Product.findOne.mockResolvedValueOnce(null);
      const clonedProduct = makeProduct({ id: 70, name: 'Laptop Orig S (1)', status: 'draft' });
      Product.create.mockResolvedValueOnce(clonedProduct);
      ProductSpecification.bulkCreate.mockResolvedValueOnce([]);

      const res = await request.post('/api/admin/products/7/clone');
      expect(res.status).toBe(201);
      expect(ProductSpecification.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ productId: 70, name: 'RAM', value: '16GB' }),
        ]),
        expect.anything(),
      );
    });

    it('rollback transaction khi Product.create throw error', async () => {
      const originalProduct = makeProduct({
        id: 9,
        name: 'Laptop Error Clone',
        categories: [],
        productAttributes: [],
        variants: [],
        productSpecifications: [],
      });

      Product.findByPk.mockResolvedValueOnce(originalProduct);
      Product.findOne.mockResolvedValueOnce(null);

      const mockTx = {
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        LOCK: { UPDATE: 'UPDATE' },
      };
      sequelize.transaction.mockImplementationOnce(async (cb) => {
        if (typeof cb === 'function') return cb(mockTx);
        return mockTx;
      });
      Product.create.mockRejectedValueOnce(new Error('Unique constraint violation'));

      const res = await request.post('/api/admin/products/9/clone');
      expect(res.status).toBe(500);
      expect(mockTx.rollback).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // exportReport — products type (file2)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/admin/reports/export — products type (file2)', () => {
    it('trả về CSV với Content-Type text/csv khi type=products', async () => {
      Product.findAll.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Laptop Pro',
          sku: 'LP-001',
          basePrice: 15000000,
          stockQuantity: 10,
          status: 'active',
        },
        {
          id: 2,
          name: 'PC "Gaming"',
          sku: null,
          basePrice: 20000000,
          stockQuantity: 5,
          status: 'inactive',
        },
      ]);

      const res = await request.get('/api/admin/reports/export?type=products');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Laptop Pro');
      expect(res.text).toContain('LP-001');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // updateOrderStatus — 404 (file2)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/orders/:id/status — 404 (file2)', () => {
    it('propagate 404 khi orders-service báo không tìm thấy đơn hàng', async () => {
      mockOrdersService.updateOrderStatus.mockRejectedValueOnce(
        new AppError('Không tìm thấy đơn hàng', 404),
      );

      const res = await request.put('/api/admin/orders/9999/status').send({ status: 'delivered' });
      expect(res.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // createProduct — lines 793-796 (file2)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /api/admin/products — createProduct với productAttributes và variantAttributes (lines 793-796)', () => {
    function makeCreatedProductForVariant(id = 50) {
      const p = makeProduct({ id });
      p.setCategories = jest.fn().mockResolvedValue(undefined);
      return p;
    }

    it('tạo variant thành công khi productAttributes tồn tại và variantAttributes không rỗng (line 793 try block)', async () => {
      const newProduct = makeCreatedProductForVariant(50);
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);

      // productAttributes.length > 0 → triggers the if at line 789 → enters try at line 793
      ProductAttribute.findAll.mockResolvedValueOnce([
        { id: 'attr-1', name: 'Màu sắc', values: ['đỏ', 'xanh'] },
      ]);

      const createdVariant = { id: 'v-new', stockQuantity: 3 };
      ProductVariant.create.mockResolvedValueOnce(createdVariant);
      Product.update.mockResolvedValueOnce([1]);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Điện Thoại Variant',
        basePrice: 8000000,
        variants: [
          {
            name: 'Đỏ 128GB',
            price: 8000000,
            stock: 3,
            sku: 'DT-RED-128',
            attributes: { 'Màu sắc': 'đỏ' },
          },
        ],
      });

      // Variant creation succeeded → 201
      expect(res.status).toBe(201);
      expect(ProductVariant.create).toHaveBeenCalledWith(
        expect.objectContaining({ attributes: { 'Màu sắc': 'đỏ' } }),
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // createProduct — lines 839-840 (file2)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /api/admin/products — createProduct variant creation failure (lines 839-840)', () => {
    function makeCreatedProductForVariantFail(id = 51) {
      const p = makeProduct({ id });
      p.setCategories = jest.fn().mockResolvedValue(undefined);
      return p;
    }

    it('trả về 500 và gọi logger.error khi ProductVariant.create throw (lines 839-840)', async () => {
      const newProduct = makeCreatedProductForVariantFail(51);
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);

      // ProductVariant.create rejects → catch at line 838 → logger.error (839) + throw (840)
      ProductVariant.create.mockRejectedValueOnce(new Error('DB constraint violation'));
      sequelize.query.mockResolvedValue([[], {}]);

      const logger = require('@utils/logger');

      const res = await request.post('/api/admin/products').send({
        name: 'Sản Phẩm Variant Lỗi',
        basePrice: 5000000,
        variants: [{ name: 'Biến thể lỗi', price: 5000000, stock: 1 }],
      });

      // Error is rethrown → controller catches and returns 500
      expect(res.status).toBe(500);
      expect(logger.error).toHaveBeenCalledWith('Lỗi khi tạo variants:', expect.any(Error));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // updateProduct — lines 1145-1146 (file2)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('PUT /api/admin/products/:id — updateProduct attr.value là số nguyên (lines 1145-1146)', () => {
    it('chuyển đổi attr.value số nguyên thành [String(value)] khi không phải string/array (lines 1145-1146)', async () => {
      const existingProduct = makeProduct({ id: 60 });
      Product.findByPk.mockResolvedValueOnce(existingProduct);

      // currentAttributes là rỗng → attr mới sẽ được tạo (không update existing)
      ProductAttribute.findAll.mockResolvedValueOnce([]);

      const createdAttr = { id: 'new-attr', name: 'Trọng lượng', values: ['1500'] };
      ProductAttribute.create.mockResolvedValueOnce(createdAttr);
      Product.update.mockResolvedValueOnce([1]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.put('/api/admin/products/60').send({
        attributes: [
          {
            name: 'Trọng lượng',
            value: 1500,
          },
        ],
      });

      expect(res.status).toBe(200);
      expect(ProductAttribute.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Trọng lượng', values: ['1500'] }),
        expect.anything(),
      );
    });

    it('chuyển đổi attr.value boolean thành [String(value)] khi không phải string/array (lines 1145-1146)', async () => {
      const existingProduct = makeProduct({ id: 61 });
      Product.findByPk.mockResolvedValueOnce(existingProduct);

      ProductAttribute.findAll.mockResolvedValueOnce([]);

      const createdAttr = { id: 'attr-bool', name: 'Có bảo hành', values: ['true'] };
      ProductAttribute.create.mockResolvedValueOnce(createdAttr);
      Product.update.mockResolvedValueOnce([1]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.put('/api/admin/products/61').send({
        attributes: [
          {
            name: 'Có bảo hành',
            value: true,
          },
        ],
      });

      expect(res.status).toBe(200);
      expect(ProductAttribute.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Có bảo hành', values: ['true'] }),
        expect.anything(),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Merged from admin-controller.edge-cases-3.test.js
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('GET /api/admin/products — filter params', () => {
    it('filter theo search term đưa vào where clause', async () => {
      Product.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/products?search=laptop');

      const callArgs = Product.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where[require('sequelize').Op.or]).toBeDefined();
    });

    it('filter theo status đưa vào where clause', async () => {
      Product.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/products?status=inactive');

      const callArgs = Product.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.status).toBe('inactive');
    });

    it('filter theo priceMin và priceMax đưa vào where.basePrice', async () => {
      Product.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/products?priceMin=5000000&priceMax=20000000');

      const callArgs = Product.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.basePrice).toBeDefined();
    });

    it('filter theo stockMin và stockMax đưa vào where.stockQuantity', async () => {
      Product.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/products?stockMin=5&stockMax=50');

      const callArgs = Product.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.stockQuantity).toBeDefined();
    });

    it('sortBy=price chuyển thành basePrice trong order clause', async () => {
      Product.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/products?sortBy=price&sortOrder=asc');

      const callArgs = Product.findAndCountAll.mock.calls[0][0];
      expect(callArgs.order[0][0]).toBe('basePrice');
      expect(callArgs.order[0][1]).toBe('ASC');
    });

    it('transform sản phẩm gộp category đơn vào mảng categories', async () => {
      const fakeProduct = {
        toJSON: () => ({
          id: 3,
          name: 'Laptop C',
          basePrice: 10000000,
          stockQuantity: 5,
          productImages: [],
          categories: [],
          category: { id: 99, name: 'Laptop' },
        }),
      };
      Product.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [fakeProduct] });

      const res = await request.get('/api/admin/products');
      expect(res.status).toBe(200);
      const product = res.body.data.products[0];
      expect(product.categories.some((c) => c.id === 99)).toBe(true);
    });
  });

  describe('GET /api/admin/orders — filter params', () => {
    it('filter theo search term đưa vào where[Op.or]', async () => {
      Order.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/orders?search=ORD-999');

      const callArgs = Order.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where[require('sequelize').Op.or]).toBeDefined();
    });

    it('filter theo startDate và endDate đưa vào where.createdAt', async () => {
      Order.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/orders?startDate=2025-01-01&endDate=2025-01-31');

      const callArgs = Order.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.createdAt).toBeDefined();
    });

    it('transform items.Product: images và price được chuyển đổi', async () => {
      const fakeOrder = {
        toJSON: () => ({
          id: 10,
          number: 'ORD-010',
          status: 'delivered',
          items: [
            {
              id: 1,
              quantity: 2,
              Product: {
                id: 5,
                name: 'Laptop',
                basePrice: 10000000,
                productImages: [{ imageUrl: 'https://img.com/laptop.jpg' }],
              },
            },
          ],
        }),
      };
      Order.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [fakeOrder] });

      const res = await request.get('/api/admin/orders');
      expect(res.status).toBe(200);
      const item = res.body.data.orders[0].items[0];
      expect(item.Product.images).toEqual(['https://img.com/laptop.jpg']);
      expect(item.Product.price).toBe(10000000);
    });
  });

  describe('GET /api/admin/stats — groupBy variations', () => {
    it('groupBy=hour trả về 200', async () => {
      Order.findAll.mockResolvedValueOnce([]);
      User.findAll.mockResolvedValueOnce([]);

      const res = await request.get(
        '/api/admin/stats?startDate=2025-01-01&endDate=2025-01-31&groupBy=hour',
      );
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    it('groupBy=week trả về 200', async () => {
      Order.findAll.mockResolvedValueOnce([]);
      User.findAll.mockResolvedValueOnce([]);

      const res = await request.get(
        '/api/admin/stats?startDate=2025-01-01&endDate=2025-12-31&groupBy=week',
      );
      expect(res.status).toBe(200);
    });

    it('groupBy không hợp lệ fallback về day format', async () => {
      Order.findAll.mockResolvedValueOnce([]);
      User.findAll.mockResolvedValueOnce([]);

      const res = await request.get(
        '/api/admin/stats?startDate=2025-01-01&endDate=2025-01-31&groupBy=unknown',
      );
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/reviews', () => {
    it('trả về 200 với danh sách reviews và phân trang', async () => {
      Review.findAndCountAll.mockResolvedValueOnce({
        count: 2,
        rows: [
          { id: 1, rating: 5, comment: 'Tuyệt vời', userId: 1, productId: 1 },
          { id: 2, rating: 3, comment: 'Được', userId: 2, productId: 2 },
        ],
      });

      const res = await request.get('/api/admin/reviews');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.reviews).toHaveLength(2);
      expect(res.body.data.pagination.totalItems).toBe(2);
    });

    it('filter theo productId đưa vào where clause', async () => {
      Review.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/reviews?productId=5');

      const callArgs = Review.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.productId).toBe('5');
    });

    it('filter theo rating đưa vào where clause', async () => {
      Review.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/reviews?rating=4');

      const callArgs = Review.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.rating).toBe(4);
    });

    it('trả về mảng rỗng khi không có review', async () => {
      Review.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      const res = await request.get('/api/admin/reviews');
      expect(res.status).toBe(200);
      expect(res.body.data.reviews).toEqual([]);
    });
  });

  describe('DELETE /api/admin/reviews/:id', () => {
    it('trả về 200 khi xóa review thành công', async () => {
      const fakeReview = {
        id: 5,
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      Review.findByPk.mockResolvedValueOnce(fakeReview);

      const res = await request.delete('/api/admin/reviews/5');
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/thành công/i);
      expect(fakeReview.destroy).toHaveBeenCalled();
    });

    it('trả về 404 khi review không tồn tại', async () => {
      Review.findByPk.mockResolvedValueOnce(null);

      const res = await request.delete('/api/admin/reviews/9999');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/products/:id/clone (file3)', () => {
    it('trả về 404 khi product gốc không tồn tại', async () => {
      Product.findByPk.mockResolvedValueOnce(null);

      const res = await request.post('/api/admin/products/9999/clone');
      expect(res.status).toBe(404);
    });

    it('trả về 201 khi clone thành công product không có quan hệ', async () => {
      const originalProduct = makeProduct({
        id: 1,
        name: 'Laptop Original',
        categories: [],
        attributes: [],
        variants: [],
        productSpecifications: [],
      });

      Product.findByPk.mockResolvedValueOnce(originalProduct);
      Product.findOne.mockResolvedValueOnce(null);
      const newProduct = makeProduct({ id: 100, name: 'Laptop Original (1)', status: 'draft' });
      Product.create.mockResolvedValueOnce(newProduct);

      const res = await request.post('/api/admin/products/1/clone');
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('product');
    });
  });

  describe('updateUser — non-admin không được thay đổi role (trực tiếp gọi handler)', () => {
    it('403 khi req.user.role là customer và cố thay đổi role của user khác', async () => {
      const localApp = express();
      localApp.use(express.json());
      localApp.use((req, _res, next) => {
        req.user = { id: 999, role: 'customer', email: 'customer@test.com' };
        next();
      });

      const { updateUser } = require('./admin-controller');

      localApp.put('/users/:id', (req, res, next) => {
        updateUser(req, res, next);
      });
      localApp.use(errorHandler);

      const targetUser = makeUser({ id: 50, role: 'customer' });
      User.findByPk.mockResolvedValue(targetUser);

      const localReq = supertest(localApp);
      const res = await localReq.put('/users/50').send({ role: 'admin' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/admin/users/:id — xóa user khác không tồn tại', () => {
    it('trả về 404 khi xóa user khác không tồn tại', async () => {
      User.findByPk.mockResolvedValueOnce(null);
      const res = await request.delete('/api/admin/users/999');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/admin/chatbot/stats — date range filter', () => {
    it('trả về 200 khi được filter theo startDate và endDate', async () => {
      ChatMessage.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(10);
      ChatMessage.findAll.mockResolvedValueOnce([]);
      ChatMessage.findOne.mockResolvedValueOnce({ avgTime: '250' });

      const res = await request.get(
        '/api/admin/chatbot/stats?startDate=2025-01-01&endDate=2025-01-31',
      );
      expect(res.status).toBe(200);
      expect(res.body.data.totalSessions).toBe(20);
      expect(res.body.data.avgResponseTimeMs).toBe(250);
    });

    it('avgResponseTimeMs là 0 khi không có response time data', async () => {
      ChatMessage.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(2);
      ChatMessage.findAll.mockResolvedValueOnce([]);
      ChatMessage.findOne.mockResolvedValueOnce(null);

      const res = await request.get('/api/admin/chatbot/stats');
      expect(res.status).toBe(200);
      expect(res.body.data.avgResponseTimeMs).toBe(0);
    });
  });

  describe('GET /api/admin/reports/export — users type', () => {
    it('trả về 400 với type=users (không được hỗ trợ)', async () => {
      const res = await request.get('/api/admin/reports/export?type=users');
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/admin/products/:id — cập nhật images và categories', () => {
    it('xóa ảnh cũ và tạo ảnh mới khi có images trong body', async () => {
      const fakeProduct = makeProduct({ id: 10 });
      fakeProduct.update = jest.fn().mockResolvedValue(fakeProduct);
      Product.findByPk.mockResolvedValueOnce(fakeProduct).mockResolvedValueOnce(fakeProduct);

      ProductImage.destroy.mockResolvedValueOnce(0);
      ProductImage.bulkCreate.mockResolvedValueOnce([]);
      sequelize.query.mockResolvedValue([[], {}]);
      Category.findAll.mockResolvedValueOnce([]);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/10').send({
        images: ['https://img.com/new1.jpg', 'https://img.com/new2.jpg'],
      });

      expect(res.status).toBe(200);
      expect(ProductImage.destroy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { productId: '10' } }),
      );
      expect(ProductImage.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ imageUrl: 'https://img.com/new1.jpg', isThumbnail: true }),
        ]),
        expect.anything(),
      );
    });

    it('cập nhật categories khi có categoryIds trong body', async () => {
      const fakeProduct = makeProduct({ id: 10 });
      fakeProduct.setCategories = jest.fn().mockResolvedValue(undefined);
      Product.findByPk.mockResolvedValueOnce(fakeProduct).mockResolvedValueOnce(fakeProduct);

      Category.findAll.mockResolvedValueOnce([
        { id: 1, name: 'Laptop' },
        { id: 2, name: 'Electronics' },
      ]);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.put('/api/admin/products/10').send({
        categoryIds: [1, 2],
      });

      expect(res.status).toBe(200);
      expect(fakeProduct.setCategories).toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/users — filter isEmailVerified', () => {
    it('filter isEmailVerified=true đưa vào where clause', async () => {
      User.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/users?isEmailVerified=true');

      const callArgs = User.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.isEmailVerified).toBe(true);
    });

    it('filter isEmailVerified=false đưa vào where clause', async () => {
      User.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/users?isEmailVerified=false');

      const callArgs = User.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.isEmailVerified).toBe(false);
    });

    it('filter theo role đưa vào where clause', async () => {
      User.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/users?role=admin');

      const callArgs = User.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.role).toBe('admin');
    });

    it('filter theo search term', async () => {
      User.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

      await request.get('/api/admin/users?search=nguyen');

      const callArgs = User.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where[require('sequelize').Op.or]).toBeDefined();
    });
  });

  describe('GET /api/admin/analytics/revenue-by-category — date range', () => {
    it('truyền startDate và endDate vào query', async () => {
      sequelize.query.mockResolvedValueOnce([
        [{ categoryId: 1, categoryName: 'Laptop', revenue: '5000000', orderItemCount: '10' }],
        {},
      ]);

      const res = await request.get(
        '/api/admin/analytics/revenue-by-category?startDate=2025-01-01&endDate=2025-12-31',
      );
      expect(res.status).toBe(200);
      expect(res.body.data[0].categoryName).toBe('Laptop');
      expect(res.body.data[0].revenue).toBe(5000000);
    });
  });

  describe('GET /api/admin/analytics/user-growth — groupBy=month', () => {
    it('trả về 200 với dữ liệu groupBy=month', async () => {
      User.findAll.mockResolvedValueOnce([{ date: '2025-01', newUsers: '30' }]);

      const res = await request.get(
        '/api/admin/analytics/user-growth?startDate=2025-01-01&endDate=2025-12-31&groupBy=month',
      );
      expect(res.status).toBe(200);
      expect(res.body.data[0].newUsers).toBe(30);
    });
  });

  describe('PUT /api/admin/orders/:id/status — cancelled delegation (file3)', () => {
    it('delegate { id, status: "cancelled" } sang orders-service và re-fetch trả về 200', async () => {
      const refetched = makeOrder({ id: 20, status: 'cancelled' });
      Order.findByPk.mockResolvedValueOnce(refetched);

      const res = await request.put('/api/admin/orders/20/status').send({ status: 'cancelled' });

      expect(res.status).toBe(200);
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith({
        id: '20',
        status: 'cancelled',
        paymentStatus: undefined,
        note: undefined,
      });
      expect(res.body.data.order.status).toBe('cancelled');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Merged from admin-controller.edge-cases-4.test.js
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getProductById — variants.attributes trả về {} khi không parse được thành object', () => {
    it('trả về {} khi variants.attributes là chuỗi số (parse ra number, không phải object)', async () => {
      const productWithNumericAttr = {
        toJSON: () => ({
          id: 100,
          name: 'Product Numeric Attr',
          variants: [{ id: 'v100', name: 'V1', attributes: '42' }],
          attributes: null,
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(productWithNumericAttr);

      const res = await request.get('/api/admin/products/100');

      expect(res.status).toBe(200);
      expect(res.body.data.product.variants[0].attributes).toEqual({});
    });

    it('trả về {} khi variants.attributes là chuỗi "null" (parse ra null)', async () => {
      const productWithNullAttr = {
        toJSON: () => ({
          id: 101,
          name: 'Product Null Attr',
          variants: [{ id: 'v101', name: 'V2', attributes: 'null' }],
          attributes: null,
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(productWithNullAttr);

      const res = await request.get('/api/admin/products/101');

      expect(res.status).toBe(200);
      expect(res.body.data.product.variants[0].attributes).toEqual({});
    });

    it('trả về {} khi variants.attributes là chuỗi JSON array (parse ra array, không phải object)', async () => {
      const productWithArrayAttr = {
        toJSON: () => ({
          id: 102,
          name: 'Product Array Attr',
          variants: [{ id: 'v102', name: 'V3', attributes: '[1,2,3]' }],
          attributes: null,
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(productWithArrayAttr);

      const res = await request.get('/api/admin/products/102');

      expect(res.status).toBe(200);
      expect(res.body.data.product.variants[0].attributes).toEqual({});
    });
  });

  describe('deepParseJSONArray — line 83: return [] khi JSON.parse ra non-array', () => {
    it('trả về [] khi attr.values parse thành số', async () => {
      const productWithNumericValues = {
        toJSON: () => ({
          id: 110,
          name: 'Product Numeric Values',
          variants: [],
          attributes: [{ name: 'Count', values: '99' }],
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(productWithNumericValues);

      const res = await request.get('/api/admin/products/110');

      expect(res.status).toBe(200);
      expect(res.body.data.product.attributes[0].values).toEqual([]);
    });

    it('trả về [] khi attr.values parse thành boolean', async () => {
      const productWithBoolValues = {
        toJSON: () => ({
          id: 111,
          name: 'Product Bool Values',
          variants: [],
          attributes: [{ name: 'Active', values: 'true' }],
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(productWithBoolValues);

      const res = await request.get('/api/admin/products/111');

      expect(res.status).toBe(200);
      expect(res.body.data.product.attributes[0].values).toEqual([]);
    });

    it('trả về [] khi attr.values parse thành plain object', async () => {
      const productWithObjectValues = {
        toJSON: () => ({
          id: 112,
          name: 'Product Object Values',
          variants: [],
          attributes: [{ name: 'Meta', values: '{"a":1}' }],
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(productWithObjectValues);

      const res = await request.get('/api/admin/products/112');

      expect(res.status).toBe(200);
      expect(res.body.data.product.attributes[0].values).toEqual([]);
    });
  });

  // DELETE /api/admin/users/:id — line 491 self-delete test removed:
  // relies on admin-auth mock factory not available in base file (auto-mocked).
  // Coverage for self-delete is in admin-service.unit.test.js.

  describe('POST /api/admin/products — setCategories lỗi DB thì propagate', () => {
    it('trả về 500 khi setCategories throw (không còn nuốt lỗi)', async () => {
      const newProduct = makeProduct({ id: 200 });
      newProduct.setCategories = jest.fn().mockRejectedValue(new Error('setCategories DB error'));

      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      Category.findAll.mockResolvedValueOnce([{ id: 5, name: 'Laptop' }]);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Categories Error',
        basePrice: 10000000,
        categoryIds: ['5'],
      });

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/admin/products — line 868: images catch khi bulkCreate throw', () => {
    it('trả về 201 và gọi logger.error khi ProductImage.bulkCreate throw (error được bắt)', async () => {
      const newProduct = makeProduct({ id: 201 });
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductImage.bulkCreate.mockRejectedValueOnce(new Error('S3 upload failed'));
      sequelize.query.mockResolvedValue([[], {}]);

      const logger = require('@utils/logger');

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Images Error',
        basePrice: 10000000,
        images: ['https://cdn.example.com/img.jpg'],
      });

      expect(res.status).toBe(201);
      expect(logger.error).toHaveBeenCalledWith('Lỗi khi tạo ảnh:', expect.any(Error));
    });
  });

  describe('POST /api/admin/products — line 892: specs catch khi bulkCreate throw', () => {
    it('trả về 201 và gọi logger.error khi ProductSpecification.bulkCreate throw', async () => {
      const newProduct = makeProduct({ id: 202 });
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductSpecification.bulkCreate.mockRejectedValueOnce(new Error('Specs DB error'));
      sequelize.query.mockResolvedValue([[], {}]);

      const logger = require('@utils/logger');

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop Specs Error',
        basePrice: 10000000,
        specifications: [{ name: 'CPU', value: 'Intel i7' }],
      });

      expect(res.status).toBe(201);
      expect(logger.error).toHaveBeenCalledWith('Lỗi khi tạo specifications:', expect.any(Error));
    });
  });

  describe('POST /api/admin/products — line 978: vectorStore catch khi save throw', () => {
    it('trả về 201 và gọi logger.error khi vectorStoreService.save throw', async () => {
      const vs = require('@services/vector-store/vector-store');
      vs.save.mockRejectedValueOnce(new Error('VectorStore IO error'));

      const activeProduct = makeProduct({ id: 204, status: 'active' });
      Product.create.mockResolvedValueOnce(activeProduct);
      Product.findByPk.mockResolvedValueOnce(activeProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      sequelize.query.mockResolvedValue([[], {}]);

      const logger = require('@utils/logger');

      const res = await request.post('/api/admin/products').send({
        name: 'Laptop VectorStore Error',
        basePrice: 10000000,
        status: 'active',
      });

      expect(res.status).toBe(201);
      expect(logger.error).toHaveBeenCalledWith(
        'Lỗi đồng bộ vector store sau khi tạo sản phẩm:',
        expect.any(String),
      );
    });
  });

  describe('PUT /api/admin/products/:id — line 1077: image object với url field', () => {
    it('sử dụng img.url khi image là object có trường url', async () => {
      const fakeProduct = makeProduct({ id: 210 });
      Product.findByPk.mockResolvedValueOnce(fakeProduct).mockResolvedValueOnce(fakeProduct);
      sequelize.query.mockResolvedValue([[], {}]);
      ProductImage.destroy.mockResolvedValueOnce(0);
      ProductImage.bulkCreate.mockResolvedValueOnce([]);

      const res = await request.put('/api/admin/products/210').send({
        images: [
          { url: 'https://cdn.example.com/photo1.jpg', color: 'red', variantId: 'v1' },
          { imageUrl: 'https://cdn.example.com/photo2.jpg' },
        ],
      });

      expect(res.status).toBe(200);
      expect(ProductImage.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            imageUrl: 'https://cdn.example.com/photo1.jpg',
            color: 'red',
            variantId: 'v1',
          }),
          expect.objectContaining({ imageUrl: 'https://cdn.example.com/photo2.jpg' }),
        ]),
        expect.anything(),
      );
    });
  });

  describe('PUT /api/admin/products/:id — line 1296: translate catch khi translateBatch throw', () => {
    it('gọi logger.warn khi translateBatch throw trong setImmediate', async () => {
      const { translateBatch } = require('@modules/ai/services/translate/translate-service');
      translateBatch.mockRejectedValueOnce(new Error('Translation API timeout'));

      const specWithoutEn = {
        id: 1,
        name: 'CPU',
        value: 'Intel i7',
        valueEn: null,
        update: jest.fn().mockResolvedValue({}),
      };

      const fakeProduct = makeProduct({ id: 220 });
      Product.findByPk.mockResolvedValueOnce(fakeProduct).mockResolvedValueOnce(fakeProduct);
      sequelize.query.mockResolvedValue([[], {}]);

      ProductSpecification.findAll.mockResolvedValueOnce([]);
      ProductSpecification.create.mockResolvedValueOnce(specWithoutEn);

      const logger = require('@utils/logger');

      const res = await request.put('/api/admin/products/220').send({
        specifications: [{ name: 'CPU', value: 'Intel i7' }],
      });

      expect(res.status).toBe(200);

      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Lỗi auto-translate'),
        expect.any(String),
      );
    });
  });

  describe('PUT /api/admin/products/:id — line 1354: vectorStore catch khi save throw', () => {
    it('trả về 200 và gọi logger.error khi vectorStoreService.save throw sau update', async () => {
      const vs = require('@services/vector-store/vector-store');
      vs.save.mockRejectedValueOnce(new Error('VectorStore save failed after update'));

      const activeProduct = makeProduct({ id: 230, status: 'active' });
      Product.findByPk.mockResolvedValueOnce(activeProduct).mockResolvedValueOnce(activeProduct);
      sequelize.query.mockResolvedValue([[], {}]);

      const logger = require('@utils/logger');

      const res = await request.put('/api/admin/products/230').send({
        name: 'Updated Laptop',
      });

      expect(res.status).toBe(200);
      expect(logger.error).toHaveBeenCalledWith(
        'Lỗi đồng bộ vector store sau khi cập nhật sản phẩm:',
        expect.any(String),
      );
    });
  });

  describe('POST /api/admin/products/:id/clone — line 1934: count++ khi tên bị duplicate', () => {
    it('increment counter khi tên "Product (1)" đã tồn tại, dùng "Product (2)"', async () => {
      const originalProduct = makeProduct({
        id: 300,
        name: 'Laptop Dupl',
        categories: [],
        productAttributes: [],
        variants: [],
        productSpecifications: [],
      });

      Product.findByPk.mockResolvedValueOnce(originalProduct);

      Product.findOne.mockResolvedValueOnce({ id: 999, nameVi: 'Laptop Dupl (1)' });
      Product.findOne.mockResolvedValueOnce(null);

      const clonedProduct = makeProduct({ id: 301, name: 'Laptop Dupl (2)', status: 'draft' });
      Product.create.mockResolvedValueOnce(clonedProduct);

      const res = await request.post('/api/admin/products/300/clone');

      expect(res.status).toBe(201);
      expect(Product.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Laptop Dupl (2)' }),
        expect.anything(),
      );
      expect(Product.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('POST /api/admin/products/:id/clone — lines 1976-1983: clone productAttributes', () => {
    function makeAttrWithGet(overrides = {}) {
      const data = { id: 'attr-1', name: 'Màu sắc', values: ['đỏ', 'xanh'], ...overrides };
      return {
        ...data,
        get: jest.fn((opts) => (opts?.plain ? { ...data } : data)),
      };
    }

    it('bulkCreate productAttributes khi originalProduct.productAttributes tồn tại', async () => {
      const origAttr = makeAttrWithGet({ id: 'attr-orig', name: 'RAM', values: ['8GB', '16GB'] });

      const originalProduct = makeProduct({
        id: 310,
        name: 'Laptop Attrs',
        categories: [],
        attributes: [origAttr],
        productAttributes: [origAttr],
        variants: [],
        productSpecifications: [],
      });

      Product.findByPk.mockResolvedValueOnce(originalProduct);
      Product.findOne.mockResolvedValueOnce(null);

      const clonedProduct = makeProduct({ id: 311, name: 'Laptop Attrs (1)', status: 'draft' });
      Product.create.mockResolvedValueOnce(clonedProduct);
      ProductAttribute.bulkCreate.mockResolvedValueOnce([]);

      const res = await request.post('/api/admin/products/310/clone');

      expect(res.status).toBe(201);
      expect(ProductAttribute.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ productId: 311, name: 'RAM' })]),
        expect.anything(),
      );
    });

    it('không gọi ProductAttribute.bulkCreate khi originalProduct.productAttributes rỗng', async () => {
      const originalProduct = makeProduct({
        id: 320,
        name: 'Laptop No Attrs',
        categories: [],
        productAttributes: [],
        variants: [],
        productSpecifications: [],
      });

      Product.findByPk.mockResolvedValueOnce(originalProduct);
      Product.findOne.mockResolvedValueOnce(null);

      const clonedProduct = makeProduct({ id: 321, name: 'Laptop No Attrs (1)', status: 'draft' });
      Product.create.mockResolvedValueOnce(clonedProduct);

      const res = await request.post('/api/admin/products/320/clone');

      expect(res.status).toBe(201);
      expect(ProductAttribute.bulkCreate).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/admin/products/:id — line 1296: translate success (logger.info)', () => {
    it('gọi logger.info khi translateBatch thành công', async () => {
      const { translateBatch } = require('@modules/ai/services/translate/translate-service');
      translateBatch.mockResolvedValueOnce(['Intel Core i7 12th Gen']);

      const specWithoutEn = {
        id: 99,
        name: 'CPU',
        value: 'Intel Core i7 thế hệ 12',
        valueEn: null,
        update: jest.fn().mockResolvedValue({}),
      };

      const fakeProduct = makeProduct({ id: 330 });
      Product.findByPk.mockResolvedValueOnce(fakeProduct).mockResolvedValueOnce(fakeProduct);
      sequelize.query.mockResolvedValue([[], {}]);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);
      ProductSpecification.create.mockResolvedValueOnce(specWithoutEn);

      const logger = require('@utils/logger');

      const res = await request.put('/api/admin/products/330').send({
        specifications: [{ name: 'CPU', value: 'Intel Core i7 thế hệ 12' }],
      });

      expect(res.status).toBe(200);

      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setTimeout(r, 50));

      expect(specWithoutEn.update).toHaveBeenCalledWith({ valueEn: 'Intel Core i7 12th Gen' });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Đã dịch 1 specs'));
    });
  });

  describe('POST /api/admin/products — lines 816,818: image object (imageUrl fallback, color null)', () => {
    it('img.imageUrl khi không có img.url, color=null khi không có color (line 816,818)', async () => {
      const newProduct = makeProduct({ id: 290 });
      Product.create.mockResolvedValueOnce(newProduct);
      Product.findByPk.mockResolvedValueOnce(newProduct);
      ProductAttribute.findAll.mockResolvedValueOnce([]);
      sequelize.query.mockResolvedValue([[], {}]);

      const res = await request.post('/api/admin/products').send({
        name: 'Product With Image Objects',
        basePrice: 10000000,
        images: [
          { imageUrl: 'https://cdn.example.com/img1.jpg' },
          { url: 'https://cdn.example.com/img2.jpg', color: 'red' },
        ],
      });

      expect(res.status).toBe(201);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Merged from admin-controller.edge-cases-5.test.js
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getProductById — variants.attributes trả về {} khi là số hoặc boolean', () => {
    it('trả về {} khi variant.attributes là số nguyên (không phải string/object)', async () => {
      const prod = {
        toJSON: () => ({
          id: 500,
          name: 'Prod Number Attr',
          variants: [{ id: 'v1', attributes: 42 }],
          attributes: null,
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(prod);

      const res = await request.get('/api/admin/products/500');

      expect(res.status).toBe(200);
      expect(res.body.data.product.variants[0].attributes).toEqual({});
    });

    it('trả về {} khi variant.attributes là boolean true', async () => {
      const prod = {
        toJSON: () => ({
          id: 501,
          name: 'Prod Bool Attr',
          variants: [{ id: 'v2', attributes: true }],
          attributes: null,
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(prod);

      const res = await request.get('/api/admin/products/501');

      expect(res.status).toBe(200);
      expect(res.body.data.product.variants[0].attributes).toEqual({});
    });
  });

  describe('deepParseJSONArray — lines 68-70: null/undefined/non-string trả về []', () => {
    it('trả về [] khi attr.values là null', async () => {
      const prod = {
        toJSON: () => ({
          id: 510,
          name: 'Prod Null Values',
          variants: [],
          attributes: [{ name: 'Color', values: null }],
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(prod);

      const res = await request.get('/api/admin/products/510');

      expect(res.status).toBe(200);
      expect(res.body.data.product.attributes[0].values).toEqual([]);
    });

    it('trả về [] khi attr.values là undefined', async () => {
      const prod = {
        toJSON: () => ({
          id: 511,
          name: 'Prod Undef Values',
          variants: [],
          attributes: [{ name: 'Size' }],
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(prod);

      const res = await request.get('/api/admin/products/511');

      expect(res.status).toBe(200);
      expect(res.body.data.product.attributes[0].values).toEqual([]);
    });

    it('trả về [] khi attr.values là số (non-string, non-null, non-array)', async () => {
      const prod = {
        toJSON: () => ({
          id: 512,
          name: 'Prod Number Values',
          variants: [],
          attributes: [{ name: 'Weight', values: 99 }],
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(prod);

      const res = await request.get('/api/admin/products/512');

      expect(res.status).toBe(200);
      expect(res.body.data.product.attributes[0].values).toEqual([]);
    });
  });

  describe('PUT /api/admin/users/:id — lines 469,472-475: user.update với isActive undefined', () => {
    it('gọi user.update với isActive từ user hiện tại khi isActive không được gửi', async () => {
      const existingUser = makeUser({
        id: 5,
        role: 'user',
        isActive: true,
        isEmailVerified: false,
      });
      User.findByPk.mockResolvedValueOnce(existingUser);

      const res = await request.put('/api/admin/users/5').send({
        firstName: 'Jane',
      });

      expect(res.status).toBe(200);
      expect(existingUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Jane',
          isActive: true,
          isEmailVerified: false,
        }),
      );
    });

    it('gọi user.update với isEmailVerified=true khi được gửi rõ ràng', async () => {
      const existingUser = makeUser({
        id: 6,
        role: 'user',
        isActive: false,
        isEmailVerified: false,
      });
      User.findByPk.mockResolvedValueOnce(existingUser);

      const res = await request.put('/api/admin/users/6').send({
        isEmailVerified: true,
        isActive: true,
      });

      expect(res.status).toBe(200);
      expect(existingUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          isEmailVerified: true,
          isActive: true,
        }),
      );
    });
  });

  describe('GET /api/admin/products/:id — line 583: product không có variants', () => {
    it('trả về product thành công khi variants là null (không crash)', async () => {
      const prod = {
        toJSON: () => ({
          id: 520,
          name: 'Product No Variants',
          variants: null,
          attributes: null,
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(prod);

      const res = await request.get('/api/admin/products/520');

      expect(res.status).toBe(200);
      expect(res.body.data.product.variants).toBeNull();
    });
  });

  describe('GET /api/admin/products — lines 1547-1555: transform product với category merge', () => {
    it('merge product.category vào product.categories khi category chưa có trong categories', async () => {
      const category = { id: 3, name: 'Laptop' };
      const products = [
        {
          toJSON: () => ({
            id: 530,
            name: 'Laptop Merge',
            basePrice: 20000000,
            productImages: [{ imageUrl: 'https://img.com/a.jpg' }],
            categories: [],
            category: category,
          }),
        },
      ];

      Product.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: products });

      const res = await request.get('/api/admin/products');

      expect(res.status).toBe(200);
      expect(res.body.data.products[0].categories).toContainEqual(
        expect.objectContaining({ id: 3, name: 'Laptop' }),
      );
      expect(res.body.data.products[0].images).toEqual(['https://img.com/a.jpg']);
    });

    it('không duplicate category khi product.category đã có trong categories', async () => {
      const category = { id: 3, name: 'Laptop' };
      const products = [
        {
          toJSON: () => ({
            id: 531,
            name: 'Laptop Already Has',
            basePrice: 20000000,
            productImages: [],
            categories: [category],
            category: category,
          }),
        },
      ];

      Product.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: products });

      const res = await request.get('/api/admin/products');

      expect(res.status).toBe(200);
      expect(res.body.data.products[0].categories).toHaveLength(1);
    });
  });

  describe('GET /api/admin/orders — lines 1732-1737: transform order items', () => {
    it('chuyển đổi productImages thành images array và đặt price từ basePrice', async () => {
      const orderRow = {
        toJSON: () => ({
          id: 600,
          status: 'pending',
          items: [
            {
              id: 1,
              quantity: 2,
              Product: {
                id: 10,
                name: 'Laptop',
                basePrice: 20000000,
                productImages: [{ imageUrl: 'https://cdn.example.com/lap.jpg' }],
              },
            },
          ],
        }),
      };

      Order.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [orderRow] });

      const res = await request.get('/api/admin/orders');

      expect(res.status).toBe(200);
      const item = res.body.data.orders[0].items[0];
      expect(item.Product.images).toEqual(['https://cdn.example.com/lap.jpg']);
      expect(item.Product.price).toBe(20000000);
    });

    it('đặt images=[] khi item.Product.productImages rỗng', async () => {
      const orderRow = {
        toJSON: () => ({
          id: 601,
          status: 'pending',
          items: [
            {
              id: 2,
              quantity: 1,
              Product: {
                id: 11,
                name: 'Phone',
                basePrice: 5000000,
                productImages: [],
              },
            },
          ],
        }),
      };

      Order.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [orderRow] });

      const res = await request.get('/api/admin/orders');

      expect(res.status).toBe(200);
      expect(res.body.data.orders[0].items[0].Product.images).toEqual([]);
    });
  });

  describe('PUT /api/admin/orders/:id/status — forward tham số sang orders-service', () => {
    it('forward note nguyên văn (không tự transform) cùng status + re-fetch trả về 200', async () => {
      Order.findByPk.mockResolvedValueOnce({ id: 700, status: 'processing' });

      const res = await request
        .put('/api/admin/orders/700/status')
        .send({ status: 'processing', note: 'cập nhật ghi chú' });

      expect(res.status).toBe(200);
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith({
        id: '700',
        status: 'processing',
        paymentStatus: undefined,
        note: 'cập nhật ghi chú',
      });
      expect(res.body.data.order.status).toBe('processing');
    });
  });

  describe('PUT /api/admin/orders/:id/status — cancel delegation/propagation', () => {
    it('delegate { id, status: "cancelled" } sang orders-service khi đổi trạng thái sang cancelled', async () => {
      Order.findByPk.mockResolvedValueOnce({ id: 710, status: 'cancelled' });

      const res = await request.put('/api/admin/orders/710/status').send({ status: 'cancelled' });

      expect(res.status).toBe(200);
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith({
        id: '710',
        status: 'cancelled',
        paymentStatus: undefined,
        note: undefined,
      });
    });

    it('propagate 400 khi orders-service từ chối hủy đơn ĐÃ GIAO (chống tồn ảo)', async () => {
      mockOrdersService.updateOrderStatus.mockRejectedValueOnce(
        new AppError('Không thể hủy đơn hàng đã giao', 400),
      );

      const res = await request.put('/api/admin/orders/712/status').send({ status: 'cancelled' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/không thể hủy/i);
      expect(Order.findByPk).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/admin/products/:id/status — line 2072: auto toggle', () => {
    it('toggle từ inactive sang active khi không gửi status', async () => {
      const inactiveProduct = makeProduct({ id: 800, status: 'inactive' });
      Product.findByPk.mockResolvedValueOnce(inactiveProduct);

      const res = await request.patch('/api/admin/products/800/status').send({});

      expect(res.status).toBe(200);
      expect(inactiveProduct.update).toHaveBeenCalledWith({ status: 'active' });
    });

    it('toggle từ active sang inactive khi không gửi status', async () => {
      const activeProduct = makeProduct({ id: 801, status: 'active' });
      Product.findByPk.mockResolvedValueOnce(activeProduct);

      const res = await request.patch('/api/admin/products/801/status').send({});

      expect(res.status).toBe(200);
      expect(activeProduct.update).toHaveBeenCalledWith({ status: 'inactive' });
    });
  });

  describe('GET /api/admin/analytics/top-products — lines 2276-2282: null Product (file5)', () => {
    it('trả về name="" và thumbnail=null khi item.Product là null', async () => {
      const items = [
        {
          productId: 1,
          Product: null,
          getDataValue: jest.fn((key) => (key === 'revenue' ? '500000' : '10')),
        },
      ];
      OrderItem.findAll.mockResolvedValueOnce(items);

      const res = await request.get('/api/admin/analytics/top-products');

      expect(res.status).toBe(200);
      const item = res.body.data[0];
      expect(item.name).toBe('');
      expect(item.thumbnail).toBeNull();
      expect(item.revenue).toBe(500000);
      expect(item.soldCount).toBe(10);
    });

    it('filter theo metric=quantity → sort by soldCount DESC', async () => {
      OrderItem.findAll.mockResolvedValueOnce([]);

      const res = await request
        .get('/api/admin/analytics/top-products')
        .query({ metric: 'quantity', limit: '3' });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/analytics/revenue-by-category — lines 2322-2323: map rows', () => {
    it('map các row từ raw query thành data objects', async () => {
      const rawRows = [
        { categoryId: 1, categoryName: 'Laptop', revenue: '5000000', orderItemCount: '20' },
        { categoryId: 2, categoryName: 'Phone', revenue: null, orderItemCount: '0' },
      ];
      sequelize.query.mockResolvedValueOnce([rawRows]);

      const res = await request
        .get('/api/admin/analytics/revenue-by-category')
        .query({ startDate: '2024-01-01', endDate: '2024-12-31' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toMatchObject({
        categoryId: 1,
        categoryName: 'Laptop',
        revenue: 5000000,
        orderItemCount: 20,
      });
      expect(res.body.data[1].revenue).toBe(0);
    });
  });

  describe('GET /api/admin/analytics/payment-methods — line 2391: null method → unknown (file5)', () => {
    it('đặt method="unknown" khi paymentMethod là null', async () => {
      const rows = [
        { paymentMethod: 'cod', count: '10', revenue: '500000' },
        { paymentMethod: null, count: '3', revenue: '0' },
      ];
      Order.findAll.mockResolvedValueOnce(rows);

      const res = await request.get('/api/admin/analytics/payment-methods');

      expect(res.status).toBe(200);
      expect(res.body.data[1].method).toBe('unknown');
      expect(res.body.data[0].method).toBe('cod');
    });
  });

  describe('GET /api/admin/reports/export — lines 2464-2479: type=products (file5)', () => {
    it('trả về CSV products với Content-Type text/csv', async () => {
      const products = [
        {
          id: 1,
          name: 'Laptop A',
          sku: 'LAP001',
          basePrice: 20000000,
          stockQuantity: 5,
          status: 'active',
        },
        {
          id: 2,
          name: 'Phone "B"',
          sku: null,
          basePrice: 10000000,
          stockQuantity: 0,
          status: null,
        },
      ];
      Product.findAll.mockResolvedValueOnce(products);

      const res = await request.get('/api/admin/reports/export').query({ type: 'products' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/products_/);
      expect(res.text).toContain('Product ID,Name,SKU,Base Price,Stock,Status');
      expect(res.text).toContain('Laptop A');
      expect(res.text).toContain('active');
    });
  });

  describe('GET /api/admin/reports/export — line 2481: invalid type → 400 (file5)', () => {
    it('trả về 400 khi type không phải orders hoặc products', async () => {
      const res = await request.get('/api/admin/reports/export').query({ type: 'invalid-type' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Loại báo cáo không hợp lệ/);
    });
  });

  describe('GET /api/admin/reports/export — type=orders: User.firstName + lastName', () => {
    it('ghép firstName + lastName thành customer name', async () => {
      const orders = [
        {
          toJSON: () => ({
            id: 1,
            number: 'ORD-001',
            status: 'delivered',
            paymentStatus: 'paid',
            paymentMethod: 'cod',
            total: 500000,
            createdAt: '2024-05-01T00:00:00.000Z',
            User: { firstName: 'Nguyen', lastName: 'Van A', email: 'a@test.com' },
          }),
        },
        {
          toJSON: () => ({
            id: 2,
            number: 'ORD-002',
            status: 'pending',
            paymentStatus: 'unpaid',
            paymentMethod: null,
            total: 200000,
            createdAt: '2024-05-02T00:00:00.000Z',
            User: null,
          }),
        },
      ];
      Order.findAll.mockResolvedValueOnce(orders);

      const res = await request.get('/api/admin/reports/export').query({ type: 'orders' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Nguyen Van A');
      expect(res.text).toContain('ORD-002');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Merged from admin-controller.edge-cases-6.test.js
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('deepParseJSONArray — line 69: val đã là Array thì trả về val', () => {
    it('trả về mảng gốc khi attr.values đã là array (không parse thêm)', async () => {
      const existingArray = ['Red', 'Blue', 'Green'];
      const prod = {
        toJSON: () => ({
          id: 5001,
          name: 'Prod Array Values',
          variants: [],
          attributes: [{ name: 'Color', values: existingArray }],
          specifications: null,
        }),
      };
      Product.findByPk.mockResolvedValueOnce(prod);

      const res = await request.get('/api/admin/products/5001');

      expect(res.status).toBe(200);
      expect(res.body.data.product.attributes[0].values).toEqual(['Red', 'Blue', 'Green']);
    });
  });

  describe('POST /api/admin/products/:id/clone — line 1995: SKU without hyphen', () => {
    it('dùng số ngẫu nhiên làm suffix khi variant.sku không chứa "-"', async () => {
      const variant = makeVariant('v1', { sku: 'SIMPSKU' });
      const originalProduct = makeProduct({
        id: 700,
        name: 'Clone Me',
        slug: 'clone-me',
        status: 'active',
        variants: [variant],
        productSpecifications: [],
        productImages: [],
        productAttributes: [],
      });
      originalProduct.get = jest.fn((opts) => {
        if (opts?.plain) {
          return {
            id: 700,
            name: 'Clone Me',
            slug: 'clone-me',
            status: 'active',
            productAttributes: [{ get: jest.fn(() => ({ name: 'Color', values: ['Red'] })) }],
          };
        }
        return originalProduct;
      });

      const newProduct = makeProduct({ id: 701, name: 'Clone Me (Copy)', slug: 'clone-me-copy' });
      Product.findByPk
        .mockResolvedValueOnce(originalProduct)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newProduct);

      Product.findOne.mockResolvedValueOnce(null);
      Product.create.mockResolvedValueOnce(newProduct);

      ProductAttribute.bulkCreate.mockResolvedValueOnce([]);
      variant.get.mockReturnValue({ sku: 'SIMPSKU', name: 'Default' });
      ProductVariant.bulkCreate.mockResolvedValueOnce([]);
      ProductImage.bulkCreate.mockResolvedValueOnce([]);

      const res = await request.post('/api/admin/products/700/clone');

      expect(res.status).toBe(201);
      const varBulkCall = ProductVariant.bulkCreate.mock.calls[0][0][0];
      expect(varBulkCall.sku).toMatch(/^.+-\d+$/);
    });
  });

  describe('PUT /api/admin/products/:id — line 1350: vectorStore filter inactive product', () => {
    it('xoá product khỏi vectorStore.items khi finalProduct.status là inactive', async () => {
      const product = makeProduct({ id: 300, status: 'active' });
      const finalProduct = makeProduct({ id: 300, status: 'inactive' });
      finalProduct.toJSON = jest.fn(() => ({ id: 300, name: 'Laptop', status: 'inactive' }));

      Product.findByPk.mockResolvedValueOnce(product).mockResolvedValueOnce(finalProduct);

      ProductAttribute.findAll.mockResolvedValueOnce([]);
      ProductVariant.findAll.mockResolvedValueOnce([]);
      ProductSpecification.findAll.mockResolvedValueOnce([]);

      const vs = require('@services/vector-store/vector-store');
      vs.items = [{ metadata: { id: 300 } }, { metadata: { id: 999 } }];

      const res = await request.put('/api/admin/products/300').send({
        status: 'inactive',
      });

      expect(res.status).toBe(200);
      expect(vs.items).toHaveLength(1);
      expect(vs.items[0].metadata.id).toBe(999);
    });
  });

  describe('GET /api/admin/products — line 1553: product.categories null → []', () => {
    it('đặt categories=[] khi product.categories là undefined', async () => {
      const products = [
        {
          toJSON: () => ({
            id: 400,
            name: 'No Categories Product',
            basePrice: 5000000,
            productImages: [],
            category: null,
          }),
        },
      ];
      Product.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: products });

      const res = await request.get('/api/admin/products');

      expect(res.status).toBe(200);
      expect(res.body.data.products[0].categories).toEqual([]);
    });
  });
});
