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
 *   Line 2117 — restockProduct: variant path
 *   Line 2165 — getAuditLogs: startDate filter
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

jest.mock('@middlewares/admin-auth', () => ({
  adminAuthenticate: (req, _res, next) => {
    req.user = { id: 99, role: 'admin', email: 'admin@test.com' };
    next();
  },
  requireSuperAdmin: (_req, _res, next) => next(),
}));

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

jest.mock('@middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('@middlewares/validate-request', () => ({
  validateRequest: () => (_req, _res, next) => next(),
  validate: (rules) => [...(Array.isArray(rules) ? rules : []), (_req, _res, next) => next()],
  validateExpressValidator: (_req, _res, next) => next(),
}));

jest.mock('@shared/admin-audit', () => ({
  AdminAuditService: class {
    static logUserAction() {}
    static logProductAction() {}
    static logOrderAction() {}
    static logDiscountCodeAction() {}
    log() {}
  },
  auditMiddleware: (_req, _res, next) => next(),
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

jest.mock('@config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue(null),
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
    ProductWarranty: {
      create: jest.fn(),
      destroy: jest.fn(),
      bulkCreate: jest.fn(),
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
    LoyaltyHistory: { create: jest.fn() },
    SearchHistory: {},
    RecentlyViewed: {},
    InventoryLog: {
      create: jest.fn(),
      findAndCountAll: jest.fn(),
    },
    AuditLog: {
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    ChatMessage: {
      count: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    },
    WarrantyPackage: {
      findAll: jest.fn(),
      findByPk: jest.fn(),
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
  ProductWarranty,
  ProductImage,
  ProductCategory,
  Category,
  WarrantyPackage,
  Order,
  OrderItem,
  AuditLog,
  InventoryLog,
  sequelize,
} = require('@models');

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
    warrantyPackages: [],
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

describe('PUT /api/admin/orders/:id/status — line 1788: note="" → null', () => {
  it('đặt note=null khi note="" được gửi', async () => {
    const order = {
      id: 9400,
      status: 'processing',
      paymentStatus: 'unpaid',
      paymentMethod: 'bank',
      items: [],
      update: jest.fn().mockResolvedValue({ id: 9400, status: 'shipped' }),
    };
    Order.findByPk.mockResolvedValueOnce(order);

    const res = await request
      .put('/api/admin/orders/9400/status')
      .send({ status: 'shipped', note: '' });

    expect(res.status).toBe(200);
    // note='' → note === '' ? null : order.note → null (line 1790 conditional)
    expect(order.update).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 1802, 1808: updateOrderStatus cancel — variant and product restock paths
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/orders/:id/status — lines 1802,1808: cancel restock', () => {
  it('hoàn tồn kho variant khi cancel đơn hàng có variantId (line 1802-1806)', async () => {
    const variantMock = { stockQuantity: 8, update: jest.fn().mockResolvedValue(undefined) };
    const order = {
      id: 9410,
      status: 'processing',
      paymentStatus: 'unpaid',
      paymentMethod: 'cod',
      items: [{ variantId: 3, quantity: 2, ProductVariant: variantMock, Product: null }],
      update: jest.fn().mockResolvedValue(undefined),
    };
    Order.findByPk.mockResolvedValueOnce(order);

    const res = await request.put('/api/admin/orders/9410/status').send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    // variantId truthy + ProductVariant exists → restock variant (line 1802-1806)
    expect(variantMock.update).toHaveBeenCalledWith(
      { stockQuantity: 10 }, // 8 + 2
      expect.anything(),
    );
  });

  it('hoàn tồn kho product khi cancel và item không có variantId (line 1808-1812)', async () => {
    const productMock = { stockQuantity: 15, update: jest.fn().mockResolvedValue(undefined) };
    const order = {
      id: 9411,
      status: 'processing',
      paymentStatus: 'unpaid',
      paymentMethod: 'cod',
      items: [{ variantId: null, quantity: 3, ProductVariant: null, Product: productMock }],
      update: jest.fn().mockResolvedValue(undefined),
    };
    Order.findByPk.mockResolvedValueOnce(order);

    const res = await request.put('/api/admin/orders/9411/status').send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    // no variantId → else if (item.Product) → restock product (line 1808)
    expect(productMock.update).toHaveBeenCalledWith(
      { stockQuantity: 18 }, // 15 + 3
      expect.anything(),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 1859: adminCancelOrder — item.Product path (no variantId)
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/orders/:id/cancel — line 1859: product restock', () => {
  it('hoàn tồn kho product khi item không có variantId trong adminCancelOrder', async () => {
    const productMock = { stockQuantity: 12, update: jest.fn().mockResolvedValue(undefined) };
    const order = {
      id: 9500,
      status: 'processing',
      paymentStatus: 'unpaid',
      paymentMethod: 'bank',
      items: [{ variantId: null, quantity: 4, ProductVariant: null, Product: productMock }],
      update: jest.fn().mockResolvedValue(undefined),
    };
    Order.findByPk.mockResolvedValueOnce(order);

    const res = await request.put('/api/admin/orders/9500/cancel');

    expect(res.status).toBe(200);
    // else if (item.Product) → restock product (line 1859)
    expect(productMock.update).toHaveBeenCalledWith(
      { stockQuantity: 16 }, // 12 + 4
      expect.anything(),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 2117: restockProduct — variant path (variantId present)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/:productId/restock — line 2117: variant restock path', () => {
  it('cập nhật tồn kho variant và tổng tồn kho product qua ProductVariant.sum', async () => {
    const product = makeProduct({ id: 9600, stockQuantity: 20 });
    const variant = { id: 7, stockQuantity: 5, update: jest.fn().mockResolvedValue(undefined) };

    Product.findByPk.mockResolvedValueOnce(product);
    ProductVariant.findOne.mockResolvedValueOnce(variant);
    ProductVariant.sum.mockResolvedValueOnce(30); // total after restock
    InventoryLog.create.mockResolvedValueOnce({ id: 1 });

    const res = await request
      .post('/api/admin/products/9600/restock')
      .send({ quantity: 25, variantId: 7 });

    expect(res.status).toBe(200);
    // variant.update called with newStock = 5 + 25 = 30
    expect(variant.update).toHaveBeenCalledWith({ stockQuantity: 30, isAvailable: true });
    // product.update called with sum result (line 2117): total || 0 = 30
    expect(product.update).toHaveBeenCalledWith({ stockQuantity: 30 });
  });

  it('dùng 0 khi ProductVariant.sum trả về null (line 2117: total || 0)', async () => {
    const product = makeProduct({ id: 9601, stockQuantity: 10 });
    const variant = { id: 8, stockQuantity: 0, update: jest.fn().mockResolvedValue(undefined) };

    Product.findByPk.mockResolvedValueOnce(product);
    ProductVariant.findOne.mockResolvedValueOnce(variant);
    ProductVariant.sum.mockResolvedValueOnce(null); // null → || 0
    InventoryLog.create.mockResolvedValueOnce({ id: 2 });

    // quantity must be > 0 to pass validation (quantity=0 throws 400)
    const res = await request
      .post('/api/admin/products/9601/restock')
      .send({ quantity: 1, variantId: 8 });

    expect(res.status).toBe(200);
    // ProductVariant.sum returns null → null || 0 = 0 (line 2117 right branch)
    expect(product.update).toHaveBeenCalledWith({ stockQuantity: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 2165: getAuditLogs — startDate filter (and endDate separately)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/audit-logs — line 2165: date range filter', () => {
  it('tạo Op.gte khi startDate được gửi', async () => {
    AuditLog.findAndCountAll.mockResolvedValueOnce({ rows: [], count: 0 });

    const res = await request.get('/api/admin/audit-logs').query({ startDate: '2024-03-01' });

    expect(res.status).toBe(200);
    const callArg = AuditLog.findAndCountAll.mock.calls[0][0];
    const { Op } = require('sequelize');
    expect(callArg.where.createdAt[Op.gte]).toBeDefined();
    expect(callArg.where.createdAt[Op.lte]).toBeUndefined();
  });

  it('tạo Op.lte khi endDate được gửi', async () => {
    AuditLog.findAndCountAll.mockResolvedValueOnce({ rows: [], count: 0 });

    const res = await request.get('/api/admin/audit-logs').query({ endDate: '2024-12-31' });

    expect(res.status).toBe(200);
    const callArg = AuditLog.findAndCountAll.mock.calls[0][0];
    const { Op } = require('sequelize');
    expect(callArg.where.createdAt[Op.lte]).toBeDefined();
    expect(callArg.where.createdAt[Op.gte]).toBeUndefined();
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

describe('PUT /api/admin/orders/:id/status — line 1788: status falsy → use order.status', () => {
  it('giữ nguyên status từ order khi status không được gửi', async () => {
    const order = {
      id: 9400,
      status: 'shipped',
      paymentStatus: 'unpaid',
      paymentMethod: 'bank',
      items: [],
      update: jest.fn().mockResolvedValue({ id: 9400 }),
    };
    Order.findByPk.mockResolvedValueOnce(order);

    // Send only paymentStatus, not status → status undefined → right branch of || (line 1788)
    const res = await request.put('/api/admin/orders/9400/status').send({ paymentStatus: 'paid' });

    expect(res.status).toBe(200);
    // status undefined → status || order.status = order.status = 'shipped'
    expect(order.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'shipped' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 1802: updateOrderStatus cancel — order.items is null → || [] empty loop
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/orders/:id/status — line 1802: order.items null → || []', () => {
  it('không crash khi status=cancelled và order.items là null', async () => {
    const order = {
      id: 9410,
      status: 'processing',
      paymentStatus: 'unpaid',
      paymentMethod: 'bank',
      items: null, // null → order.items || [] = [] → empty loop (line 1802 right branch)
      update: jest.fn().mockResolvedValue(undefined),
    };
    Order.findByPk.mockResolvedValueOnce(order);
    Order.findByPk.mockResolvedValueOnce(order); // for the after-cancel fetch

    const res = await request.put('/api/admin/orders/9410/status').send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    // order.items null → || [] → loop over [] → no restock needed
    expect(order.update).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 1808: updateOrderStatus cancel — item with no variantId AND no Product
// → both if/else-if branches false → fall through
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/orders/:id/status — line 1808: item without Product falls through', () => {
  it('không crash khi item không có variantId và không có Product', async () => {
    const order = {
      id: 9420,
      status: 'processing',
      paymentStatus: 'unpaid',
      paymentMethod: 'bank',
      // Item with neither variantId nor Product → both if conditions false
      items: [{ variantId: null, quantity: 1, ProductVariant: null, Product: null }],
      update: jest.fn().mockResolvedValue(undefined),
    };
    Order.findByPk.mockResolvedValueOnce(order);
    Order.findByPk.mockResolvedValueOnce(order);

    const res = await request.put('/api/admin/orders/9420/status').send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    // Neither restock path taken → order still cancelled
    expect(order.update).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 1859: adminCancelOrder — item has no Product (false branch)
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/orders/:id/cancel — line 1859: item without Product falls through', () => {
  it('không crash khi item không có variantId và không có Product trong adminCancelOrder', async () => {
    const order = {
      id: 9500,
      status: 'processing',
      paymentStatus: 'unpaid',
      paymentMethod: 'bank',
      // Neither variantId nor Product
      items: [{ variantId: null, quantity: 1, ProductVariant: null, Product: null }],
      update: jest.fn().mockResolvedValue(undefined),
    };
    Order.findByPk.mockResolvedValueOnce(order);

    const res = await request.put('/api/admin/orders/9500/cancel');

    expect(res.status).toBe(200);
    // else if (item.Product) → false (null) → falls through, no restock
    expect(order.update).toHaveBeenCalled();
  });
});

// ─── restockProduct — vectorStore sync error (lines 2138-2142) ────────────────

describe('POST /api/admin/products/:productId/restock — vectorStore sync error', () => {
  it('trả về 200 và log error khi vectorStoreService.save throw trong sync', async () => {
    const vs = require('@services/vector-store/vector-store');
    vs.save.mockRejectedValueOnce(new Error('VectorStore IO error'));

    const product = makeProduct({ id: 9700, stockQuantity: 10, status: 'active' });
    Product.findByPk
      .mockResolvedValueOnce(product) // findProductById trong sync
      .mockResolvedValueOnce(product); // loadProductForIndex
    ProductVariant.findOne.mockResolvedValueOnce(null);
    InventoryLog.create.mockResolvedValueOnce({ id: 99 });

    const logger = require('@utils/logger');

    const res = await request.post('/api/admin/products/9700/restock').send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      'Lỗi đồng bộ vector store sau khi nhập hàng:',
      expect.any(String),
    );
    vs.save.mockResolvedValue(undefined);
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
