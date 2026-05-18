/**
 * Tests cho admin analytics endpoints — Phase 32
 *
 * Bao gồm:
 *   GET /api/admin/dashboard              → getDashboardStats
 *   GET /api/admin/stats                  → getDetailedStats
 *   GET /api/admin/analytics/user-growth  → getUserGrowthAnalytics
 *   GET /api/admin/analytics/top-products → getTopProductsAnalytics
 *   GET /api/admin/analytics/low-stock    → getLowStockAnalytics
 *   GET /api/admin/analytics/order-status → getOrderStatusAnalytics
 *   GET /api/admin/analytics/payment-methods → getPaymentMethodsAnalytics
 *
 * Chiến lược mock:
 *   - Tất cả Sequelize models mock hoàn toàn (không kết nối DB)
 *   - adminAuthenticate bypass để test controller logic, không auth logic
 *   - auditMiddleware bypass để tránh side-effect
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-analytics';

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
  generateVariantSku: jest.fn().mockReturnValue('SKU-TEST'),
}));

jest.mock('@modules/ai/services/vectorstore/vector-store', () => ({
  upsertProduct: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@middlewares/rate-limiter', () => ({
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  chatbotLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
  adminAuthenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
}));

jest.mock('@middlewares/admin-auth', () => ({
  adminAuthenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
  requireSuperAdmin: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('@middlewares/validate-request', () => ({
  validateRequest: () => (_req, _res, next) => next(),
  // validate dùng express-validator array — trả về array middleware để router dùng
  validate: (rules) => [...rules, (_req, _res, next) => next()],
  validateExpressValidator: (_req, _res, next) => next(),
}));

jest.mock('@shared/admin-audit', () => ({
  AdminAuditService: class {
    static logUserAction() {}
    static logProductAction() {}
    static logOrderAction() {}
    log() {}
  },
  auditMiddleware: (_req, _res, next) => next(),
}));

jest.mock('@config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue(null),
}));

// Mock sequelize instance (dùng bởi getRevenueByCategoryAnalytics và adminImportController)
jest.mock('@config/sequelize', () => ({
  define: jest.fn().mockReturnValue(class MockModel {}),
  fn: jest.fn(),
  col: jest.fn(),
  literal: jest.fn(),
  where: jest.fn(),
  query: jest.fn().mockResolvedValue([[], {}]),
  transaction: jest.fn().mockImplementation(async (cb) => {
    if (typeof cb === 'function') return cb({ LOCK: { UPDATE: 'UPDATE' } });
    return { LOCK: { UPDATE: 'UPDATE' }, commit: jest.fn(), rollback: jest.fn() };
  }),
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
// Model mock factory — hàm helper tạo mock Sequelize instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tạo fake Sequelize row với getDataValue()
 * @param {object} attrs — tất cả field value
 */
function makeRow(attrs) {
  return {
    ...attrs,
    getDataValue: (key) => attrs[key],
    toJSON: () => ({ ...attrs }),
    // Hỗ trợ Product nested
    Product: attrs.Product || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Model mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@models', () => ({
  User: {
    findAll: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    sum: jest.fn(),
  },
  Order: {
    findAll: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    sum: jest.fn(),
  },
  OrderItem: {
    findAll: jest.fn(),
    create: jest.fn(),
  },
  Product: {
    findAll: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
  },
  ProductImage: {},
  ProductVariant: {},
  ProductAttribute: {},
  ProductSpecification: {},
  ProductWarranty: {},
  ProductCategory: {},
  Review: { findAll: jest.fn(), count: jest.fn() },
  Category: { findAll: jest.fn() },
  CartItem: {},
  Wishlist: {},
  Address: {},
  LoyaltyHistory: { create: jest.fn() },
  SearchHistory: {},
  RecentlyViewed: {},
  InventoryLog: { create: jest.fn(), findAndCountAll: jest.fn() },
  AuditLog: { findAndCountAll: jest.fn(), create: jest.fn() },
  ChatMessage: { count: jest.fn(), findAll: jest.fn() },
  WarrantyPackage: { findAll: jest.fn() },
  Brand: {},
  sequelize: {
    query: jest.fn().mockResolvedValue([[], {}]),
    transaction: jest.fn().mockImplementation(async (cb) => {
      if (typeof cb === 'function') return cb({ LOCK: { UPDATE: 'UPDATE' } });
      return { LOCK: { UPDATE: 'UPDATE' }, commit: jest.fn(), rollback: jest.fn() };
    }),
  },
  Op: require('sequelize').Op,
  Sequelize: require('sequelize'),
}));

// ─────────────────────────────────────────────────────────────────────────────
// App setup — sau khi tất cả mock đã đăng ký
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const supertest = require('supertest');
const { errorHandler } = require('@middlewares/error-handler');
const adminRouter = require('@modules/admin/routes');

// Import models sau khi mock — để dùng trong test assertions
const { User, Order, OrderItem, Product } = require('@models');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use(errorHandler);

const request = supertest(app);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — reset all mock implementations trước mỗi test
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/dashboard
// ─────────────────────────────────────────────────────────────────────────────

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

  test('threshold mặc định là 10 khi không truyền query param', async () => {
    Product.findAll.mockResolvedValueOnce([]);

    await request.get('/api/admin/analytics/low-stock');

    const callArgs = Product.findAll.mock.calls[0][0];
    // where.stockQuantity là object với Symbol(Op.lte) làm key
    // Dùng Object.getOwnPropertySymbols để đọc giá trị threshold
    const stockCondition = callArgs.where.stockQuantity;
    const symbols = Object.getOwnPropertySymbols(stockCondition);
    expect(symbols.length).toBeGreaterThan(0);
    // Ít nhất một symbol key phải có value là 10
    const values = symbols.map((s) => stockCondition[s]);
    expect(values).toContain(10);
  });

  test('threshold=0 bị fallback về 10 do lỗi `parseInt("0") || 10` — hành vi hiện tại', async () => {
    // BUG NOTE: Controller dùng `parseInt(req.query.threshold, 10) || 10`
    // parseInt("0") = 0, nhưng 0 là falsy nên || 10 kick in → threshold thực tế là 10.
    // Test này document hành vi hiện tại, KHÔNG fix bug. Xem controller dòng 2383.
    Product.findAll.mockResolvedValueOnce([]);

    await request.get('/api/admin/analytics/low-stock?threshold=0');

    const callArgs = Product.findAll.mock.calls[0][0];
    const stockCondition = callArgs.where.stockQuantity;
    const symbols = Object.getOwnPropertySymbols(stockCondition);
    const values = symbols.map((s) => stockCondition[s]);
    // Hành vi thực tế: 0 bị bỏ qua, threshold = 10
    expect(values).toContain(10);
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
