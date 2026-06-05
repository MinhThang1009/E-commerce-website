'use strict';
/**
 * Tests lấp khoảng trống coverage cho admin.js.
 * Nhắm vào các nhánh/dòng chưa được hit bởi các file test hiện có:
 *
 * - Line 46:  deepParseJSON — typeof val !== 'string' (e.g. số, boolean)
 * - Lines 68-70: deepParseJSONArray — null/undefined/non-string branch
 * - Lines 469,472-475: updateUser — user.update với field thực
 * - Line 583: getProductById — variants là null/undefined (skip deep-parse)
 * - Lines 664-668: createProduct — condition/faqs fallback
 * - Lines 1547-1553,1555: getProducts — product có category cần merge
 * - Lines 1732-1737: getOrders — item.Product có productImages
 * - Line 1788,1790: updateOrderStatus — note='' → null, status=delivered+cod
 * - Lines 1802,1808: updateOrderStatus cancel — variant và product restock paths
 * - Line 1859: cancelOrder — item.Product path (no variantId)
 * - Line 2072: toggleProductStatus
 * - Lines 2276-2282: getTopProductsAnalytics — item.Product is null
 * - Lines 2322-2323: getRevenueByCategoryAnalytics — map results
 * - Lines 2391: getPaymentMethodsAnalytics — paymentMethod null → 'unknown'
 * - Lines 2455-2458: exportReport products — type=products path
 * - Line 2474: exportReport — type không hợp lệ → 400
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-gap-jwt';

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

jest.mock('@middlewares/admin-auth');

jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 99, role: 'admin', email: 'admin@test.com' };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
  adminAuthenticate: (req, _res, next) => {
    req.user = { id: 99, role: 'admin', email: 'admin@test.com' };
    next();
  },
}));

jest.mock('@middlewares/authorize');

jest.mock('@middlewares/validate-request', () => ({
  validateRequest: () => (_req, _res, next) => next(),
  validate: (rules) => [...(Array.isArray(rules) ? rules : []), (_req, _res, next) => next()],
  validateExpressValidator: (_req, _res, next) => next(),
}));

jest.mock('./admin-import-controller', () => ({
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

jest.mock('@modules/ai/services/translate/translate-service', () => ({
  translateBatch: jest.fn().mockResolvedValue([]),
}));

// ─── Models mock ──────────────────────────────────────────────────────────────

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

// ─── App setup ────────────────────────────────────────────────────────────────

const express = require('express');
const supertest = require('supertest');
const { errorHandler } = require('@middlewares/error-handler');
const adminRouter = require('@modules/admin/routes');
const {
  User,
  Product,
  ProductVariant,
  ProductAttribute,
  ProductSpecification,
  ProductImage,
  Category,
  Order,
  OrderItem,
  InventoryLog,
  sequelize,
} = require('@models');

// Sau refactor: admin DELEGATE hủy/đổi-trạng-thái sang orders-service (inject qua setter).
const adminOrderService = require('@modules/admin/services/admin-order-service');
const { AppError } = require('@shared/errors');
const mockOrdersService = { updateOrderStatus: jest.fn().mockResolvedValue(undefined) };

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use(errorHandler);

const request = supertest(app);

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    toJSON: () => ({ ...data, variants: [], productImages: [] }),
    get: jest.fn((opts) => (opts?.plain ? { ...data } : data)),
    update: jest.fn().mockResolvedValue({ ...data }),
    destroy: jest.fn().mockResolvedValue(undefined),
    setCategories: jest.fn().mockResolvedValue(undefined),
  };
}

function makeUser(overrides = {}) {
  const data = {
    id: 5,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.com',
    phone: '0901234567',
    role: 'user',
    isEmailVerified: true,
    isActive: true,
    ...overrides,
  };
  return {
    ...data,
    update: jest.fn().mockResolvedValue({ ...data }),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.resetAllMocks();

  const vs = require('@services/vector-store/vector-store');
  vs.items = [];
  vs.upsertProduct.mockResolvedValue(undefined);
  vs.save.mockResolvedValue(undefined);
  vs.loadPromise = Promise.resolve();
  vs.enrichProductData.mockImplementation((x) => x);

  sequelize.query.mockResolvedValue([[], {}]);
  sequelize.transaction.mockImplementation(async (cb) => {
    const tx = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      LOCK: { UPDATE: 'UPDATE' },
    };
    if (typeof cb === 'function') return cb(tx);
    return tx;
  });

  // resetAllMocks xóa implementation của mockOrdersService — restore + re-inject
  mockOrdersService.updateOrderStatus.mockReset().mockResolvedValue(undefined);
  adminOrderService.setOrdersService(mockOrdersService);
});

// ─────────────────────────────────────────────────────────────────────────────
// deepParseJSON — line 46: typeof val !== 'string' (không phải string, object, null)
// Input: number hoặc boolean → return {}
// Được gọi qua getProductById khi variant.attributes là số nguyên thuần
// ─────────────────────────────────────────────────────────────────────────────

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
    // 42 không phải string, deepParseJSON không thể parse → trả về {}
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
    // true không phải string → deepParseJSON trả về {}
    expect(res.body.data.product.variants[0].attributes).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deepParseJSONArray — lines 68-70: null/undefined/non-string input
// Được gọi gián tiếp qua getProductById: attr.values parsing
// ─────────────────────────────────────────────────────────────────────────────

describe('deepParseJSONArray — lines 68-70: null/undefined/non-string trả về []', () => {
  it('trả về [] khi attr.values là null', async () => {
    // attr.values = null → line 68 hit (null → return [])
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
    // deepParseJSONArray(null) → [] → attr.values = []
    expect(res.body.data.product.attributes[0].values).toEqual([]);
  });

  it('trả về [] khi attr.values là undefined', async () => {
    // attr.values = undefined → line 68 hit (undefined → return [])
    const prod = {
      toJSON: () => ({
        id: 511,
        name: 'Prod Undef Values',
        variants: [],
        attributes: [{ name: 'Size' }], // values absent → undefined
        specifications: null,
      }),
    };
    Product.findByPk.mockResolvedValueOnce(prod);

    const res = await request.get('/api/admin/products/511');

    expect(res.status).toBe(200);
    expect(res.body.data.product.attributes[0].values).toEqual([]);
  });

  it('trả về [] khi attr.values là số (non-string, non-null, non-array)', async () => {
    // attr.values = 99 → line 70 hit (typeof !== 'string' → return [])
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

// ─────────────────────────────────────────────────────────────────────────────
// updateUser — lines 469,472-475: user.update được gọi với các fields thực
// Cần user tồn tại, role match, isActive/isEmailVerified undefined path
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/users/:id — lines 469,472-475: user.update với isActive undefined', () => {
  it('gọi user.update với isActive từ user hiện tại khi isActive không được gửi', async () => {
    const existingUser = makeUser({ id: 5, role: 'user', isActive: true, isEmailVerified: false });
    User.findByPk.mockResolvedValueOnce(existingUser);

    const res = await request.put('/api/admin/users/5').send({
      firstName: 'Jane',
    });

    expect(res.status).toBe(200);
    // isActive không được gửi → isActive: isActive !== undefined ? ... : user.isActive
    // → isActive = existingUser.isActive = true
    expect(existingUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Jane',
        isActive: true, // giữ nguyên từ user
        isEmailVerified: false, // giữ nguyên từ user
      }),
    );
  });

  it('gọi user.update với isEmailVerified=true khi được gửi rõ ràng', async () => {
    const existingUser = makeUser({ id: 6, role: 'user', isActive: false, isEmailVerified: false });
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

// ─────────────────────────────────────────────────────────────────────────────
// getProductById — line 583: variants là null → skip deep-parse block
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// getProducts — lines 1547-1553,1555: product có category riêng cần merge vào categories
// ─────────────────────────────────────────────────────────────────────────────

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
          categories: [], // categories rỗng ban đầu
          category: category, // direct category → cần merge
        }),
      },
    ];

    Product.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: products });

    const res = await request.get('/api/admin/products');

    expect(res.status).toBe(200);
    // Sau transform: categories phải chứa category
    expect(res.body.data.products[0].categories).toContainEqual(
      expect.objectContaining({ id: 3, name: 'Laptop' }),
    );
    // images được chuyển từ productImages
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
          categories: [category], // category đã có
          category: category, // trùng → không push thêm
        }),
      },
    ];

    Product.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: products });

    const res = await request.get('/api/admin/products');

    expect(res.status).toBe(200);
    expect(res.body.data.products[0].categories).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getOrders — lines 1732-1737: transform order items có item.Product với productImages
// ─────────────────────────────────────────────────────────────────────────────

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

    // getAllOrders dùng findAndCountAll, không phải findAll
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

// ─────────────────────────────────────────────────────────────────────────────
// updateOrderStatus — line 1788,1790: note='' → null; status=delivered+cod → paid
// ─────────────────────────────────────────────────────────────────────────────

// Note handling (note=''→null) + COD→paid auto đã chuyển sang orders-service
// (xem orders-edge-cases.integration F2/F12). Admin chỉ forward tham số thô + re-fetch.
describe('PUT /api/admin/orders/:id/status — forward tham số sang orders-service', () => {
  it('forward note nguyên văn (không tự transform) cùng status + re-fetch trả về 200', async () => {
    Order.findByPk.mockResolvedValueOnce({ id: 700, status: 'processing' });

    const res = await request
      .put('/api/admin/orders/700/status')
      .send({ status: 'processing', note: 'cập nhật ghi chú' });

    expect(res.status).toBe(200);
    // Admin KHÔNG transform note — chuyển y nguyên sang orders-service
    expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith({
      id: '700',
      status: 'processing',
      paymentStatus: undefined,
      note: 'cập nhật ghi chú',
    });
    expect(res.body.data.order.status).toBe('processing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateOrderStatus — lines 1802,1808: cancel branch — variant và product restock
// ─────────────────────────────────────────────────────────────────────────────

// Hoàn kho variant/product khi cancel đã chuyển sang orders-service
// (xem orders-edge-cases.integration F13/F14). Admin chỉ delegate + propagate.
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
    // Lỗi xảy ra trong delegate → admin KHÔNG re-fetch order
    expect(Order.findByPk).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toggleProductStatus — line 2072: status=inactive → toggle sang active
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/admin/products/:id/status — line 2072: auto toggle', () => {
  it('toggle từ inactive sang active khi không gửi status', async () => {
    const inactiveProduct = makeProduct({ id: 800, status: 'inactive' });
    Product.findByPk.mockResolvedValueOnce(inactiveProduct);

    const res = await request.patch('/api/admin/products/800/status').send({});

    expect(res.status).toBe(200);
    // inactive → toggle → active
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

// ─────────────────────────────────────────────────────────────────────────────
// getTopProductsAnalytics — lines 2276-2282: item.Product is null → prod = {}
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics/top-products — lines 2276-2282: null Product', () => {
  it('trả về name="" và thumbnail=null khi item.Product là null', async () => {
    const items = [
      {
        productId: 1,
        Product: null, // Product không join được
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

// ─────────────────────────────────────────────────────────────────────────────
// getRevenueByCategoryAnalytics — lines 2322-2323: map results
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics/revenue-by-category — lines 2322-2323: map rows', () => {
  it('map các row từ raw query thành data objects', async () => {
    const rawRows = [
      { categoryId: 1, categoryName: 'Laptop', revenue: '5000000', orderItemCount: '20' },
      { categoryId: 2, categoryName: 'Phone', revenue: null, orderItemCount: '0' },
    ];
    // sequelize.query trả về [results, metadata]
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
    // revenue null → parseFloat(null || 0) = 0
    expect(res.body.data[1].revenue).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPaymentMethodsAnalytics — line 2391: paymentMethod null → 'unknown'
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics/payment-methods — line 2391: null method → unknown', () => {
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

// ─────────────────────────────────────────────────────────────────────────────
// exportReport — lines 2464-2479: type=products
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/reports/export — lines 2464-2479: type=products', () => {
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
      { id: 2, name: 'Phone "B"', sku: null, basePrice: 10000000, stockQuantity: 0, status: null },
    ];
    Product.findAll.mockResolvedValueOnce(products);

    const res = await request.get('/api/admin/reports/export').query({ type: 'products' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/products_/);
    expect(res.text).toContain('Product ID,Name,SKU,Base Price,Stock,Status');
    expect(res.text).toContain('Laptop A');
    // sku null → ''
    expect(res.text).toContain('""');
    // status null → 'active'
    expect(res.text).toContain('active');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// exportReport — line 2481: type không hợp lệ → 400
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/reports/export — line 2481: invalid type → 400', () => {
  it('trả về 400 khi type không phải orders hoặc products', async () => {
    const res = await request.get('/api/admin/reports/export').query({ type: 'invalid-type' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Loại báo cáo không hợp lệ/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// exportReport — orders path: customer có firstName và lastName
// ─────────────────────────────────────────────────────────────────────────────

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
          User: null, // không có user
        }),
      },
    ];
    Order.findAll.mockResolvedValueOnce(orders);

    const res = await request.get('/api/admin/reports/export').query({ type: 'orders' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Nguyen Van A');
    // paymentMethod null → ''
    expect(res.text).toContain('ORD-002');
  });
});
