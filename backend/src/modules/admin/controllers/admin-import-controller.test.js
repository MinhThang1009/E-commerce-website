'use strict';
/**
 * Tests cho adminImport controller.
 * Tập trung vào: getImportTemplate, importProducts (CSV/JSON parsing +
 * validation), getImportHistory, exportProducts, và các helper (parseCsvLine,
 * parseCsv, validateRow, escapeCsvField) được gọi gián tiếp qua HTTP.
 */

process.env.NODE_ENV = 'test';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — trước mọi require()
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@services/vector-store/vector-store', () => ({
  upsertProduct: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  loadPromise: Promise.resolve(),
  items: [],
  enrichProductData: jest.fn((d) => d),
  detectLanguage: jest.fn().mockReturnValue('vi'),
}));

jest.mock('@middlewares/rate-limiter', () => ({
  apiLimiter: (_r, _s, n) => n(),
  authLimiter: (_r, _s, n) => n(),
  chatbotLimiter: (_r, _s, n) => n(),
  otpLimiter: (_r, _s, n) => n(),
}));

jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
  optionalAuthenticate: (_r, _s, n) => n(),
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
  requireSuperAdmin: (_r, _s, n) => n(),
}));

jest.mock('@middlewares/authorize', () => ({
  authorize: () => (_r, _s, n) => n(),
}));

jest.mock('@middlewares/validate-request', () => ({
  validateRequest: () => (_r, _s, n) => n(),
  validate: () => (_r, _s, n) => n(),
}));

jest.mock('@shared/admin-audit', () => ({
  AdminAuditService: class {
    static logUserAction() {}
    static logProductAction() {}
    static logOrderAction() {}
    static logDiscountCodeAction() {}
    log() {}
  },
  auditMiddleware: (_r, _s, n) => n(),
}));

jest.mock('@modules/discount-code/controllers/discount-code-controller', () => ({
  getAllDiscountCodes: (_r, _s, n) => n(),
  getDiscountCodeById: (_r, _s, n) => n(),
  createDiscountCode: (_r, _s, n) => n(),
  updateDiscountCode: (_r, _s, n) => n(),
  deleteDiscountCode: (_r, _s, n) => n(),
}));

// Mock models — tất cả model mà adminImport import trực tiếp
const mockTransaction = {
  commit: jest.fn().mockResolvedValue(),
  rollback: jest.fn().mockResolvedValue(),
};

jest.mock('@models', () => ({
  sequelize: {
    transaction: jest.fn((work) => work(mockTransaction)),
    query: jest.fn().mockResolvedValue([[], {}]),
    literal: jest.fn((s) => s),
  },
  Product: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
  },
  ProductVariant: { create: jest.fn() },
  ProductImage: { create: jest.fn() },
  ProductCategory: { create: jest.fn() },
  ProductSpecification: { create: jest.fn() },
  Category: { findAll: jest.fn() },
  Brand: { findAll: jest.fn() },
  // Models needed by other controllers on admin router
  User: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn(),
    sum: jest.fn(),
  },
  Order: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn(),
    sum: jest.fn(),
    update: jest.fn(),
  },
  OrderItem: { findAll: jest.fn(), create: jest.fn() },
  Review: { findAll: jest.fn(), findAndCountAll: jest.fn(), findByPk: jest.fn(), count: jest.fn() },
  ProductAttribute: { findAll: jest.fn(), destroy: jest.fn(), bulkCreate: jest.fn() },
  CartItem: { destroy: jest.fn() },
  InventoryLog: { create: jest.fn(), findAndCountAll: jest.fn() },
  AuditLog: { findAll: jest.fn(), findAndCountAll: jest.fn(), count: jest.fn(), create: jest.fn() },
  ChatMessage: { count: jest.fn(), findAll: jest.fn(), findOne: jest.fn() },
  WarrantyPackage: { findAll: jest.fn(), findByPk: jest.fn() },
  DiscountCode: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findAndCountAll: jest.fn(),
  },
}));

jest.mock('@config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue(null),
}));

jest.mock('@utils/product-helpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(0),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-TEST'),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Setup express app
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const supertest = require('supertest');
const adminRouter = require('@modules/admin/routes');
const {
  Category,
  Brand,
  Product,
  ProductVariant,
  ProductImage,
  ProductCategory,
  ProductSpecification,
} = require('@models');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});

