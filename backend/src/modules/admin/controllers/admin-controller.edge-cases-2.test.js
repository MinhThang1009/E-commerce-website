/**
 * Tests bổ sung coverage cho admin.js — nhắm vào các branch/statement chưa được cover:
 *
 * Uncovered lines (từ jest --coverage):
 *   54,61-83         — deepParseJSON return {} fallback, deepParseJSONArray non-JSON / non-array result
 *   216-217          — getDashboardStats ordersByStatus reduce body
 *   260-265          — topProducts transform với productImages
 *   491              — deleteUser 403 (self-delete — type mismatch check)
 *   594,602          — getProductById with attributes/specifications parsing
 *   674-686          — createProduct with comparePrice
 *   691-723          — createProduct: createCategory auto-create path, categories error catch
 *   730-762          — createProduct: attributes processing (string/array/single value / error throw)
 *   769-840          — createProduct: variants processing path
 *   857,868          — createProduct: images processing (string url / object url)
 *   878-892          — createProduct: specifications bulkCreate
 *   978              — createProduct: vector store inactive product skip
 *   1077             — updateProduct: stockQuantity-only update (no variants)
 *   1096             — updateProduct: compareAtPrice with comparePrice field
 *   1121-1170        — updateProduct: attributes diff update (delete old, update existing, create new)
 *   1175-1235        — updateProduct: variants diff (delete old, update existing, create new)
 *   1241             — updateProduct: stockQuantity update when no variants key
 *   1249-1283        — updateProduct: specifications diff
 *   1331-1332        — updateProduct: vector store inactive product filter
 *   1336             — updateProduct: vector store save
 *   1399-1400        — deleteProduct: rollback on error
 *   1509             — getAllProducts: category filter on includeClause
 *   1558-1559        — getAllProducts: error rethrow
 *   1742-1743        — getAllOrders: error rethrow
 *   1837             — updateOrderStatus: COD delivered → paymentStatus = paid
 *   1916             — adminCancelOrder: 400 order already cancelled
 *   1949-1953        — cloneProduct: categories clone
 *   1958-1965        — cloneProduct: attributes (productAttributes) clone
 *   1970-1983        — cloneProduct: variants clone with SKU suffix
 *   1991-1998        — cloneProduct: productSpecifications clone
 *   2030-2032        — cloneProduct: transaction rollback on error
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-admin-coverage';

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
  generateVariantSku: jest.fn().mockReturnValue('SKU-TEST-VAR'),
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
  Order,
  OrderItem,
  ProductVariant,
  ProductAttribute,
  ProductSpecification,
  ProductCategory,
  ProductImage,
  Category,
  Review,
  InventoryLog,
  CartItem,
  Wishlist,
  sequelize,
} = require('@models');

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
  // Khôi phục items array về rỗng
  const vs = require('@services/vector-store/vector-store');
  vs.items = [];

  // resetAllMocks xóa tất cả implementations — cần restore default cho các mock cần thiết
  sequelize.query.mockResolvedValue([[], {}]);

  // Restore mockTransaction (bị clear bởi resetAllMocks)
  sequelize.transaction.mockImplementation(async (cb) => {
    const tx = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      LOCK: { UPDATE: 'UPDATE' },
    };
    if (typeof cb === 'function') return cb(tx);
    return tx;
  });

  // Restore vectorStore mocks
  const vs2 = require('@services/vector-store/vector-store');
  vs2.upsertProduct.mockResolvedValue(undefined);
  vs2.save.mockResolvedValue(undefined);
  vs2.loadPromise = Promise.resolve();
  vs2.enrichProductData.mockImplementation((x) => x);
});

// ─────────────────────────────────────────────────────────────────────────────
// deepParseJSON / deepParseJSONArray — module-level functions
// Được exercise gián tiếp qua getProductById
// ─────────────────────────────────────────────────────────────────────────────

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

  it('tạo category placeholder khi categoryId là số nguyên và không tồn tại', async () => {
    const newProduct = makeCreatedProduct(21);
    Product.create.mockResolvedValueOnce(newProduct);
    Product.findByPk.mockResolvedValueOnce(newProduct);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    // Category không tồn tại → findByPk trả null → create placeholder
    Category.findByPk.mockResolvedValueOnce(null);
    Category.create.mockResolvedValueOnce({ id: 5, name: 'Category 5' });
    sequelize.query.mockResolvedValue([[], {}]);

    const res = await request.post('/api/admin/products').send({
      name: 'Laptop With Category',
      basePrice: 10000000,
      categoryIds: ['5'],
    });

    expect(res.status).toBe(201);
    expect(Category.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Category 5', slug: 'category-5' }),
    );
    expect(newProduct.setCategories).toHaveBeenCalledWith([5]);
  });

  it('tiếp tục khi categories throw error (error không propagate)', async () => {
    const newProduct = makeCreatedProduct(22);
    Product.create.mockResolvedValueOnce(newProduct);
    Product.findByPk.mockResolvedValueOnce(newProduct);
    ProductAttribute.findAll.mockResolvedValueOnce([]);
    // Category.findByPk throw error → được catch bên trong
    Category.findByPk.mockRejectedValueOnce(new Error('DB error'));
    sequelize.query.mockResolvedValue([[], {}]);

    const res = await request.post('/api/admin/products').send({
      name: 'Laptop Category Error',
      basePrice: 10000000,
      categoryIds: ['9'],
    });

    // Phải thành công vì error được catch
    expect(res.status).toBe(201);
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
// updateOrderStatus — COD delivered và items restoration paths
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/orders/:id/status — COD delivered sets paymentStatus=paid', () => {
  it('tự động set paymentStatus=paid khi status=delivered và paymentMethod=cod', async () => {
    const fakeOrder = makeOrder({
      id: 30,
      status: 'shipped',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      items: [],
    });
    Order.findByPk.mockResolvedValueOnce(fakeOrder);

    const res = await request.put('/api/admin/orders/30/status').send({ status: 'delivered' });

    expect(res.status).toBe(200);
    expect(fakeOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'paid' }),
    );
  });

  it('khôi phục tồn kho Product khi cancel với items không có variantId', async () => {
    const fakeProduct = makeProduct({ id: 5, stockQuantity: 10 });
    const fakeOrder = makeOrder({
      id: 31,
      status: 'processing',
      paymentMethod: 'vnpay',
      items: [
        {
          quantity: 3,
          variantId: null,
          Product: fakeProduct,
          ProductVariant: null,
        },
      ],
    });
    Order.findByPk
      .mockResolvedValueOnce(fakeOrder)
      .mockResolvedValueOnce(makeOrder({ id: 31, status: 'cancelled' }));

    const res = await request.put('/api/admin/orders/31/status').send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(fakeProduct.update).toHaveBeenCalledWith({ stockQuantity: 13 }, expect.anything());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// adminCancelOrder — 404 và 400 paths
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/orders/:id/cancel', () => {
  it('trả về 404 khi đơn hàng không tồn tại', async () => {
    Order.findByPk.mockResolvedValueOnce(null);

    const res = await request.put('/api/admin/orders/9999/cancel');
    expect(res.status).toBe(404);
  });

  it('trả về 400 khi đơn hàng đã bị hủy trước đó', async () => {
    const cancelledOrder = makeOrder({ id: 40, status: 'cancelled', items: [] });
    Order.findByPk.mockResolvedValueOnce(cancelledOrder);

    const res = await request.put('/api/admin/orders/40/cancel');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hủy trước đó/i);
  });

  it('trả về 400 khi đơn hàng đã giao (không thể hủy)', async () => {
    const deliveredOrder = makeOrder({ id: 41, status: 'delivered', items: [] });
    Order.findByPk.mockResolvedValueOnce(deliveredOrder);

    const res = await request.put('/api/admin/orders/41/cancel');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/không thể hủy/i);
  });

  it('hủy thành công và hoàn tồn kho Product (không có variant)', async () => {
    const fakeProductInOrder = makeProduct({ id: 7, stockQuantity: 5 });
    const activeOrder = makeOrder({
      id: 42,
      status: 'processing',
      items: [
        {
          quantity: 2,
          variantId: null,
          Product: fakeProductInOrder,
          ProductVariant: null,
        },
      ],
    });
    Order.findByPk.mockResolvedValueOnce(activeOrder);

    const res = await request.put('/api/admin/orders/42/cancel');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
    expect(fakeProductInOrder.update).toHaveBeenCalledWith({ stockQuantity: 7 }, expect.anything());
  });

  it('hủy thành công và hoàn tồn kho Variant khi có variantId', async () => {
    const fakeVariant = {
      id: 'v5',
      stockQuantity: 3,
      update: jest.fn().mockResolvedValue({ stockQuantity: 6 }),
    };
    const activeOrder = makeOrder({
      id: 43,
      status: 'processing',
      items: [
        {
          quantity: 3,
          variantId: 'v5',
          Product: makeProduct({ id: 8 }),
          ProductVariant: fakeVariant,
        },
      ],
    });
    Order.findByPk.mockResolvedValueOnce(activeOrder);

    const res = await request.put('/api/admin/orders/43/cancel');

    expect(res.status).toBe(200);
    expect(fakeVariant.update).toHaveBeenCalledWith({ stockQuantity: 6 }, expect.anything());
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
// exportReport — products type
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/reports/export — products type', () => {
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
// updateOrderStatus — 404
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/admin/orders/:id/status — 404', () => {
  it('trả về 404 khi đơn hàng không tồn tại', async () => {
    Order.findByPk.mockResolvedValueOnce(null);

    const res = await request.put('/api/admin/orders/9999/status').send({ status: 'delivered' });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createProduct — lines 793-796
// Empty try block triggered when productAttributes.length > 0 AND variantAttributes non-empty.
// The try block at 793 is entered; its empty body runs without error; catch (795-796) unreachable.
// Istanbul marks line 793 (try statement) as covered when entered.
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
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createProduct — lines 839-840
// catch block fires when ProductVariant.create throws → logger.error + rethrow → 500
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
// updateProduct — lines 1145-1146
// else if (attr.value) branch when attr.value is truthy but NOT a string AND NOT an Array
// e.g., attr.value = 42 (number) → attrValues = [String(42)] = ['42']
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
          // value là số nguyên (không phải string, không phải array) → else if (attr.value) → [String(1500)]
          value: 1500,
        },
      ],
    });

    expect(res.status).toBe(200);
    // ProductAttribute.create được gọi với values = ['1500'] (String(1500))
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
          // value là boolean true → else if (attr.value) truthy → [String(true)] = ['true']
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
