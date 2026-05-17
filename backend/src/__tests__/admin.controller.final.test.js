/**
 * Tests bổ sung coverage cho admin.js — nhắm vào các dòng còn thiếu
 * sau khi admin.controller.coverage.test.js đã chạy:
 *
 *   Line 61   — deepParseJSON: return {} khi parsed là số/boolean/null/array
 *   Line 83   — deepParseJSONArray: return [] khi parsed không phải array
 *   Line 491  — deleteUser: throw 403 khi req.user.id === id (kiểu string)
 *   Line 723  — createProduct catch categories: product.setCategories throw
 *   Line 868  — createProduct catch images: ProductImage.bulkCreate throw
 *   Line 892  — createProduct catch specs: ProductSpecification.bulkCreate throw
 *   Line 933  — createProduct catch warranty: WarrantyPackage.findAll throw
 *   Line 978  — createProduct catch vectorStore: vectorStoreService.save throw
 *   Line 1077 — updateProduct: image object path (img.url || img.imageUrl)
 *   Line 1296 — updateProduct translate catch
 *   Line 1354 — updateProduct vectorStore catch
 *   Line 1934 — cloneProduct: count++ khi tên đã tồn tại (increment loop)
 *   Lines 1976-1983 — cloneProduct: attributes bulkCreate (productAttributes)
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-final';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../utils/productHelpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(0),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-TEST'),
}));

jest.mock('../services/ai/vectorStore', () => ({
  upsertProduct: jest.fn().mockResolvedValue(undefined),
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

// adminAuth mock — id sebagai STRING agar bisa cocok dengan req.params.id
// Kita override per-test dengan cara menyuntikkan middleware custom ke app
jest.mock('../middlewares/adminAuth', () => ({
  adminAuthenticate: (req, _res, next) => {
    // Default: id sebagai string '1' supaya self-delete test bisa diuji
    req.user = req.__overrideUser || { id: '1', role: 'admin', email: 'admin@test.com' };
    next();
  },
  requireSuperAdmin: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: '1', role: 'admin', email: 'admin@test.com' };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
  adminAuthenticate: (req, _res, next) => {
    req.user = { id: '1', role: 'admin', email: 'admin@test.com' };
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

// translateService mock — bị override per-test
jest.mock('../services/ai/translateService', () => ({
  translateBatch: jest.fn().mockResolvedValue([]),
}));

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
const { errorHandler } = require('../middlewares/errorHandler');
const adminRouter = require('../routes/admin');
const {
  User,
  Product,
  ProductVariant,
  ProductAttribute,
  ProductSpecification,
  ProductWarranty,
  ProductCategory,
  ProductImage,
  Category,
  WarrantyPackage,
  sequelize,
} = require('../models');

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
    warrantyPackages: [],
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

beforeEach(() => {
  jest.resetAllMocks();

  const vs = require('../services/ai/vectorStore');
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
});

// ─────────────────────────────────────────────────────────────────────────────
// deepParseJSON — line 61: return {} khi parsed không phải plain object
// Được exercise qua getProductById: variant.attributes dạng JSON parse thành
// non-object (number, null, array) → deepParseJSON trả về {}
// ─────────────────────────────────────────────────────────────────────────────

describe('deepParseJSON — line 61: return {} khi JSON.parse ra non-object', () => {
  it('trả về {} khi variants.attributes parse thành số', async () => {
    // JSON.parse('42') = 42 (number) → không phải object → return {}
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
    // deepParseJSON('42') → parsed=42 → typeof parsed !== 'object' → return {}
    expect(res.body.data.product.variants[0].attributes).toEqual({});
  });

  it('trả về {} khi variants.attributes parse thành null', async () => {
    // JSON.parse('null') = null → check: parsed !== null fails → return {}
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
    // deepParseJSON('null') → parsed=null → condition `parsed !== null` fails → return {}
    expect(res.body.data.product.variants[0].attributes).toEqual({});
  });

  it('trả về {} khi variants.attributes parse thành array', async () => {
    // JSON.parse('[1,2,3]') = [1,2,3] (array) → Array.isArray → return {}
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
    // deepParseJSON('[1,2,3]') → parsed=[1,2,3] → Array.isArray(parsed) → return {}
    expect(res.body.data.product.variants[0].attributes).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deepParseJSONArray — line 83: return [] khi parsed không phải array
// Được exercise qua getProductById: attr.values dạng JSON parse thành
// non-array (number, boolean, object) → deepParseJSONArray trả về []
// ─────────────────────────────────────────────────────────────────────────────

describe('deepParseJSONArray — line 83: return [] khi JSON.parse ra non-array', () => {
  it('trả về [] khi attr.values parse thành số', async () => {
    // JSON.parse('99') = 99 (number) → !Array.isArray → return []
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
    // JSON.parse('true') = true (boolean) → !Array.isArray → return []
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
    // JSON.parse('{"a":1}') = {a:1} (object) → !Array.isArray → return []
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

// ─────────────────────────────────────────────────────────────────────────────
// deleteUser — line 491: throw 403 khi req.user.id === req.params.id
// req.user.id phải là STRING khớp với params id (URL params luôn là string)
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/admin/users/:id — line 491: tự xóa chính mình', () => {
  it('trả về 403 khi admin cố xóa chính mình (id match dạng string)', async () => {
    // adminAuth mock đặt req.user.id = '1' (string)
    // DELETE /api/admin/users/1 → req.params.id = '1'
    // '1' === '1' → true → throw 403

    const res = await request.delete('/api/admin/users/1');

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/không thể xóa tài khoản của chính mình/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createProduct — line 723: catch khi product.setCategories throw
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products — line 723: categories catch khi setCategories throw', () => {
  it('trả về 201 và gọi logger.error khi setCategories throw (error được bắt, không propagate)', async () => {
    const newProduct = makeProduct({ id: 200 });
    // setCategories throw để kích hoạt catch tại line 722-725
    newProduct.setCategories = jest.fn().mockRejectedValue(new Error('setCategories DB error'));

    Product.create.mockResolvedValueOnce(newProduct);
    Product.findByPk.mockResolvedValueOnce(newProduct);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    // Category tồn tại → validCategoryIds.length > 0 → gọi setCategories
    Category.findByPk.mockResolvedValueOnce({ id: 5, name: 'Laptop' });
    sequelize.query.mockResolvedValue([[], {}]);

    const logger = require('../utils/logger');

    const res = await request.post('/api/admin/products').send({
      name: 'Laptop Categories Error',
      basePrice: 10000000,
      categoryIds: ['5'],
    });

    // Error được catch ở line 722 → không propagate → response 201
    expect(res.status).toBe(201);
    expect(logger.error).toHaveBeenCalledWith(
      'Lỗi khi xử lý categories:',
      expect.any(Error)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createProduct — line 868: catch khi ProductImage.bulkCreate throw
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products — line 868: images catch khi bulkCreate throw', () => {
  it('trả về 201 và gọi logger.error khi ProductImage.bulkCreate throw (error được bắt)', async () => {
    const newProduct = makeProduct({ id: 201 });
    Product.create.mockResolvedValueOnce(newProduct);
    Product.findByPk.mockResolvedValueOnce(newProduct);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    // ProductImage.bulkCreate throw → catch tại line 867-869
    ProductImage.bulkCreate.mockRejectedValueOnce(new Error('S3 upload failed'));
    sequelize.query.mockResolvedValue([[], {}]);

    const logger = require('../utils/logger');

    const res = await request.post('/api/admin/products').send({
      name: 'Laptop Images Error',
      basePrice: 10000000,
      images: ['https://cdn.example.com/img.jpg'],
    });

    // Error được catch ở line 867 → không propagate → response 201
    expect(res.status).toBe(201);
    expect(logger.error).toHaveBeenCalledWith(
      'Lỗi khi tạo ảnh:',
      expect.any(Error)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createProduct — line 892: catch khi ProductSpecification.bulkCreate throw
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products — line 892: specs catch khi bulkCreate throw', () => {
  it('trả về 201 và gọi logger.error khi ProductSpecification.bulkCreate throw', async () => {
    const newProduct = makeProduct({ id: 202 });
    Product.create.mockResolvedValueOnce(newProduct);
    Product.findByPk.mockResolvedValueOnce(newProduct);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    // Specifications.bulkCreate throw → catch tại line 891-894
    ProductSpecification.bulkCreate.mockRejectedValueOnce(new Error('Specs DB error'));
    sequelize.query.mockResolvedValue([[], {}]);

    const logger = require('../utils/logger');

    const res = await request.post('/api/admin/products').send({
      name: 'Laptop Specs Error',
      basePrice: 10000000,
      specifications: [{ name: 'CPU', value: 'Intel i7' }],
    });

    expect(res.status).toBe(201);
    expect(logger.error).toHaveBeenCalledWith(
      'Lỗi khi tạo specifications:',
      expect.any(Error)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createProduct — line 933: catch khi warranty setup throw
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products — line 933: warranty catch khi WarrantyPackage.findAll throw', () => {
  it('trả về 201 và gọi logger.error khi WarrantyPackage.findAll throw', async () => {
    const newProduct = makeProduct({ id: 203 });
    Product.create.mockResolvedValueOnce(newProduct);
    Product.findByPk.mockResolvedValueOnce(newProduct);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    // WarrantyPackage.findAll throw → catch tại line 932-934
    WarrantyPackage.findAll.mockRejectedValueOnce(new Error('Warranty DB error'));
    sequelize.query.mockResolvedValue([[], {}]);

    const logger = require('../utils/logger');

    const res = await request.post('/api/admin/products').send({
      name: 'Laptop Warranty Error',
      basePrice: 10000000,
      warrantyPackageIds: [1, 2],
    });

    expect(res.status).toBe(201);
    expect(logger.error).toHaveBeenCalledWith(
      'Lỗi khi tạo warranty packages:',
      expect.any(Error)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createProduct — line 978: catch khi vectorStoreService.save throw
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products — line 978: vectorStore catch khi save throw', () => {
  it('trả về 201 và gọi logger.error khi vectorStoreService.save throw', async () => {
    const vs = require('../services/ai/vectorStore');
    // Sản phẩm active → vectorStore.upsertProduct + save được gọi
    // save throw → catch tại line 977-979
    vs.save.mockRejectedValueOnce(new Error('VectorStore IO error'));

    const activeProduct = makeProduct({ id: 204, status: 'active' });
    Product.create.mockResolvedValueOnce(activeProduct);
    Product.findByPk.mockResolvedValueOnce(activeProduct);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    sequelize.query.mockResolvedValue([[], {}]);

    const logger = require('../utils/logger');

    const res = await request.post('/api/admin/products').send({
      name: 'Laptop VectorStore Error',
      basePrice: 10000000,
      status: 'active',
    });

    expect(res.status).toBe(201);
    expect(logger.error).toHaveBeenCalledWith(
      'Lỗi đồng bộ vector store sau khi tạo sản phẩm:',
      expect.any(String)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateProduct — line 1077: image object path (img.url || img.imageUrl)
// Khi images có object thay vì string
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/products/:id — line 1077: image object với url field', () => {
  it('sử dụng img.url khi image là object có trường url', async () => {
    const fakeProduct = makeProduct({ id: 210 });
    Product.findByPk
      .mockResolvedValueOnce(fakeProduct)  // lần 1 trong transaction
      .mockResolvedValueOnce(fakeProduct); // lần 2 sau commit (finalProduct)
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
        expect.objectContaining({ imageUrl: 'https://cdn.example.com/photo1.jpg', color: 'red', variantId: 'v1' }),
        expect.objectContaining({ imageUrl: 'https://cdn.example.com/photo2.jpg' }),
      ]),
      expect.anything()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateProduct — line 1296: translate catch khi translateBatch throw
// setImmediate chạy async, cần chờ microtask/macrotask để catch được kích hoạt
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/products/:id — line 1296: translate catch khi translateBatch throw', () => {
  it('gọi logger.warn khi translateBatch throw trong setImmediate', async () => {
    const { translateBatch } = require('../services/ai/translateService');
    translateBatch.mockRejectedValueOnce(new Error('Translation API timeout'));

    const specWithoutEn = {
      id: 1,
      name: 'CPU',
      value: 'Intel i7',
      valueEn: null,
      update: jest.fn().mockResolvedValue({}),
    };

    const fakeProduct = makeProduct({ id: 220 });
    Product.findByPk
      .mockResolvedValueOnce(fakeProduct)
      .mockResolvedValueOnce(fakeProduct);
    sequelize.query.mockResolvedValue([[], {}]);

    // currentSpecs rỗng → spec mới sẽ được create
    ProductSpecification.findAll.mockResolvedValueOnce([]);
    // ProductSpecification.create trả về spec với valueEn=null → trigger setImmediate translate
    ProductSpecification.create.mockResolvedValueOnce(specWithoutEn);

    const logger = require('../utils/logger');

    const res = await request.put('/api/admin/products/220').send({
      specifications: [{ name: 'CPU', value: 'Intel i7' }],
    });

    expect(res.status).toBe(200);

    // Đợi setImmediate chạy xong (macro-task)
    await new Promise((resolve) => setImmediate(resolve));
    // Đợi thêm để Promise rejected được xử lý
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi auto-translate'),
      expect.any(String)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateProduct — line 1354: vectorStore catch khi save throw
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/products/:id — line 1354: vectorStore catch khi save throw', () => {
  it('trả về 200 và gọi logger.error khi vectorStoreService.save throw sau update', async () => {
    const vs = require('../services/ai/vectorStore');
    // Chỉ save throw (không phải upsertProduct)
    vs.save.mockRejectedValueOnce(new Error('VectorStore save failed after update'));

    const activeProduct = makeProduct({ id: 230, status: 'active' });
    Product.findByPk
      .mockResolvedValueOnce(activeProduct)
      .mockResolvedValueOnce(activeProduct);
    sequelize.query.mockResolvedValue([[], {}]);

    const logger = require('../utils/logger');

    const res = await request.put('/api/admin/products/230').send({
      name: 'Updated Laptop',
    });

    expect(res.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      'Lỗi đồng bộ vector store sau khi cập nhật sản phẩm:',
      expect.any(String)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cloneProduct — line 1934: count++ khi tên đã tồn tại (increment loop)
// Cần Product.findOne trả về product trước (tên đã tồn tại), sau đó trả null
// Loop: thử '(1)' → tồn tại → count++ → thử '(2)' → không tồn tại
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/:id/clone — line 1934: count++ khi tên bị duplicate', () => {
  it('increment counter khi tên "Product (1)" đã tồn tại, dùng "Product (2)"', async () => {
    const originalProduct = makeProduct({
      id: 300,
      name: 'Laptop Dupl',
      categories: [],
      productAttributes: [],
      variants: [],
      productSpecifications: [],
      warrantyPackages: [],
    });

    Product.findByPk.mockResolvedValueOnce(originalProduct);

    // findOne lần 1: 'Laptop Dupl (1)' đã tồn tại → count++
    Product.findOne.mockResolvedValueOnce({ id: 999, nameVi: 'Laptop Dupl (1)' });
    // findOne lần 2: 'Laptop Dupl (2)' chưa tồn tại → dùng tên này
    Product.findOne.mockResolvedValueOnce(null);

    const clonedProduct = makeProduct({ id: 301, name: 'Laptop Dupl (2)', status: 'draft' });
    Product.create.mockResolvedValueOnce(clonedProduct);

    const res = await request.post('/api/admin/products/300/clone');

    expect(res.status).toBe(201);
    // Product.create được gọi với tên có counter = 2
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Laptop Dupl (2)' }),
      expect.anything()
    );
    // findOne được gọi 2 lần: kiểm tra (1) rồi (2)
    expect(Product.findOne).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cloneProduct — lines 1976-1983: clone productAttributes (không phải attributes)
// originalProduct.productAttributes tồn tại → ProductAttribute.bulkCreate được gọi
// ─────────────────────────────────────────────────────────────────────────────

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

    // Code dùng originalProduct.attributes (không phải productAttributes)
    // makeProduct không phải Sequelize model thực — cần dùng trực tiếp
    const originalProduct = makeProduct({
      id: 310,
      name: 'Laptop Attrs',
      categories: [],
      attributes: [origAttr],   // đây là field mà code kiểm tra
      productAttributes: [origAttr],
      variants: [],
      productSpecifications: [],
      warrantyPackages: [],
    });

    Product.findByPk.mockResolvedValueOnce(originalProduct);
    Product.findOne.mockResolvedValueOnce(null);

    const clonedProduct = makeProduct({ id: 311, name: 'Laptop Attrs (1)', status: 'draft' });
    Product.create.mockResolvedValueOnce(clonedProduct);
    ProductAttribute.bulkCreate.mockResolvedValueOnce([]);

    const res = await request.post('/api/admin/products/310/clone');

    expect(res.status).toBe(201);
    expect(ProductAttribute.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ productId: 311, name: 'RAM' }),
      ]),
      expect.anything()
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
      warrantyPackages: [],
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

// ─────────────────────────────────────────────────────────────────────────────
// admin.js line 1296: translate SUCCESS path (logger.info sau translateBatch OK)
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/admin/products/:id — line 1296: translate success (logger.info)', () => {
  it('gọi logger.info khi translateBatch thành công', async () => {
    const { translateBatch } = require('../services/ai/translateService');
    translateBatch.mockResolvedValueOnce(['Intel Core i7 12th Gen']);

    const specWithoutEn = {
      id: 99,
      name: 'CPU',
      value: 'Intel Core i7 thế hệ 12',
      valueEn: null,
      update: jest.fn().mockResolvedValue({}),
    };

    const fakeProduct = makeProduct({ id: 330 });
    Product.findByPk
      .mockResolvedValueOnce(fakeProduct)
      .mockResolvedValueOnce(fakeProduct);
    sequelize.query.mockResolvedValue([[], {}]);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    ProductVariant.findAll.mockResolvedValueOnce([]);
    ProductSpecification.findAll.mockResolvedValueOnce([]);
    ProductSpecification.create.mockResolvedValueOnce(specWithoutEn);

    const logger = require('../utils/logger');

    const res = await request.put('/api/admin/products/330').send({
      specifications: [{ name: 'CPU', value: 'Intel Core i7 thế hệ 12' }],
    });

    expect(res.status).toBe(200);

    // Đợi setImmediate và async chain hoàn tất
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setTimeout(r, 50));

    expect(specWithoutEn.update).toHaveBeenCalledWith({ valueEn: 'Intel Core i7 12th Gen' });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Đã dịch 1 specs')
    );
  });
});
