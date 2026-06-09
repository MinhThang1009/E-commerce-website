'use strict';
/**
 * Nhắm vào các nhánh còn chưa được cover sau khi chạy 6 file test hiện có:
 *
 *   Line 367  — getDetailedStats: revenue || 0 fallback
 *   Lines 664-668 — createProduct: seoKeywords/specifications/faqs null → || [] fallback
 *   Lines 743-756 — createProduct attr: non-string non-array value + empty → Default
 *   Lines 820-821 — createProduct variant: price/stock undefined → 0
 *   Line 1044 — updateProduct: hasOwnProperty('baseName') → baseName || name
 *   Lines 1047-1048 — updateProduct: price/stockQuantity null/undefined → parseFloat || 0
 *   Line 1066 — updateProduct: images.length === 0 → skip bulkCreate
 *   Lines 1145-1149 — updateProduct attr: attr.value truthy non-string/non-array + empty values → Default
 *   Lines 1155-1156 — updateProduct attr: attr.required ternary
 *   Lines 1203-1204 — updateProduct variant: price/stock undefined → 0
 *   Line 1209 — updateProduct variant: displayName fallback chain
 *   Line 1223 — updateProduct variant: id with 'var-' → undefined
 *   Line 1242 — updateProduct: stockQuantity update without variants
 *   Line 1294 — updateProduct: spec translation s.update with valueEn
 *   Line 1362 — updateProduct: transaction.rollback on error
 *   Line 1547 — getProducts: productImages null → || []
 *   Lines 1732-1734 — getOrders: item without Product + item with Product null productImages
 *   Line 1788 — updateOrderStatus: note='' → null
 *   Line 1802 — updateOrderStatus cancel: item has variantId
 *   Line 1808 — updateOrderStatus cancel: item has no variantId but has Product
 *   Line 1859 — adminCancelOrder: item.Product path
 *   Line 2228 — getOrderStatusAnalytics: unknown status → raw status as label
 *   Line 2239 — getTopProductsAnalytics: limit > 20 → capped
 *   Lines 2281-2282 — getTopProductsAnalytics: null Product
 *   Line 2323 — getRevenueByCategoryAnalytics: row mapping
 *   Line 2391 — getPaymentMethodsAnalytics: null paymentMethod
 *   Line 2463 — exportReport orders: User is null
 *   Line 2482 — exportReport products: status null → active
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-branches-jwt';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@utils/product-helpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(10),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-GEN'),
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
  translateBatch: jest.fn().mockResolvedValue(['translated en']),
}));

// ─── Models mock ─────────────────────────────────────────────────────────────

jest.mock('@models', () => {
  const mockTx = {
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
        if (typeof cb === 'function') return cb(mockTx);
        return mockTx;
      }),
      QueryTypes: { UPDATE: 'UPDATE', SELECT: 'SELECT' },
    },
    Op: require('sequelize').Op,
    Sequelize: require('sequelize').Sequelize,
  };
});

// ─── App setup ───────────────────────────────────────────────────────────────

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
  ProductCategory,
  Category,
  Order,
  OrderItem,
  InventoryLog,
  Review,
  ChatMessage,
  CartItem,
  Wishlist,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

  // resetAllMocks xóa implementation của mockOrdersService — restore + re-inject
  mockOrdersService.updateOrderStatus.mockReset().mockResolvedValue(undefined);
  adminOrderService.setOrdersService(mockOrdersService);
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 367: getDetailedStats — revenue || 0 fallback when revenue is null
// ─────────────────────────────────────────────────────────────────────────────

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
    expect(res.body.data.product.variants[0].attributes).toEqual({ RAM: '8GB', Storage: '256GB' });
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
    Product.findByPk.mockResolvedValueOnce(inactiveProduct).mockResolvedValueOnce(inactiveProduct);
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
    const existingUser = makeUser({ id: 5, role: 'user', isActive: true, isEmailVerified: false });
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
      { id: 2, name: 'Phone "B"', sku: null, basePrice: 10000000, stockQuantity: 0, status: null },
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