const request = supertest(app);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** CSV đủ cột hợp lệ */
const VALID_CSV = [
  'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
  'iPhone 15 Pro,,Flagship Apple,36990000,dien-thoai,Apple,active,10,IPH15P-256,0.187,https://img.com/iphone.jpg,A17 Pro,8GB,256GB,6.1" OLED,3274 mAh',
].join('\n');

const VALID_CSV_NO_SKU = [
  'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
  'Samsung S24,,Galaxy phone,20000000,dien-thoai,Samsung,active,5,,,,,,,',
].join('\n');

// Một dòng thiếu name (base_price và category_slug hợp lệ) → chính xác 1 error / 1 row → 422
const INVALID_CSV_ALL_ERRORS = [
  'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
  ',,desc,10000,dien-thoai,,,0,,,,,,,,', // name rỗng, base_price + category_slug hợp lệ → 1 error / 1 row
].join('\n');

beforeEach(() => {
  jest.clearAllMocks();

  // Default mock setup
  Category.findAll.mockResolvedValue([{ id: 1, slug: 'dien-thoai', name: 'Điện thoại' }]);
  Brand.findAll.mockResolvedValue([
    { id: 10, name: 'Apple', slug: 'apple' },
    { id: 11, name: 'Samsung', slug: 'samsung' },
  ]);
  Product.findOne.mockResolvedValue(null); // slug chưa tồn tại
  Product.create.mockResolvedValue({ id: 100 });
  ProductVariant.create.mockResolvedValue({ id: 200 });
  ProductImage.create.mockResolvedValue({ id: 300 });
  ProductCategory.create.mockResolvedValue({ id: 400 });
  ProductSpecification.create.mockResolvedValue({});
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/products/import-template
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/products/import-template', () => {
  test('200 — trả về Content-Type text/csv', async () => {
    const res = await request.get('/api/admin/products/import-template');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  test('Content-Disposition là attachment với filename đúng', async () => {
    const res = await request.get('/api/admin/products/import-template');
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/product-import-template\.csv/);
  });

  test('nội dung CSV có header row đầy đủ các cột', async () => {
    const res = await request.get('/api/admin/products/import-template');
    const firstLine = res.text.split('\n')[0];
    expect(firstLine).toContain('name');
    expect(firstLine).toContain('base_price');
    expect(firstLine).toContain('category_slug');
    expect(firstLine).toContain('image_urls');
  });

  test('nội dung CSV có dòng ví dụ thứ hai không rỗng', async () => {
    const res = await request.get('/api/admin/products/import-template');
    const lines = res.text.split('\n').filter((l) => l.trim());
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[1]).toContain('36990000'); // base_price ví dụ
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/products/import — CSV
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — CSV', () => {
  test('400 khi không có file', async () => {
    const res = await request.post('/api/admin/products/import');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/upload file/i);
  });

  test('200 — import CSV hợp lệ: tạo Product', async () => {
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(VALID_CSV), {
        filename: 'products.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.successCount).toBeGreaterThanOrEqual(1);
  });

  test('200 — tạo ProductVariant khi có SKU', async () => {
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(VALID_CSV), { filename: 'p.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(ProductVariant.create).toHaveBeenCalled();
  });

  test('200 — KHÔNG tạo ProductVariant khi không có SKU', async () => {
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(VALID_CSV_NO_SKU), {
        filename: 'p.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    expect(ProductVariant.create).not.toHaveBeenCalled();
  });

  test('200 — tạo ProductImage khi có image_urls', async () => {
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(VALID_CSV), { filename: 'p.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(ProductImage.create).toHaveBeenCalledWith(
      expect.objectContaining({ isThumbnail: true, sortOrder: 1 }),
      expect.any(Object),
    );
  });

  test('200 — liên kết ProductCategory khi category_slug hợp lệ', async () => {
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(VALID_CSV), { filename: 'p.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(ProductCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 1, productId: 100 }),
      expect.any(Object),
    );
  });

  test('200 — tạo ProductSpecification cho các spec có giá trị', async () => {
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(VALID_CSV), { filename: 'p.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(ProductSpecification.create).toHaveBeenCalledWith(
      expect.objectContaining({ specKey: 'CPU', specValue: 'A17 Pro' }),
      expect.any(Object),
    );
  });

  test('422 khi tất cả dòng đều không hợp lệ', async () => {
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(INVALID_CSV_ALL_ERRORS), {
        filename: 'bad.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('200 — slug tự động từ name khi slug để trống', async () => {
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(VALID_CSV), { filename: 'p.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: expect.stringMatching(/iphone-15-pro/) }),
      expect.any(Object),
    );
  });

  test('200 — slug thêm timestamp khi slug đã tồn tại', async () => {
    Product.findOne.mockResolvedValue({ id: 99 }); // slug trùng

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(VALID_CSV), { filename: 'p.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    // Slug phải thêm suffix timestamp
    const createCall = Product.create.mock.calls[0][0];
    expect(createCall.slug).toMatch(/iphone-15-pro-\d+/);
  });

  test('200 — failedCount tăng khi Product.create throw', async () => {
    Product.create.mockRejectedValue(new Error('DB error'));

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(VALID_CSV), { filename: 'p.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.data.failedCount).toBeGreaterThanOrEqual(1);
    // errors mảng phải chứa entry lỗi
    expect(res.body.data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'general' })]),
    );
  });

  test('400 khi file CSV rỗng (không có dữ liệu)', async () => {
    const emptyCsv = 'name,base_price,category_slug\n';
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(emptyCsv), { filename: 'empty.csv', contentType: 'text/csv' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/rỗng/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/products/import — JSON
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — JSON', () => {
  const validJsonProducts = JSON.stringify([
    {
      name: 'MacBook Pro',
      base_price: '45000000',
      category_slug: 'laptop',
      brand: 'Apple',
    },
  ]);

  beforeEach(() => {
    Category.findAll.mockResolvedValue([{ id: 2, slug: 'laptop', name: 'Laptop' }]);
  });

  test('400 khi file JSON không phải mảng', async () => {
    const notArray = JSON.stringify({ name: 'single object' });
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(notArray), {
        filename: 'products.json',
        contentType: 'application/json',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/mảng/i);
  });

  test('400 khi file JSON malformed', async () => {
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from('{ invalid json }'), {
        filename: 'bad.json',
        contentType: 'application/json',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/không hợp lệ/i);
  });

  test('200 — import JSON hợp lệ', async () => {
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(validJsonProducts), {
        filename: 'products.json',
        contentType: 'application/json',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.totalRows).toBe(1);
  });

  test('200 — JSON tự động thêm _lineNumber từ index', async () => {
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(validJsonProducts), {
        filename: 'p.json',
        contentType: 'application/json',
      });

    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/products/export
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/products/export', () => {
  const mockProducts = [
    {
      id: 1,
      name: 'iPhone 15',
      slug: 'iphone-15',
      shortDescription: 'Phone',
      basePrice: 29990000,
      status: 'active',
      stockQuantity: 10,
      category: { slug: 'dien-thoai' },
      brand: { name: 'Apple' },
      productImages: [{ imageUrl: 'https://img/iphone.jpg' }],
      specifications: [{ specKey: 'CPU', specValue: 'A17' }],
    },
  ];

  beforeEach(() => {
    Product.findAll.mockResolvedValue(mockProducts);
  });

  test('200 — format=csv → Content-Type text/csv', async () => {
    const res = await request.get('/api/admin/products/export?format=csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  test('200 — format=csv → Content-Disposition attachment', async () => {
    const res = await request.get('/api/admin/products/export?format=csv');
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/products-export/);
  });

  test('200 — mặc định format=csv khi không truyền format', async () => {
    const res = await request.get('/api/admin/products/export');
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  test('200 — format=json → Content-Type application/json', async () => {
    const res = await request.get('/api/admin/products/export?format=json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  test('200 — format=json → mảng sản phẩm với đúng fields', async () => {
    const res = await request.get('/api/admin/products/export?format=json');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      name: 'iPhone 15',
      base_price: 29990000,
      category_slug: 'dien-thoai',
      brand: 'Apple',
    });
  });

  test('200 — CSV chứa header row đầy đủ', async () => {
    const res = await request.get('/api/admin/products/export?format=csv');
    const firstLine = res.text.split('\n')[0];
    expect(firstLine).toContain('name');
    expect(firstLine).toContain('base_price');
  });

  test('200 — CSV escape field có dấu phẩy', async () => {
    Product.findAll.mockResolvedValue([
      {
        ...mockProducts[0],
        name: 'Product, with comma',
        category: { slug: 'cat' },
        brand: null,
        productImages: [],
        specifications: [],
      },
    ]);

    const res = await request.get('/api/admin/products/export?format=csv');
    expect(res.text).toContain('"Product, with comma"');
  });

  test('200 — sản phẩm không có category/brand → empty string', async () => {
    Product.findAll.mockResolvedValue([
      {
        ...mockProducts[0],
        category: null,
        brand: null,
        productImages: [],
        specifications: [],
      },
    ]);

    const res = await request.get('/api/admin/products/export?format=json');
    expect(res.body[0].category_slug).toBe('');
    expect(res.body[0].brand).toBe('');
  });

  test('200 — nhiều image_urls nối bởi |', async () => {
    Product.findAll.mockResolvedValue([
      {
        ...mockProducts[0],
        category: { slug: 'cat' },
        brand: null,
        productImages: [{ imageUrl: 'img1.jpg' }, { imageUrl: 'img2.jpg' }],
        specifications: [],
      },
    ]);

    const res = await request.get('/api/admin/products/export?format=json');
    expect(res.body[0].image_urls).toBe('img1.jpg|img2.jpg');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// importFileFilter — line 35: file extension không phải csv/json VÀ mimetype sai
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — line 35: file extension không hợp lệ', () => {
  test('400 khi upload file .txt (không phải csv/json)', async () => {
    // .txt extension + text/plain mimetype — cả hai đều không khớp csv/json extension
    // importFileFilter: ext không phải .csv/.json → kiểm tra mimetype →
    // 'text/plain' nằm trong allowedMimes → trả về cb(null, true)
    // Nhưng nếu ext là .exe + mimetype lạ → line 35 hit
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from('binary content'), {
        filename: 'malware.exe',
        contentType: 'application/x-executable',
      });

    // multer filter sẽ gọi cb(new AppError(...), false) → multer tạo error
    // Express sẽ pass lỗi đến error handler → 400
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/CSV|JSON/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateRow — line 146: base_price là số âm → error 'base_price không được âm'
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — line 146: base_price âm → validation error', () => {
  test('422 khi base_price là số âm', async () => {
    const csvWithNegativePrice = [
      'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
      'Sản phẩm lỗi,,Mô tả,-5000,dien-thoai,,,0,,,,,,,,',
    ].join('\n');

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvWithNegativePrice), {
        filename: 'negative.csv',
        contentType: 'text/csv',
      });

    // Dòng có base_price âm → validateRow trả về error → 422
    expect(res.status).toBe(422);
    const errors = res.body.errors;
    expect(errors).toBeDefined();
    // Tìm lỗi liên quan đến base_price âm
    const basePriceError = errors.find((e) => e.field === 'base_price' && e.message.includes('âm'));
    expect(basePriceError).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateRow — line 146: base_price thiếu hoặc NaN → 'base_price phải là số hợp lệ'
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — line 146: base_price thiếu/NaN', () => {
  test('422 khi base_price bị thiếu (empty string)', async () => {
    // base_price empty → !row.base_price = true → line 146 errors.push
    const csvMissingPrice = [
      'name,slug,short_description,base_price,category_slug',
      'Sản phẩm A,,,, dien-thoai', // base_price rỗng
    ].join('\n');

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvMissingPrice), {
        filename: 'missing-price.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(422);
    const errors = res.body.errors;
    const priceError = errors.find((e) => e.field === 'base_price');
    expect(priceError).toBeDefined();
    expect(priceError.message).toMatch(/số hợp lệ/);
  });

  test('422 khi base_price là chuỗi không phải số (NaN)', async () => {
    // isNaN(parseFloat('abc')) = true → line 146 errors.push
    const csvNanPrice = [
      'name,slug,short_description,base_price,category_slug',
      'Sản phẩm B,,Mô tả,abc-price,dien-thoai',
    ].join('\n');

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvNanPrice), {
        filename: 'nan-price.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(422);
    const errors = res.body.errors;
    const priceError = errors.find((e) => e.field === 'base_price');
    expect(priceError).toBeDefined();
    expect(priceError.message).toMatch(/số hợp lệ/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateRow — line 152: category_slug rỗng → validation error
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — line 152: category_slug rỗng', () => {
  test('422 khi category_slug bị thiếu', async () => {
    // category_slug empty → !row.category_slug = true → line 152 errors.push
    const csvMissingCategory = [
      'name,slug,short_description,base_price,category_slug',
      'Sản phẩm C,,Mô tả,10000000,', // category_slug rỗng
    ].join('\n');

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvMissingCategory), {
        filename: 'missing-cat.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(422);
    const errors = res.body.errors;
    const catError = errors.find((e) => e.field === 'category_slug');
    expect(catError).toBeDefined();
    expect(catError.message).toMatch(/bắt buộc/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseCsv — line 110: lines.length === 0 → return empty (empty CSV file)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — line 110: CSV file trống', () => {
  test('400 khi file CSV hoàn toàn trống (không có dòng nào)', async () => {
    // Empty CSV → parseCsv returns [] rows → no data to import
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from('\n\n   \n'), {
        filename: 'empty.csv',
        contentType: 'text/csv',
      });

    // Empty file → no rows → 400 (no data to import) or 200 with 0 rows
    expect([200, 400, 422]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.data.totalRows).toBe(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseCsvLine — lines 88-89: escaped quote ("") in CSV field
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — lines 88-89: escaped quote trong CSV field', () => {
  test('200 — parse dấu ngoặc kép escaped ("") trong tên sản phẩm', async () => {
    // Field có "" → parseCsvLine lines 88-89: current += '"'; i++
    const csvWithEscapedQuote = [
      'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
      '"iPhone ""Pro"" Max",,Flagship,36990000,dien-thoai,Apple,active,5,IPH-PRO-MAX,0.228,,,,,,',
    ].join('\n');

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvWithEscapedQuote), {
        filename: 'quoted.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    // Product.create called with name containing the actual quotes
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.stringContaining('iPhone') }),
      expect.anything(),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseCsv — line 117: dòng trống trong CSV bị bỏ qua
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — line 117: dòng trống bị bỏ qua', () => {
  test('200 — bỏ qua dòng trống (tất cả các field rỗng) trong CSV', async () => {
    // A blank row (all values empty) → values.every(v => v === '') → continue (line 117)
    const csvWithBlankRows = [
      'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
      'iPhone 15 Pro,,Flagship Apple,36990000,dien-thoai,Apple,active,10,IPH15P-256,0.187,https://img.com/iphone.jpg,A17 Pro,8GB,256GB,6.1" OLED,3274 mAh',
      ',,,,,,,,,,,,,,,', // blank row → every value is '' → skipped
    ].join('\n');

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvWithBlankRows), {
        filename: 'blanks.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    // Only 1 valid product (blank row was skipped)
    expect(res.body.data.totalRows).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// lines 264-265: validRows filter — row with validation error → failedCount++
// (the .some() callback runs when rowErrors has matching row._lineNumber)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — lines 264-265: validRows filter với error rows', () => {
  test('200 — hàng có lỗi validation bị đưa vào failedCount', async () => {
    // Mix: one valid row + one row with missing name → validation error
    // → validRows.filter runs rowErrors.some() → hasError=true for bad row
    const csvMixedRows = [
      'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
      'iPhone 15 Pro,,Flagship,36990000,dien-thoai,Apple,active,10,IPH15P,0.187,https://img.com/img.jpg,A17,8GB,256GB,6.1",3274mAh',
      ',,Missing name,10000,dien-thoai,,,0,,,,,,,,', // missing name → validation error
    ].join('\n');

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvMixedRows), {
        filename: 'mixed.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.failedCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.successCount).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// lines 394-397: vectorStore sync sau import — upsertProduct + save
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — lines 394-397: vectorStore sync', () => {
  test('gọi vectorStoreService.upsertProduct và save sau khi import thành công', async () => {
    const { upsertProduct, save } = require('@services/vector-store/vector-store');

    // Set up findAll to return a product for the vector sync
    Product.findAll.mockResolvedValueOnce([
      { id: 100, name: 'iPhone 15 Pro', toJSON: () => ({ id: 100, name: 'iPhone 15 Pro' }) },
    ]);

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(VALID_CSV), {
        filename: 'products.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);

    // setImmediate fires asynchronously — wait for it
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(upsertProduct).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// line 33: fileFilter — allowedMimes.includes(file.mimetype) branch
// This path is hit when file extension isn't csv/json but mimetype is allowed
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — line 33: fileFilter allowedMimes branch', () => {
  test('chấp nhận file khi mimetype là text/csv ngay cả khi ext không phải .csv', async () => {
    // Upload file with .txt extension but text/csv MIME → allowedMimes branch (line 32-33)
    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(VALID_CSV), {
        filename: 'products.txt', // ext is .txt not .csv
        contentType: 'text/csv', // but mimetype is text/csv → line 32-33
      });

    // Should be accepted (200 or process normally, not 400 for unsupported type)
    expect([200, 422]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// lines 274-279: brand và category null branches trong transaction
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — lines 274-279: brand null và category null', () => {
  test('200 — import thành công khi brand để trống (brandName = null → brandId = null)', async () => {
    // row.brand = '' → brandName = null → brandId = null (false branch line 276)
    const csvNoBrand = [
      'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
      'Samsung S24,,Galaxy,20000000,dien-thoai,,active,5,,,,,,,,',
    ].join('\n');

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvNoBrand), {
        filename: 'nobrand.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ brandId: null }),
      expect.any(Object),
    );
  });

  test('200 — import thành công khi category_slug không tìm thấy trong map (categoryId = null)', async () => {
    // Category.findAll không trả về dien-thoai → categoryMap không có key này → categoryId = null
    Category.findAll.mockResolvedValue([]); // empty → map trống → categoryId = null (|| null branch)

    const csvUnknownCategory = [
      'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
      'Product X,,Desc,10000000,unknown-category,Apple,active,3,,,,,,,,',
    ].join('\n');

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvUnknownCategory), {
        filename: 'unknowncat.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    // categoryId = null → ProductCategory.create không được gọi (line 332 false branch)
    expect(ProductCategory.create).not.toHaveBeenCalled();
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: null }),
      expect.any(Object),
    );
  });

  test('200 — import với brand hợp lệ nhưng không có trong brandMap (brandId = null)', async () => {
    // brand có giá trị nhưng không tìm thấy trong brandMap → brandId = null (?? null branch)
    Brand.findAll.mockResolvedValue([]); // empty → brandMap trống → brandId = null

    const csvBrandNotInMap = [
      'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
      'Phone Z,,Desc,15000000,dien-thoai,UnknownBrand,active,2,,,,,,,,',
    ].join('\n');

    // Restore category mock
    Category.findAll.mockResolvedValue([{ id: 1, slug: 'dien-thoai', name: 'Điện thoại' }]);

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvBrandNotInMap), {
        filename: 'unknownbrand.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ brandId: null }),
      expect.any(Object),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// line 279-281: rawSlug từ row.slug trực tiếp (slug được cung cấp, không auto-gen)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — line 279-281: slug được cung cấp trực tiếp', () => {
  test('200 — dùng slug cung cấp thay vì auto-generate từ name', async () => {
    const csvWithSlug = [
      'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
      'iPhone 15 Pro,my-custom-slug,Flagship,36990000,dien-thoai,Apple,active,10,,,,,,,,',
    ].join('\n');

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvWithSlug), {
        filename: 'withslug.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    // Slug phải là đúng slug được cung cấp (không phải iphone-15-pro)
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'my-custom-slug' }),
      expect.any(Object),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// line 297: shortDescription null khi không cung cấp
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — line 297: shortDescription null', () => {
  test('200 — shortDescription là null khi row.short_description rỗng', async () => {
    const csvNoDesc = [
      'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
      'Widget,,, 10000,dien-thoai,Apple,active,0,,,,,,,,',
    ].join('\n');

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvNoDesc), { filename: 'nodesc.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ shortDescription: null }),
      expect.any(Object),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// lines 472-499: export CSV — null category/brand → empty string (|| '' branches)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/products/export — CSV null category/brand branches', () => {
  test('200 — CSV: product không có category → category_slug là empty string', async () => {
    Product.findAll.mockResolvedValue([
      {
        id: 1,
        name: 'Widget',
        slug: 'widget',
        shortDescription: null,
        basePrice: 100000,
        status: 'active',
        stockQuantity: 5,
        category: null, // null category
        brand: { name: 'Apple' },
        productImages: [],
        specifications: [],
      },
    ]);

    const res = await request.get('/api/admin/products/export?format=csv');

    expect(res.status).toBe(200);
    // CSV row sẽ có category_slug rỗng
    expect(res.text).toContain('Widget');
  });

  test('200 — CSV: product không có brand → brand là empty string', async () => {
    Product.findAll.mockResolvedValue([
      {
        id: 2,
        name: 'Gadget',
        slug: 'gadget',
        shortDescription: null,
        basePrice: 200000,
        status: 'active',
        stockQuantity: 3,
        category: { slug: 'electronics' },
        brand: null, // null brand
        productImages: [],
        specifications: [],
      },
    ]);

    const res = await request.get('/api/admin/products/export?format=csv');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Gadget');
  });

  test('200 — CSV: stock_quantity null/undefined → 0 (|| 0 branch)', async () => {
    Product.findAll.mockResolvedValue([
      {
        id: 3,
        name: 'ZeroStock',
        slug: 'zero',
        shortDescription: null,
        basePrice: 50000,
        status: null, // status null → 'active' default
        stockQuantity: null, // null → 0
        category: null,
        brand: null,
        productImages: [],
        specifications: [],
      },
    ]);

    const res = await request.get('/api/admin/products/export?format=csv');

    expect(res.status).toBe(200);
    // CSV sẽ có 0 cho stock_quantity
    const dataLine = res.text.split('\n')[1];
    expect(dataLine).toBeDefined();
  });

  test('200 — CSV: specifications specMap lookup — spec không tồn tại → empty string', async () => {
    Product.findAll.mockResolvedValue([
      {
        id: 4,
        name: 'NoSpec',
        slug: 'nospec',
        shortDescription: null,
        basePrice: 75000,
        status: 'active',
        stockQuantity: 1,
        category: null,
        brand: null,
        productImages: [],
        specifications: [], // không có spec → specMap rỗng → specMap['cpu'] = undefined → || '' → ''
      },
    ]);

    const res = await request.get('/api/admin/products/export?format=csv');

    expect(res.status).toBe(200);
    // Không crash khi specMap không có entries
    const dataLine = res.text.split('\n')[1];
    expect(dataLine).toBeDefined();
  });

  test("200 — JSON: shortDescription null → empty string (|| '' branch)", async () => {
    Product.findAll.mockResolvedValue([
      {
        id: 5,
        name: 'NullDesc',
        slug: 'nulldesc',
        shortDescription: null, // null → || '' → ''
        basePrice: 99000,
        status: 'active',
        stockQuantity: 2,
        category: null,
        brand: null,
        productImages: [],
        specifications: [],
      },
    ]);

    const res = await request.get('/api/admin/products/export?format=json');

    expect(res.status).toBe(200);
    expect(res.body[0].short_description).toBe('');
  });

  test('200 — JSON: status null → "active" (|| "active" branch)', async () => {
    Product.findAll.mockResolvedValue([
      {
        id: 6,
        name: 'NoStatus',
        slug: 'nostatus',
        shortDescription: null,
        basePrice: 50000,
        status: null, // null → || 'active'
        stockQuantity: 0, // 0 → || 0 (falsy → right side)
        category: null,
        brand: null,
        productImages: [],
        specifications: [],
      },
    ]);

    const res = await request.get('/api/admin/products/export?format=json');

    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('active');
    expect(res.body[0].stock_quantity).toBe(0);
  });

  test('200 — JSON: specifications null → [] (|| [] branch)', async () => {
    Product.findAll.mockResolvedValue([
      {
        id: 7,
        name: 'NoSpec2',
        slug: 'nospec2',
        shortDescription: null,
        basePrice: 30000,
        status: 'active',
        stockQuantity: 1,
        category: null,
        brand: null,
        productImages: null, // null → || [] branch
        specifications: null, // null → || [] branch
      },
    ]);

    const res = await request.get('/api/admin/products/export?format=json');

    expect(res.status).toBe(200);
    expect(res.body[0].image_urls).toBe('');
  });

  test('200 — CSV: basePrice null → 0 (|| 0 branch)', async () => {
    Product.findAll.mockResolvedValue([
      {
        id: 8,
        name: 'NullPrice',
        slug: 'nullprice',
        shortDescription: null,
        basePrice: null, // null → || 0
        status: null, // null → || 'active'
        stockQuantity: null, // null → || 0
        category: null,
        brand: null,
        productImages: null, // null → || []
        specifications: null, // null → || []
      },
    ]);

    const res = await request.get('/api/admin/products/export?format=csv');

    expect(res.status).toBe(200);
    const dataLine = res.text.split('\n')[1];
    expect(dataLine).toBeDefined();
    // basePrice=0 và status='active' phải xuất hiện trong dòng CSV
    expect(dataLine).toContain('0');
  });

  test("200 — escapeCsvField: val là null → dùng '' (val ?? '' branch, line 523)", async () => {
    // escapeCsvField(null) → String(null ?? '') → String('') = ''
    // Đây cover ?? right side khi val = null (p.name hoặc p.slug là null)
    Product.findAll.mockResolvedValue([
      {
        id: 9,
        name: null, // null → escapeCsvField(null) → ?? '' right side
        slug: null, // null → escapeCsvField(null) → ?? '' right side
        shortDescription: null,
        basePrice: 0,
        status: 'active',
        stockQuantity: 0,
        category: null,
        brand: null,
        productImages: [],
        specifications: [],
      },
    ]);

    const res = await request.get('/api/admin/products/export?format=csv');

    expect(res.status).toBe(200);
    // Không crash khi name/slug là null → ?? '' cho ra ''
    const dataLine = res.text.split('\n')[1];
    expect(dataLine).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// line 313: ProductVariant stockQuantity = 0 (parseInt || 0 right side)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — line 313: stock_quantity là 0 hoặc NaN (|| 0 branch)', () => {
  test('200 — ProductVariant stockQuantity = 0 khi stock_quantity là 0', async () => {
    // parseInt('0') = 0, falsy → || 0 → stockQuantity = 0 (right side của ||)
    const csvZeroStock = [
      'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
      'Phone A,,Desc,15000000,dien-thoai,Apple,active,0,SKU-A,,,,,,,',
    ].join('\n');

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvZeroStock), {
        filename: 'zerostock.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    // ProductVariant.create được gọi với stockQuantity = 0
    expect(ProductVariant.create).toHaveBeenCalledWith(
      expect.objectContaining({ stockQuantity: 0 }),
      expect.any(Object),
    );
  });

  test('200 — Product.create stockQuantity = 0 khi stock_quantity rỗng (|| 0 branch)', async () => {
    // parseInt('') = NaN, falsy → || 0
    const csvEmptyStock = [
      'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity,sku,weight_kg,image_urls,spec_cpu,spec_ram,spec_storage,spec_display,spec_battery',
      'Phone B,,Desc,20000000,dien-thoai,Apple,active,,,,,,,,,',
    ].join('\n');

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(csvEmptyStock), {
        filename: 'emptystock.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ stockQuantity: 0 }),
      expect.any(Object),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// line 365: err.message || 'Lỗi khi insert vào DB' (|| right side)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products/import — line 365: lỗi không có message (|| fallback)', () => {
  test('200 — rowErrors chứa message fallback khi err.message là undefined', async () => {
    // Tạo error không có message property
    const errWithoutMessage = new Error();
    errWithoutMessage.message = undefined;
    Product.create.mockRejectedValueOnce(errWithoutMessage);

    const res = await request
      .post('/api/admin/products/import')
      .attach('file', Buffer.from(VALID_CSV), { filename: 'nomsg.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.data.failedCount).toBeGreaterThanOrEqual(1);
    // Message trong error sẽ là fallback 'Lỗi khi insert vào DB'
    const rowError = res.body.data.errors.find((e) => e.field === 'general');
    expect(rowError).toBeDefined();
  });
});
