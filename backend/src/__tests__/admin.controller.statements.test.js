'use strict';
/**
 * Targeted tests covering remaining uncovered statements in admin.js.
 *
 * Uncovered lines being addressed here (after all other test files run):
 *   69   — deepParseJSONArray: Array.isArray(val) branch → return val directly
 *   664-668 — createProduct: seoKeywords/condition/specifications/faqs defaults
 *   743-756 — createProduct attr: Array.isArray(attr.value) + truthy non-array/non-string
 *   820-821 — createProduct variant: price/stockQuantity fields in ProductVariant.create
 *   859,861 — createProduct images: object form (img.url / img.color)
 *   1039    — updateProduct: price change tracking
 *   1044-1048,1051-1056,1066 — updateProduct: hasOwnProperty branches + image array
 *   1091,1100 — updateProduct: compareAtPrice priceToCompare === '' → null
 *   1145-1149,1155-1156 — updateProduct attr: Array.isArray(attr.values) branch + create new attr
 *   1203-1204,1209 — updateProduct variant: price/stockQuantity fields + displayName fallback
 *   1223    — updateProduct variant: id starts with 'var-' → undefined id
 *   1242    — updateProduct: stockQuantity-only update when no variants key
 *   1294    — updateProduct: specs translation s.update call
 *   1362    — updateProduct: transaction.rollback on error
 *   1547-1553 — getProducts: transform productImages → images, basePrice → price
 *   1732-1737 — getOrders: item.Product transform
 *   1788    — updateOrderStatus: note='' → null
 *   1802,1808 — updateOrderStatus cancel: variant + product restock
 *   1859    — adminCancelOrder: item.Product path
 *   1995    — cloneProduct: SKU suffix without '-'
 *   2027    — cloneProduct: warrantyPackages with ProductWarranty.isDefault
 *   2117    — restockProduct: variant path with ProductVariant.sum
 *   2165-2166 — getAuditLogs: startDate/endDate filter
 *   2239    — getTopProductsAnalytics: limitNum calculation
 *   2281-2282 — getTopProductsAnalytics: null Product → empty prod
 *   2323    — getRevenueByCategoryAnalytics: result mapping
 *   2391    — getPaymentMethodsAnalytics: null paymentMethod → 'unknown'
 *   2463    — exportReport orders: User?.email fallback
 *   2482    — exportReport products: status null → 'active'
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-statements-jwt';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../utils/productHelpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(10),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-GEN'),
}));

jest.mock('../services/ai/vectorStore', () => ({
  addProduct: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  loadPromise: Promise.resolve(),
  items: [],
  enrichProductData: jest.fn((x) => x),
}));

jest.mock('../middlewares/rateLimiter', () => ({
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  chatbotLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/adminAuth', () => ({
  adminAuthenticate: (req, _res, next) => {
    req.user = { id: 99, role: 'admin', email: 'admin@test.com' };
    next();
  },
  requireSuperAdmin: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authenticate', () => ({
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

jest.mock('../middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('../middlewares/validateRequest', () => ({
  validateRequest: () => (_req, _res, next) => next(),
  validate: (rules) => [...(Array.isArray(rules) ? rules : []), (_req, _res, next) => next()],
  validateExpressValidator: (_req, _res, next) => next(),
}));

jest.mock('../services/adminAudit', () => ({
  AdminAuditService: class {
    static logUserAction() {}
    static logProductAction() {}
    static logOrderAction() {}
    static logDiscountCodeAction() {}
    log() {}
  },
  auditMiddleware: (_req, _res, next) => next(),
}));

jest.mock('../controllers/adminImport', () => ({
  getImportTemplate: (_req, _res, next) => next(),
  uploadImportFile: (_req, _res, next) => next(),
  importProducts: (_req, _res, next) => next(),
  getImportHistory: (_req, _res, next) => next(),
  exportProducts: (_req, _res, next) => next(),
}));

jest.mock('../controllers/discountCode', () => ({
  getAllDiscountCodes: (_req, _res, next) => next(),
  getDiscountCodeById: (_req, _res, next) => next(),
  createDiscountCode: (_req, _res, next) => next(),
  updateDiscountCode: (_req, _res, next) => next(),
  deleteDiscountCode: (_req, _res, next) => next(),
}));

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue(null),
}));

jest.mock('../services/ai/translateService', () => ({
  translateBatch: jest.fn().mockResolvedValue(['translated value']),
}));

// ─── Models mock ─────────────────────────────────────────────────────────────

jest.mock('../models', () => {
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
const { errorHandler } = require('../middlewares/errorHandler');
const adminRouter = require('../routes/admin');
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
} = require('../models');

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

  const vs = require('../services/ai/vectorStore');
  vs.items = [];
  vs.addProduct.mockResolvedValue(undefined);
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
// Lines 664-668: createProduct — seoKeywords default [], condition, specs, faqs defaults
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products — lines 664-668: seoKeywords/condition/specifications/faqs', () => {
  it('áp dụng default seoKeywords=[] và condition="new" khi không gửi', async () => {
    const createdProduct = makeProduct({ id: 100, status: 'active' });
    Product.create.mockResolvedValueOnce(createdProduct);
    // No comparePrice sent
    Product.update.mockResolvedValueOnce(undefined);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    ProductImage.bulkCreate.mockResolvedValueOnce([]);

    const res = await request.post('/api/admin/products').send({
      name: 'Test Laptop',
      // seoKeywords, condition, specifications, faqs NOT sent → defaults apply
    });

    expect(res.status).toBe(201);
    // Product.create was called with seoKeywords: [] (default)
    const createCall = Product.create.mock.calls[0][0];
    expect(createCall.seoKeywords).toEqual([]);
    expect(createCall.condition).toBe('new');
    expect(createCall.faqs).toEqual([]);
  });

  it('dùng seoKeywords và condition khi được gửi rõ ràng', async () => {
    const createdProduct = makeProduct({ id: 101, status: 'active' });
    Product.create.mockResolvedValueOnce(createdProduct);
    Product.update.mockResolvedValueOnce(undefined);
    ProductAttribute.findAll.mockResolvedValueOnce([]);

    const res = await request.post('/api/admin/products').send({
      name: 'Refurbished Laptop',
      seoKeywords: ['laptop', 'refurbished'],
      condition: 'refurbished',
      faqs: [{ q: 'Warranty?', a: '1 year' }],
    });

    expect(res.status).toBe(201);
    const createCall = Product.create.mock.calls[0][0];
    expect(createCall.seoKeywords).toEqual(['laptop', 'refurbished']);
    expect(createCall.condition).toBe('refurbished');
    expect(createCall.faqs).toEqual([{ q: 'Warranty?', a: '1 year' }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lines 743-756: createProduct attrs — Array.isArray(attr.value) and truthy non-array/non-string
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products — lines 743-756: attr.value as array and numeric', () => {
  it('dùng attr.value trực tiếp khi attr.value là array', async () => {
    const createdProduct = makeProduct({ id: 102 });
    Product.create.mockResolvedValueOnce(createdProduct);
    Product.update.mockResolvedValueOnce(undefined);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    // attributes: attr with value as array → line 742 hit
    const attrMock = { id: 1, productId: 102, name: 'Color', values: ['Red', 'Blue'] };
    ProductAttribute.create.mockResolvedValueOnce(attrMock);

    const res = await request.post('/api/admin/products').send({
      name: 'Test With Array Attr',
      attributes: [{ name: 'Color', value: ['Red', 'Blue'] }],
    });

    expect(res.status).toBe(201);
    expect(ProductAttribute.create).toHaveBeenCalledWith(
      expect.objectContaining({ values: ['Red', 'Blue'] })
    );
  });

  it('converts attr.value to string array khi attr.value là số (non-string, non-array)', async () => {
    const createdProduct = makeProduct({ id: 103 });
    Product.create.mockResolvedValueOnce(createdProduct);
    Product.update.mockResolvedValueOnce(undefined);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    // attr.value = 42 (number) → line 743 hit → attrValues = ['42']
    const attrMock = { id: 2, productId: 103, name: 'Weight', values: ['42'] };
    ProductAttribute.create.mockResolvedValueOnce(attrMock);

    const res = await request.post('/api/admin/products').send({
      name: 'Test With Number Attr',
      attributes: [{ name: 'Weight', value: 42 }],
    });

    expect(res.status).toBe(201);
    expect(ProductAttribute.create).toHaveBeenCalledWith(
      expect.objectContaining({ values: ['42'] })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lines 820-821: createProduct variant — price/stockQuantity in ProductVariant.create
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products — lines 820-821: variant price và stockQuantity', () => {
  it('tạo variant với price và stockQuantity đúng', async () => {
    const createdProduct = makeProduct({ id: 104 });
    Product.create.mockResolvedValueOnce(createdProduct);
    Product.update.mockResolvedValueOnce(undefined);
    ProductAttribute.findAll.mockResolvedValueOnce([]);

    const createdVariant = { id: 'v1', sku: 'SKU-GEN', price: 15000000, stockQuantity: 5 };
    ProductVariant.create.mockResolvedValueOnce(createdVariant);

    const res = await request.post('/api/admin/products').send({
      name: 'Laptop With Variant',
      variants: [
        { name: '16GB RAM', price: '15000000', stock: '5', sku: 'VAR-001' },
      ],
    });

    expect(res.status).toBe(201);
    // price: parseFloat('15000000') = 15000000, stockQuantity: parseInt('5') = 5
    expect(ProductVariant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 15000000,
        stockQuantity: 5,
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lines 859, 861: createProduct images — object form (img.url / img.color)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products — lines 859,861: images as objects', () => {
  it('map image object dùng img.url và img.color', async () => {
    const createdProduct = makeProduct({ id: 105 });
    Product.create.mockResolvedValueOnce(createdProduct);
    Product.update.mockResolvedValueOnce(undefined);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    ProductImage.bulkCreate.mockResolvedValueOnce([]);

    const res = await request.post('/api/admin/products').send({
      name: 'Laptop With Object Images',
      images: [
        { url: 'https://cdn.example.com/img1.jpg', color: 'Silver', isThumbnail: true, variantId: null },
        { imageUrl: 'https://cdn.example.com/img2.jpg', color: null },
      ],
    });

    expect(res.status).toBe(201);
    expect(ProductImage.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          imageUrl: 'https://cdn.example.com/img1.jpg',
          color: 'Silver',
          isThumbnail: true,
        }),
        expect.objectContaining({
          imageUrl: 'https://cdn.example.com/img2.jpg',
          color: null,
        }),
      ])
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lines 1039, 1044-1048, 1051-1056, 1066: updateProduct hasOwnProperty branches
// + images array with string entries
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/products/:id — lines 1039,1044-1056,1066: full payload', () => {
  it('tracks price change and updates all hasOwnProperty fields', async () => {
    const product = makeProduct({ id: 200, name: 'Old Name', basePrice: 10000000 });
    // findByPk called twice: first in transaction, then for final product
    Product.findByPk
      .mockResolvedValueOnce(product)   // in transaction
      .mockResolvedValueOnce(product);  // after commit for response

    Category.findAll.mockResolvedValueOnce([]);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    ProductVariant.findAll.mockResolvedValueOnce([]);
    ProductSpecification.findAll.mockResolvedValueOnce([]);
    ProductImage.destroy.mockResolvedValueOnce(undefined);
    ProductImage.bulkCreate.mockResolvedValueOnce([]);

    const res = await request.put('/api/admin/products/200').send({
      name: 'New Name',
      baseName: 'New Base Name',
      description: 'New desc',
      shortDescription: 'Short',
      price: 12000000,   // req.body.price → updateData.basePrice (line 1047)
      status: 'active',
      featured: true,    // req.body.featured → updateData.isFeatured (line 1051)
      condition: 'new',
      seoTitle: 'SEO Title',
      seoDescription: 'SEO Desc',
      seoKeywords: ['seo'],
      faqs: [],
      images: ['https://img.example.com/a.jpg'],  // string image → images.length > 0 → line 1066
      categoryIds: [],
      attributes: [],
      variants: [],
      specifications: [],
    });

    expect(res.status).toBe(200);
    // product.update should have been called with updateData containing all fields
    expect(product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Name',
        basePrice: 12000000,   // price parsed by parseFloat (line 1047)
        status: 'active',
        // featured: true in body → req.body.hasOwnProperty('featured') = true → line 1051 hit
        // (featured local var is undefined because destructuring uses 'isFeatured: featured')
        condition: 'new',
        seoTitle: 'SEO Title',
      }),
      expect.anything()
    );
    // Images were processed
    expect(ProductImage.bulkCreate).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lines 1091, 1100: updateProduct compareAtPrice with empty string → null
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/products/:id — lines 1091,1100: compareAtPrice="" → null', () => {
  it('đặt compareAtPrice=null khi gửi compareAtPrice="" (empty string)', async () => {
    const product = makeProduct({ id: 201, basePrice: 10000000 });
    Product.findByPk
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce(product);

    ProductAttribute.findAll.mockResolvedValueOnce([]);
    ProductVariant.findAll.mockResolvedValueOnce([]);
    ProductSpecification.findAll.mockResolvedValueOnce([]);

    const res = await request.put('/api/admin/products/201').send({
      compareAtPrice: '',  // '' → priceToCompare === '' → null in query
    });

    expect(res.status).toBe(200);
    // sequelize.query was called to update compare_at_price
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('compare_at_price'),
      expect.objectContaining({
        replacements: expect.objectContaining({ compareAtPrice: null }),
      })
    );
  });

  it('dùng comparePrice khi không có compareAtPrice', async () => {
    const product = makeProduct({ id: 202, basePrice: 10000000 });
    Product.findByPk
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce(product);

    ProductAttribute.findAll.mockResolvedValueOnce([]);
    ProductVariant.findAll.mockResolvedValueOnce([]);
    ProductSpecification.findAll.mockResolvedValueOnce([]);

    const res = await request.put('/api/admin/products/202').send({
      comparePrice: 12000000,
    });

    expect(res.status).toBe(200);
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('compare_at_price'),
      expect.objectContaining({
        replacements: expect.objectContaining({ compareAtPrice: 12000000 }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lines 1145-1149, 1155-1156: updateProduct attr — Array.isArray(attr.values) branch
// + create new attribute (not in currentAttrMap)
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/products/:id — lines 1145-1156: attr.values array + create new attr', () => {
  it('usa attr.values array quando attr.value não existe', async () => {
    const product = makeProduct({ id: 203 });
    Product.findByPk
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce(product);

    // currentAttributes: empty → no existing attr to update, all new
    const existingAttr = makeAttr('Color', ['Red']);
    ProductAttribute.findAll.mockResolvedValueOnce([existingAttr]);
    // New attr 'Size' is not in currentAttrMap → create new (line 1160)
    ProductAttribute.create.mockResolvedValueOnce({ name: 'Size', values: ['M', 'L'] });
    ProductVariant.findAll.mockResolvedValueOnce([]);
    ProductSpecification.findAll.mockResolvedValueOnce([]);

    const res = await request.put('/api/admin/products/203').send({
      attributes: [
        // attr.values (not attr.value) → line 1144 hit
        { name: 'Size', values: ['M', 'L'] },
      ],
    });

    expect(res.status).toBe(200);
    // New attribute created because 'Size' not in currentAttrMap
    expect(ProductAttribute.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Size', values: ['M', 'L'] }),
      expect.anything()
    );
    // 'Color' was destroyed because not in new attrs list
    expect(existingAttr.destroy).toHaveBeenCalled();
  });

  it('usa attr.value numerico → [String(attr.value)] em updateProduct', async () => {
    const product = makeProduct({ id: 204 });
    Product.findByPk
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce(product);

    ProductAttribute.findAll.mockResolvedValueOnce([]);
    // attr with numeric value → line 1145-1146 hit
    ProductAttribute.create.mockResolvedValueOnce({ name: 'Count', values: ['5'] });
    ProductVariant.findAll.mockResolvedValueOnce([]);
    ProductSpecification.findAll.mockResolvedValueOnce([]);

    const res = await request.put('/api/admin/products/204').send({
      attributes: [{ name: 'Count', value: 5 }],
    });

    expect(res.status).toBe(200);
    expect(ProductAttribute.create).toHaveBeenCalledWith(
      expect.objectContaining({ values: ['5'] }),
      expect.anything()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lines 1203-1204, 1209, 1223: updateProduct variant — price/stockQuantity parsing
// + displayName fallback + id starts with 'var-' → undefined id
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/products/:id — lines 1203-1223: variant fields', () => {
  it('chuẩn bị price/stockQuantity từ variant.stock và tạo variant mới với id tạm', async () => {
    const product = makeProduct({ id: 205 });
    Product.findByPk
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce(product);

    // No existing variants
    ProductVariant.findAll.mockResolvedValueOnce([]);
    // New variant created
    const newVariant = { id: 'new-uuid', stockQuantity: 3 };
    ProductVariant.create.mockResolvedValueOnce(newVariant);
    Product.update.mockResolvedValueOnce(undefined);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    ProductSpecification.findAll.mockResolvedValueOnce([]);

    const res = await request.put('/api/admin/products/205').send({
      variants: [
        {
          id: 'var-0',          // starts with 'var-' → id: undefined in create (line 1223)
          name: '8GB RAM',
          price: '20000000',   // price: parseFloat('20000000') (line 1203)
          stock: '3',          // stock used for stockQuantity (line 1204)
          // no displayName → will use variant.name or attribute values (line 1209)
        },
      ],
    });

    expect(res.status).toBe(200);
    expect(ProductVariant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 20000000,
        stockQuantity: 3,
        id: undefined,   // 'var-0' starts with 'var-' → undefined
      }),
      expect.anything()
    );
  });

  it('cập nhật variant hiện tại khi id hợp lệ (không bắt đầu bằng var-)', async () => {
    const product = makeProduct({ id: 206 });
    Product.findByPk
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce(product);

    const existingVariant = makeVariant('real-uuid-123');
    ProductVariant.findAll.mockResolvedValueOnce([existingVariant]);
    Product.update.mockResolvedValueOnce(undefined);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    ProductSpecification.findAll.mockResolvedValueOnce([]);

    const res = await request.put('/api/admin/products/206').send({
      variants: [
        {
          id: 'real-uuid-123',  // valid id → update existing
          name: 'Updated Variant',
          price: '18000000',
          stockQuantity: 10,
        },
      ],
    });

    expect(res.status).toBe(200);
    expect(existingVariant.update).toHaveBeenCalledWith(
      expect.objectContaining({ price: 18000000 }),
      expect.anything()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 1242: updateProduct — stockQuantity-only update (hasOwnProperty('stockQuantity')
// but no 'variants' key in body)
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/products/:id — line 1242: stockQuantity without variants', () => {
  it('cập nhật stockQuantity trực tiếp khi variants không được gửi', async () => {
    const product = makeProduct({ id: 207 });
    Product.findByPk
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce(product);

    Product.update.mockResolvedValueOnce(undefined);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    ProductSpecification.findAll.mockResolvedValueOnce([]);

    // Send stockQuantity without variants property
    const res = await request.put('/api/admin/products/207').send({
      stockQuantity: 99,
      // Note: 'variants' NOT included in body → hasOwnProperty('variants') = false
    });

    expect(res.status).toBe(200);
    // Product.update called to set stockQuantity = 99 (line 1241-1244)
    expect(Product.update).toHaveBeenCalledWith(
      { stockQuantity: 99 },
      expect.objectContaining({ where: { id: '207' } })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 1294: updateProduct — specs translation setImmediate path (spec without valueEn)
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/products/:id — line 1294: specs translation', () => {
  it('gọi translateBatch và cập nhật valueEn cho spec chưa có valueEn', async () => {
    const product = makeProduct({ id: 208 });
    Product.findByPk
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce(product);

    ProductAttribute.findAll.mockResolvedValueOnce([]);
    ProductVariant.findAll.mockResolvedValueOnce([]);
    // Spec without valueEn and with value → needs translation
    ProductSpecification.findAll.mockResolvedValueOnce([]);
    const savedSpec = {
      name: 'CPU',
      value: 'Intel i7',
      valueEn: null,  // no valueEn → needs translation
      update: jest.fn().mockResolvedValue({ name: 'CPU', value: 'Intel i7', valueEn: 'Intel i7' }),
    };
    ProductSpecification.create.mockResolvedValueOnce(savedSpec);

    const { translateBatch } = require('../services/ai/translateService');
    translateBatch.mockResolvedValueOnce(['Intel i7']);

    const res = await request.put('/api/admin/products/208').send({
      specifications: [{ name: 'CPU', value: 'Intel i7' }],  // no valueEn → translation triggered
    });

    expect(res.status).toBe(200);

    // setImmediate schedules async work; wait for it to run
    await new Promise((resolve) => setImmediate(resolve));

    expect(translateBatch).toHaveBeenCalled();
    expect(savedSpec.update).toHaveBeenCalledWith({ valueEn: 'Intel i7' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 1362: updateProduct — transaction.rollback on error
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/products/:id — line 1362: transaction rollback on error', () => {
  it('rollback transaction khi product.update ném lỗi', async () => {
    const product = makeProduct({ id: 209 });
    // findByPk succeeds but update throws
    Product.findByPk.mockResolvedValueOnce(product);
    product.update.mockRejectedValueOnce(new Error('DB error'));

    // Need a real transaction mock that tracks rollback
    const txMock = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      LOCK: { UPDATE: 'UPDATE' },
    };
    sequelize.transaction.mockResolvedValueOnce(txMock);

    const res = await request.put('/api/admin/products/209').send({
      name: 'Updated Name',
    });

    expect(res.status).toBe(500);
    expect(txMock.rollback).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lines 1547-1553: getProducts — transform productImages → images, basePrice → price
// + product.category merge into categories
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/products — lines 1547-1553: transform products', () => {
  it('chuyển đổi productImages thành images array và basePrice thành price', async () => {
    const products = [
      {
        toJSON: () => ({
          id: 300,
          name: 'Laptop',
          basePrice: 20000000,
          productImages: [
            { imageUrl: 'https://cdn.test.com/img.jpg' },
          ],
          categories: [],
          category: null,
        }),
      },
    ];
    Product.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: products });

    const res = await request.get('/api/admin/products');

    expect(res.status).toBe(200);
    const transformed = res.body.data.products[0];
    expect(transformed.images).toEqual(['https://cdn.test.com/img.jpg']);
    expect(transformed.price).toBe(20000000);
  });

  it('không merge category khi product.category là null', async () => {
    const products = [
      {
        toJSON: () => ({
          id: 301,
          name: 'Phone',
          basePrice: 5000000,
          productImages: [],
          categories: [{ id: 1, name: 'Phones' }],
          category: null,
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
// Lines 1732-1737: getOrders — item.Product transform
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/orders — lines 1732-1737: order item Product transform', () => {
  it('chuyển đổi productImages thành images và basePrice thành price trong order items', async () => {
    const orderRow = {
      toJSON: () => ({
        id: 400,
        status: 'pending',
        items: [
          {
            id: 1,
            quantity: 2,
            Product: {
              id: 10,
              name: 'Laptop',
              basePrice: 20000000,
              productImages: [{ imageUrl: 'https://cdn.test.com/lap.jpg' }],
            },
          },
        ],
      }),
    };
    Order.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [orderRow] });

    const res = await request.get('/api/admin/orders');

    expect(res.status).toBe(200);
    const item = res.body.data.orders[0].items[0];
    expect(item.Product.images).toEqual(['https://cdn.test.com/lap.jpg']);
    expect(item.Product.price).toBe(20000000);
  });

  it('item.Product không có productImages → images=[]', async () => {
    const orderRow = {
      toJSON: () => ({
        id: 401,
        status: 'pending',
        items: [
          {
            id: 2,
            quantity: 1,
            Product: {
              id: 11,
              name: 'Keyboard',
              basePrice: 1000000,
              productImages: null,  // null → || [] → []
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
// Line 1788: updateOrderStatus — note='' → null
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/orders/:id/status — line 1788: note="" → null', () => {
  it('đặt note=null khi gửi note="" (empty string)', async () => {
    const order = {
      id: 500,
      status: 'processing',
      paymentStatus: 'unpaid',
      paymentMethod: 'bank',
      items: [],
      update: jest.fn().mockResolvedValue({ id: 500, status: 'shipped' }),
    };
    Order.findByPk.mockResolvedValueOnce(order);

    const res = await request
      .put('/api/admin/orders/500/status')
      .send({ status: 'shipped', note: '' });

    expect(res.status).toBe(200);
    // note: '' → note === '' → null (line 1790)
    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({ note: null })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lines 1802, 1808: updateOrderStatus cancel — variant and product restock
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/orders/:id/status — lines 1802,1808: cancel restock', () => {
  it('hoàn tồn kho variant khi huỷ đơn hàng có variantId', async () => {
    const variantMock = { stockQuantity: 10, update: jest.fn().mockResolvedValue(undefined) };
    const order = {
      id: 510,
      status: 'processing',
      paymentStatus: 'unpaid',
      paymentMethod: 'bank',
      items: [{ variantId: 5, quantity: 3, ProductVariant: variantMock, Product: null }],
      update: jest.fn().mockResolvedValue(undefined),
    };
    Order.findByPk.mockResolvedValueOnce(order);

    const res = await request
      .put('/api/admin/orders/510/status')
      .send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(variantMock.update).toHaveBeenCalledWith(
      { stockQuantity: 13 },  // 10 + 3
      expect.anything()
    );
  });

  it('hoàn tồn kho product khi huỷ đơn hàng không có variantId', async () => {
    const productMock = { stockQuantity: 20, update: jest.fn().mockResolvedValue(undefined) };
    const order = {
      id: 511,
      status: 'processing',
      paymentStatus: 'unpaid',
      paymentMethod: 'bank',
      items: [{ variantId: null, quantity: 2, ProductVariant: null, Product: productMock }],
      update: jest.fn().mockResolvedValue(undefined),
    };
    Order.findByPk.mockResolvedValueOnce(order);

    const res = await request
      .put('/api/admin/orders/511/status')
      .send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(productMock.update).toHaveBeenCalledWith(
      { stockQuantity: 22 },  // 20 + 2
      expect.anything()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 1859: adminCancelOrder — item.Product path (no variantId)
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/orders/:id/cancel — line 1859: product restock without variant', () => {
  it('hoàn tồn kho product khi item không có variantId', async () => {
    const productMock = { stockQuantity: 5, update: jest.fn().mockResolvedValue(undefined) };
    const order = {
      id: 600,
      status: 'processing',
      paymentStatus: 'unpaid',
      paymentMethod: 'bank',
      items: [{ variantId: null, quantity: 2, ProductVariant: null, Product: productMock }],
      update: jest.fn().mockResolvedValue(undefined),
    };
    Order.findByPk.mockResolvedValueOnce(order);

    const res = await request.put('/api/admin/orders/600/cancel');

    expect(res.status).toBe(200);
    expect(productMock.update).toHaveBeenCalledWith(
      { stockQuantity: 7 },  // 5 + 2
      expect.anything()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 1995: cloneProduct — SKU suffix without '-' → random number
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/:id/clone — line 1995: SKU without hyphen', () => {
  it('dùng số ngẫu nhiên làm suffix khi variant.sku không chứa "-"', async () => {
    const variant = makeVariant('v1', { sku: 'SIMPSKU' });  // no '-' in SKU
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
      .mockResolvedValueOnce(originalProduct)  // find original
      .mockResolvedValueOnce(null)              // findOne for name uniqueness
      .mockResolvedValueOnce(newProduct);       // find cloned product for response

    Product.findOne.mockResolvedValueOnce(null);  // name not taken
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
        { id: 'wp2', ProductWarranty: null },  // null ProductWarranty → false
      ],
    });

    const newProduct = makeProduct({ id: 711, name: 'With Warranty (Copy)' });

    Product.findByPk
      .mockResolvedValueOnce(originalProduct)
      .mockResolvedValueOnce(newProduct);

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
      expect.anything()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 2117: restockProduct — variant path: variant.update + ProductVariant.sum + product.update
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/:productId/restock — line 2117: variant restock', () => {
  it('cập nhật tồn kho variant và tổng tồn kho product', async () => {
    const product = makeProduct({ id: 800, stockQuantity: 30 });
    const variant = { id: 5, stockQuantity: 10, update: jest.fn().mockResolvedValue(undefined) };

    Product.findByPk.mockResolvedValueOnce(product);
    ProductVariant.findOne.mockResolvedValueOnce(variant);
    ProductVariant.sum.mockResolvedValueOnce(25);
    InventoryLog.create.mockResolvedValueOnce({ id: 1 });

    const res = await request
      .post('/api/admin/products/800/restock')
      .send({ quantity: 15, variantId: 5, note: 'Restock tháng 5' });

    expect(res.status).toBe(200);
    expect(variant.update).toHaveBeenCalledWith(
      { stockQuantity: 25, isAvailable: true }  // 10 + 15
    );
    // product.update called with total from sum (line 2117)
    expect(product.update).toHaveBeenCalledWith({ stockQuantity: 25 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lines 2165-2166: getAuditLogs — startDate/endDate filter creates Op.gte/Op.lte
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/audit-logs — lines 2165-2166: date filter', () => {
  it('tạo Op.gte và Op.lte khi gửi startDate và endDate', async () => {
    AuditLog.findAndCountAll.mockResolvedValueOnce({ rows: [], count: 0 });

    const res = await request
      .get('/api/admin/audit-logs')
      .query({ startDate: '2024-01-01', endDate: '2024-12-31' });

    expect(res.status).toBe(200);
    const callArg = AuditLog.findAndCountAll.mock.calls[0][0];
    const createdAt = callArg.where.createdAt;
    expect(createdAt).toBeDefined();
    // Op.gte and Op.lte should be set
    const { Op } = require('sequelize');
    expect(createdAt[Op.gte]).toEqual(new Date('2024-01-01'));
    expect(createdAt[Op.lte]).toEqual(new Date('2024-12-31'));
  });

  it('tạo chỉ Op.gte khi chỉ gửi startDate', async () => {
    AuditLog.findAndCountAll.mockResolvedValueOnce({ rows: [], count: 0 });

    const res = await request
      .get('/api/admin/audit-logs')
      .query({ startDate: '2024-06-01' });

    expect(res.status).toBe(200);
    const callArg = AuditLog.findAndCountAll.mock.calls[0][0];
    const { Op } = require('sequelize');
    expect(callArg.where.createdAt[Op.gte]).toBeDefined();
    expect(callArg.where.createdAt[Op.lte]).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 2239: getTopProductsAnalytics — limitNum = Math.min(parseInt(qLimit,10) || 5, 20)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics/top-products — line 2239: limitNum calculation', () => {
  it('giới hạn limit tối đa 20 khi gửi limit=100', async () => {
    OrderItem.findAll.mockResolvedValueOnce([]);

    const res = await request
      .get('/api/admin/analytics/top-products')
      .query({ limit: '100' });

    expect(res.status).toBe(200);
    // limit 100 → Math.min(100, 20) = 20 (capped)
    const findAllCall = OrderItem.findAll.mock.calls[0][0];
    expect(findAllCall.limit).toBe(20);
  });

  it('dùng default limit=5 khi không gửi limit', async () => {
    OrderItem.findAll.mockResolvedValueOnce([]);

    const res = await request.get('/api/admin/analytics/top-products');

    expect(res.status).toBe(200);
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
        Product: null,
        getDataValue: (key) => (key === 'revenue' ? '999999' : '5'),
      },
    ];
    OrderItem.findAll.mockResolvedValueOnce(items);

    const res = await request.get('/api/admin/analytics/top-products');

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      name: '',
      thumbnail: null,
      revenue: 999999,
      soldCount: 5,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 2323: getRevenueByCategoryAnalytics — map results from raw query
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics/revenue-by-category — line 2323: result mapping', () => {
  it('map row.revenue và row.orderItemCount với parseFloat/parseInt', async () => {
    const rows = [
      { categoryId: 5, categoryName: 'Laptop', revenue: '10000000', orderItemCount: '15' },
      { categoryId: 6, categoryName: 'Tablet', revenue: null, orderItemCount: '0' },
    ];
    sequelize.query.mockResolvedValueOnce([rows]);

    const res = await request.get('/api/admin/analytics/revenue-by-category');

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      categoryId: 5,
      categoryName: 'Laptop',
      revenue: 10000000,
      orderItemCount: 15,
    });
    // null revenue → parseFloat(null || 0) = 0
    expect(res.body.data[1].revenue).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 2391: getPaymentMethodsAnalytics — null paymentMethod → 'unknown'
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/analytics/payment-methods — line 2391: null → unknown', () => {
  it('đặt method="unknown" khi paymentMethod là null', async () => {
    const rows = [
      { paymentMethod: 'vnpay', count: '20', revenue: '1000000' },
      { paymentMethod: null, count: '2', revenue: '0' },
    ];
    Order.findAll.mockResolvedValueOnce(rows);

    const res = await request.get('/api/admin/analytics/payment-methods');

    expect(res.status).toBe(200);
    expect(res.body.data[0].method).toBe('vnpay');
    expect(res.body.data[1].method).toBe('unknown');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 2463: exportReport orders — User?.email fallback when User is null
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/reports/export — line 2463: orders User?.email fallback', () => {
  it('dùng email rỗng khi order.User là null', async () => {
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
          User: null,  // null User → email = '' (line 2463-2464)
        }),
      },
    ];
    Order.findAll.mockResolvedValueOnce(orders);

    const res = await request
      .get('/api/admin/reports/export')
      .query({ type: 'orders' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const csvBody = res.text;
    // Customer and email should be empty strings
    expect(csvBody).toContain(',"",""');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 2482: exportReport products — status null → 'active'
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/reports/export — line 2482: product status null → active', () => {
  it('đặt status="active" khi product.status là null', async () => {
    const products = [
      {
        id: 1,
        name: 'Product A',
        sku: 'SKU-001',
        basePrice: 10000000,
        stockQuantity: 5,
        status: null,  // null → || 'active' (line 2482)
      },
    ];
    Product.findAll.mockResolvedValueOnce(products);

    const res = await request
      .get('/api/admin/reports/export')
      .query({ type: 'products' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    // status null → 'active' in CSV
    expect(res.text).toContain(',active');
  });

  it('giữ nguyên status khi product.status được đặt', async () => {
    const products = [
      { id: 2, name: 'Inactive Product', sku: null, basePrice: 5000000, stockQuantity: 0, status: 'inactive' },
    ];
    Product.findAll.mockResolvedValueOnce(products);

    const res = await request
      .get('/api/admin/reports/export')
      .query({ type: 'products' });

    expect(res.status).toBe(200);
    expect(res.text).toContain(',inactive');
    // sku null → '' in CSV
    expect(res.text).toContain(',"",');
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
      .mockResolvedValueOnce(product)      // in transaction
      .mockResolvedValueOnce(finalProduct); // after commit for response

    ProductAttribute.findAll.mockResolvedValueOnce([]);
    ProductVariant.findAll.mockResolvedValueOnce([]);
    ProductSpecification.findAll.mockResolvedValueOnce([]);

    // vectorStore has an item for product 300
    const vs = require('../services/ai/vectorStore');
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
