'use strict';
/**
 * Targeted tests covering remaining uncovered statements in admin.js.
 *
 * Uncovered lines being addressed here (after all other test files run):
 *   69   — deepParseJSONArray: Array.isArray(val) branch → return val directly
 *   1350 — updateProduct: vectorStore filter inactive product
 *   1553 — getProducts: product.categories null → []
 *   1995 — cloneProduct: SKU suffix without '-'
 *   2027 — cloneProduct: warrantyPackages with ProductWarranty.isDefault
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-statements-jwt';

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

jest.mock('@modules/ai/services/vectorstore/vector-store', () => ({
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
  translateBatch: jest.fn().mockResolvedValue(['translated value']),
}));

// ─── Models mock ─────────────────────────────────────────────────────────────

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
        if (typeof cb === 'function') {
          return cb(mockTransaction);
        }
        return mockTransaction;
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

/** Build a product mock with Sequelize-like methods */
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

/** Build an attribute mock with update method */
function makeAttr(name, values) {
  return {
    name,
    values,
    type: 'custom',
    required: false,
    update: jest.fn().mockResolvedValue({ name, values }),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
}

/** Build a spec mock with update + destroy */
function makeSpec(name, value, valueEn = null) {
  return {
    name,
    value,
    valueEn,
    update: jest.fn().mockResolvedValue({ name, value, valueEn }),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
}

/** Build a variant mock */
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

  const vs = require('@modules/ai/services/vectorstore/vector-store');
  vs.items = [];
  vs.upsertProduct.mockResolvedValue(undefined);
  vs.save.mockResolvedValue(undefined);
  vs.loadPromise = Promise.resolve();
  vs.enrichProductData.mockImplementation((x) => x);

  sequelize.query.mockResolvedValue([[], {}]);

  const mockTx = {
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    LOCK: { UPDATE: 'UPDATE' },
  };
  sequelize.transaction.mockImplementation(async (cb) => {
    if (typeof cb === 'function') return cb(mockTx);
    return mockTx;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 69: deepParseJSONArray — Array.isArray(val) branch returns val as-is
// Triggered via getProductById: attr.values is already an array
// ─────────────────────────────────────────────────────────────────────────────

describe('deepParseJSONArray — line 69: val đã là Array thì trả về val', () => {
  it('trả về mảng gốc khi attr.values đã là array (không parse thêm)', async () => {
    const existingArray = ['Red', 'Blue', 'Green'];
    const prod = {
      toJSON: () => ({
        id: 5001,
        name: 'Prod Array Values',
        variants: [],
        // attr.values là array → line 69 hit: Array.isArray(val) → return val
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

// ─────────────────────────────────────────────────────────────────────────────
// Line 1995: cloneProduct — SKU suffix without '-' → random number
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/:id/clone — line 1995: SKU without hyphen', () => {
  it('dùng số ngẫu nhiên làm suffix khi variant.sku không chứa "-"', async () => {
    const variant = makeVariant('v1', { sku: 'SIMPSKU' }); // no '-' in SKU
    const originalProduct = makeProduct({
      id: 700,
      name: 'Clone Me',
      slug: 'clone-me',
      status: 'active',
      variants: [variant],
      productSpecifications: [],
      warrantyPackages: [],
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
      .mockResolvedValueOnce(originalProduct) // find original
      .mockResolvedValueOnce(null) // findOne for name uniqueness
      .mockResolvedValueOnce(newProduct); // find cloned product for response

    Product.findOne.mockResolvedValueOnce(null); // name not taken
    Product.create.mockResolvedValueOnce(newProduct);

    ProductAttribute.bulkCreate.mockResolvedValueOnce([]);
    // variant.get returns plain data with sku without '-'
    variant.get.mockReturnValue({ sku: 'SIMPSKU', name: 'Default' });
    ProductVariant.bulkCreate.mockResolvedValueOnce([]);
    ProductImage.bulkCreate.mockResolvedValueOnce([]);

    const res = await request.post('/api/admin/products/700/clone');

    expect(res.status).toBe(201);
    // SIMPSKU has no '-' → suffix = random number → sku = `${newSku}-${suffix}`
    const varBulkCall = ProductVariant.bulkCreate.mock.calls[0][0][0];
    // The SKU should follow the pattern: newSku-<number>
    expect(varBulkCall.sku).toMatch(/^.+-\d+$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 2027: cloneProduct — warrantyPackages with ProductWarranty?.isDefault
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/:id/clone — line 2027: warrantyPackages clone', () => {
  it('clone warrantyPackages với ProductWarranty.isDefault', async () => {
    const originalProduct = makeProduct({
      id: 710,
      name: 'With Warranty',
      slug: 'with-warranty',
      status: 'active',
      variants: [],
      productSpecifications: [],
      productAttributes: [],
      productImages: [],
      warrantyPackages: [
        { id: 'wp1', ProductWarranty: { isDefault: true } },
        { id: 'wp2', ProductWarranty: null }, // null ProductWarranty → false
      ],
    });

    const newProduct = makeProduct({ id: 711, name: 'With Warranty (Copy)' });

    Product.findByPk.mockResolvedValueOnce(originalProduct).mockResolvedValueOnce(newProduct);

    Product.findOne.mockResolvedValueOnce(null);
    Product.create.mockResolvedValueOnce(newProduct);

    ProductAttribute.bulkCreate.mockResolvedValueOnce([]);
    ProductWarranty.bulkCreate.mockResolvedValueOnce([]);
    ProductImage.bulkCreate.mockResolvedValueOnce([]);

    const res = await request.post('/api/admin/products/710/clone');

    expect(res.status).toBe(201);
    expect(ProductWarranty.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ warrantyPackageId: 'wp1', isDefault: true }),
        expect.objectContaining({ warrantyPackageId: 'wp2', isDefault: false }),
      ]),
      expect.anything(),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 1350: updateProduct vectorStore — inactive product removed from items
// (else if (finalProduct) branch when finalProduct.status !== 'active')
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/products/:id — line 1350: vectorStore filter inactive product', () => {
  it('xoá product khỏi vectorStore.items khi finalProduct.status là inactive', async () => {
    const product = makeProduct({ id: 300, status: 'active' });
    // The finalProduct returned after commit has status='inactive'
    const finalProduct = makeProduct({ id: 300, status: 'inactive' });
    finalProduct.toJSON = jest.fn(() => ({ id: 300, name: 'Laptop', status: 'inactive' }));

    Product.findByPk
      .mockResolvedValueOnce(product) // in transaction
      .mockResolvedValueOnce(finalProduct); // after commit for response

    ProductAttribute.findAll.mockResolvedValueOnce([]);
    ProductVariant.findAll.mockResolvedValueOnce([]);
    ProductSpecification.findAll.mockResolvedValueOnce([]);

    // vectorStore has an item for product 300
    const vs = require('@modules/ai/services/vectorstore/vector-store');
    vs.items = [{ metadata: { id: 300 } }, { metadata: { id: 999 } }];

    const res = await request.put('/api/admin/products/300').send({
      status: 'inactive',
    });

    expect(res.status).toBe(200);
    // Line 1350: vectorStoreService.items = items.filter(...) → id 300 removed
    expect(vs.items).toHaveLength(1);
    expect(vs.items[0].metadata.id).toBe(999);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 1553: getProducts — product.categories is null/undefined → set to []
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/products — line 1553: product.categories null → []', () => {
  it('đặt categories=[] khi product.categories là undefined', async () => {
    const products = [
      {
        toJSON: () => ({
          id: 400,
          name: 'No Categories Product',
          basePrice: 5000000,
          productImages: [],
          // categories NOT set → undefined → line 1553: if (!categories) categories = []
          category: null,
        }),
      },
    ];
    Product.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: products });

    const res = await request.get('/api/admin/products');

    expect(res.status).toBe(200);
    // categories was undefined → transformed to []
    expect(res.body.data.products[0].categories).toEqual([]);
  });
});
