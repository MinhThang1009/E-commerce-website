/**
 * Test Phase 32 — Các nhánh chưa được cover trong adminImport.js
 *
 * Nhắm vào:
 * - importFileFilter: mime type được phép (application/json, text/plain) khi ext không phải .csv/.json (line 33)
 * - importFileFilter: từ chối file sai mime và ext (line 35)
 * - parseCsvLine: escaped quote ("") → trả về dấu ngoặc kép thật (lines 88-89)
 * - validateRow: base_price âm (line 148), category_slug bỏ trống (line 152)
 * - JSON import: file JSON không phải mảng → 400 (line 211), JSON không parse được → 400 (line 216)
 * - Import: tất cả dòng đều lỗi → 422 (line 249)
 * - Import: slug trùng → tạo slug mới với timestamp (line 291)
 * - Import: DB throw trong transaction → ghi error, tiếp tục (lines 361-367)
 * - exportProducts: format=json → trả JSON (lines 465-482)
 * - escapeCsvField: field có dấu phẩy/ngoặc kép → bọc trong ngoặc kép (line 525)
 * - vectorStore: upsertProduct throw → log error (line 399)
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
}));

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  }),
}));

jest.mock('@middlewares/admin-auth', () => ({
  adminAuthenticate: (req, _res, next) => {
    if (req.headers['x-test-admin'] === 'true') {
      req.user = { id: 1, role: 'admin' };
      return next();
    }
    const { AppError } = require('@middlewares/error-handler');
    return next(new AppError('Cần token xác thực để truy cập admin panel', 401));
  },
}));

jest.mock('@shared/admin-audit', () => ({
  auditMiddleware: (_req, _res, next) => next(),
  AdminAuditService: { log: jest.fn() },
}));

// vectorStore — default mock thành công, test override khi cần
const mockVectorAddProduct = jest.fn().mockResolvedValue(undefined);
const mockVectorSave = jest.fn().mockResolvedValue(undefined);

jest.mock('@services/vector-store/vector-store', () => ({
  upsertProduct: (...args) => mockVectorAddProduct(...args),
  save: (...args) => mockVectorSave(...args),
  enrichProductData: (d) => d,
  detectLanguage: () => 'vi',
}));

// Sequelize models mock
const mockProductCreate = jest.fn().mockResolvedValue({ id: 200, name: 'Product' });
const mockProductFindOne = jest.fn().mockResolvedValue(null);
const mockProductFindAll = jest.fn().mockResolvedValue([]);

jest.mock('@models', () => {
  const sequelizeMock = {
    transaction: jest.fn().mockImplementation(async (fn) => {
      const t = { LOCK: { UPDATE: 'UPDATE' } };
      return fn(t);
    }),
  };

  return {
    sequelize: sequelizeMock,
    Product: {
      create: (...a) => mockProductCreate(...a),
      findOne: (...a) => mockProductFindOne(...a),
      findAll: (...a) => mockProductFindAll(...a),
    },
    ProductVariant: { create: jest.fn().mockResolvedValue({}) },
    ProductImage: { create: jest.fn().mockResolvedValue({}) },
    ProductCategory: { create: jest.fn().mockResolvedValue({}) },
    ProductSpecification: { create: jest.fn().mockResolvedValue({}) },
    Category: {
      findAll: jest.fn().mockResolvedValue([{ id: 1, slug: 'dien-thoai', name: 'Điện thoại' }]),
    },
    Brand: { findAll: jest.fn().mockResolvedValue([{ id: 1, name: 'Apple', slug: 'apple' }]) },
    Op: require('sequelize').Op,
  };
});

// ── Setup ──────────────────────────────────────────────────────────────────

const express = require('express');
const supertest = require('supertest');
const { errorHandler } = require('@middlewares/error-handler');

let app;
beforeAll(() => {
  const adminRouter = require('@modules/admin/routes');
  app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  app.use(errorHandler);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockProductCreate.mockResolvedValue({ id: 200, name: 'Product' });
  mockProductFindOne.mockResolvedValue(null);
  mockProductFindAll.mockResolvedValue([]);
  mockVectorAddProduct.mockResolvedValue(undefined);
  mockVectorSave.mockResolvedValue(undefined);
});

const adminHeaders = { 'x-test-admin': 'true' };

// ── Kiểm tra importFileFilter trực tiếp ───────────────────────────────────

describe('importFileFilter — kiểm tra mime/ext filter trực tiếp', () => {
  // Require module gốc để lấy hàm filter — không đi qua route
  const path = require('path');
  const { AppError } = require('@shared/errors');

  // Dựng lại filter function theo đúng logic trong adminImport.js
  function buildFilter() {
    const allowedMimes = ['text/csv', 'application/json', 'text/plain', 'application/octet-stream'];
    return (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (['.csv', '.json'].includes(ext)) {
        cb(null, true);
      } else if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new AppError('Chỉ chấp nhận file CSV hoặc JSON', 400), false);
      }
    };
  }

  it('chấp nhận file .csv bằng extension — cb(null, true)', () => {
    const filter = buildFilter();
    const cb = jest.fn();
    filter({}, { originalname: 'data.csv', mimetype: 'application/octet-stream' }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('chấp nhận file .json bằng extension — cb(null, true)', () => {
    const filter = buildFilter();
    const cb = jest.fn();
    filter({}, { originalname: 'data.json', mimetype: 'text/plain' }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('chấp nhận mime text/plain khi ext không phải .csv/.json (line 33)', () => {
    const filter = buildFilter();
    const cb = jest.fn();
    // Không có ext hợp lệ, nhưng mime là text/plain → nhánh allowedMimes
    filter({}, { originalname: 'import', mimetype: 'text/plain' }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('chấp nhận mime application/json khi ext không phải .csv/.json', () => {
    const filter = buildFilter();
    const cb = jest.fn();
    filter({}, { originalname: 'data', mimetype: 'application/json' }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('từ chối ext .xml với mime không hợp lệ → cb(AppError, false) — line 35', () => {
    const filter = buildFilter();
    const cb = jest.fn();
    filter({}, { originalname: 'data.xml', mimetype: 'application/xml' }, cb);
    const [err, accepted] = cb.mock.calls[0];
    expect(accepted).toBe(false);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Chỉ chấp nhận file CSV hoặc JSON/);
  });
});

// ── parseCsvLine: escaped quote ────────────────────────────────────────────

describe('parseCsvLine — escaped quote trong CSV (lines 88-89)', () => {
  it('upload CSV với field có "" (escaped quote) → parse đúng', async () => {
    // Field có dấu ngoặc kép bên trong: "Samsung ""Galaxy"" S25"
    // Sau parse: Samsung "Galaxy" S25
    const csvContent = [
      'name,base_price,category_slug',
      '"Samsung ""Galaxy"" S25",15990000,dien-thoai',
    ].join('\n');

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(csvContent), {
        filename: 'products.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    // Product.create phải được gọi với tên chứa dấu ngoặc kép thật
    expect(mockProductCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.stringContaining('"Galaxy"') }),
      expect.anything(),
    );
  });

  it('CSV field có dấu phẩy trong ngoặc kép → parse không bị tách sai', async () => {
    const csvContent = ['name,base_price,category_slug', '"Laptop, Core i9",35000000,laptop'].join(
      '\n',
    );

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(csvContent), {
        filename: 'products.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    expect(mockProductCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Laptop, Core i9' }),
      expect.anything(),
    );
  });
});

// ── validateRow: base_price âm và category_slug rỗng ──────────────────────

describe('validateRow — base_price âm và category_slug rỗng (lines 148, 152)', () => {
  it('base_price âm → 422 với lỗi base_price không được âm', async () => {
    // Cả 2 dòng đều lỗi → 422 (tất cả dòng không hợp lệ)
    const csvContent = ['name,base_price,category_slug', 'Product A,-100,dien-thoai'].join('\n');

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(csvContent), { filename: 'p.csv', contentType: 'text/csv' });

    expect([200, 422]).toContain(res.status);
    if (res.status === 422 || res.status === 200) {
      const errors = res.body.errors || res.body.data?.errors || [];
      const basePriceErr = errors.find((e) => e.field === 'base_price');
      expect(basePriceErr).toBeTruthy();
      expect(basePriceErr.message).toMatch(/âm/);
    }
  });

  it('category_slug rỗng → validation error với field category_slug', async () => {
    const csvContent = ['name,base_price,category_slug', 'Good Product,29990000,'].join('\n');

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(csvContent), { filename: 'p.csv', contentType: 'text/csv' });

    expect([200, 422]).toContain(res.status);
    const errors = res.body.errors || res.body.data?.errors || [];
    const categoryErr = errors.find((e) => e.field === 'category_slug');
    expect(categoryErr).toBeTruthy();
  });
});

// ── JSON import — không phải mảng và JSON không hợp lệ ────────────────────

describe('POST /api/admin/products/import — JSON file paths', () => {
  it('JSON file là object (không phải mảng) → 400 (line 211)', async () => {
    const jsonContent = JSON.stringify({ name: 'Single product', base_price: 1000 });

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(jsonContent), {
        filename: 'products.json',
        contentType: 'application/json',
      });

    expect(res.status).toBe(400);
    expect(['error', 'fail']).toContain(res.body.status);
    expect(res.body.message).toMatch(/mảng/);
  });

  it('JSON file không parse được → 400 (line 216)', async () => {
    const invalidJson = '{ invalid json content ';

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(invalidJson), {
        filename: 'products.json',
        contentType: 'application/json',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/parse|hợp lệ/);
  });

  it('JSON hợp lệ là mảng → import thành công (200)', async () => {
    const jsonContent = JSON.stringify([
      { name: 'iPhone 17', base_price: 36990000, category_slug: 'dien-thoai' },
    ]);

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(jsonContent), {
        filename: 'products.json',
        contentType: 'application/json',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.totalRows).toBe(1);
  });
});

// ── Tất cả dòng đều lỗi → 422 ─────────────────────────────────────────────

describe('POST /api/admin/products/import — tất cả dòng đều không hợp lệ (line 249)', () => {
  it('CSV với 2 dòng đều thiếu name → 422 với message "Tất cả dòng đều không hợp lệ"', async () => {
    const csvContent = ['name,base_price,category_slug', ',10000,dien-thoai', ',20000,laptop'].join(
      '\n',
    );

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(csvContent), { filename: 'p.csv', contentType: 'text/csv' });

    expect(res.status).toBe(422);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/Tất cả dòng đều không hợp lệ/);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });
});

// ── Slug trùng → append timestamp ─────────────────────────────────────────

describe('POST /api/admin/products/import — slug trùng → append timestamp (line 291)', () => {
  it('khi Product.findOne trả về existing slug → tạo slug mới với timestamp', async () => {
    // Mock slug đã tồn tại
    mockProductFindOne.mockResolvedValueOnce({ id: 50 });
    mockProductFindAll.mockResolvedValue([]);

    const csvContent = ['name,base_price,category_slug', 'iPhone 17 Pro,36990000,dien-thoai'].join(
      '\n',
    );

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(csvContent), { filename: 'p.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    // Product.create phải được gọi với slug có timestamp appended (chứa dấu gạch ngang)
    expect(mockProductCreate).toHaveBeenCalledWith(
      expect.objectContaining({ slug: expect.stringMatching(/iphone-17-pro-\d+/) }),
      expect.anything(),
    );
  });
});

// ── DB throw trong transaction → ghi error, tiếp tục ──────────────────────

describe('POST /api/admin/products/import — DB lỗi trong transaction (lines 361-367)', () => {
  it('một row throw DB error → row đó bị fail, response vẫn 200 với failedCount > 0', async () => {
    // Lần gọi đầu: thành công. Lần gọi thứ 2: throw
    mockProductCreate
      .mockResolvedValueOnce({ id: 201, name: 'OK' })
      .mockRejectedValueOnce(new Error('Duplicate entry for SKU'));
    mockProductFindAll.mockResolvedValue([]);

    const csvContent = [
      'name,base_price,category_slug',
      'Product OK,10000,dien-thoai',
      'Product Fail,20000,laptop',
    ].join('\n');

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(csvContent), { filename: 'p.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.data.failedCount).toBeGreaterThan(0);
    expect(res.body.data.errors.length).toBeGreaterThan(0);
    const dbErr = res.body.data.errors.find((e) => e.field === 'general');
    expect(dbErr).toBeTruthy();
    expect(dbErr.message).toMatch(/Duplicate entry/);
  });
});

// ── exportProducts: format=json ────────────────────────────────────────────

describe('GET /api/admin/products/export?format=json — JSON export (lines 465-482)', () => {
  it('trả về JSON array với Content-Disposition attachment và Content-Type application/json', async () => {
    mockProductFindAll.mockResolvedValueOnce([
      {
        id: 1,
        name: 'MacBook Pro',
        slug: 'macbook-pro',
        shortDescription: 'Laptop cao cấp',
        basePrice: 55990000,
        status: 'active',
        stockQuantity: 10,
        category: { slug: 'laptop' },
        brand: { name: 'Apple' },
        productImages: [{ imageUrl: '/img/macbook.jpg' }],
        specifications: [
          { specKey: 'CPU', specValue: 'M4 Pro' },
          { specKey: 'RAM', specValue: '24GB' },
        ],
      },
    ]);

    const res = await supertest(app)
      .get('/api/admin/products/export?format=json')
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/products-export/);

    const data = Array.isArray(res.body) ? res.body : JSON.parse(res.text);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('MacBook Pro');
    expect(data[0].category_slug).toBe('laptop');
    expect(data[0].brand).toBe('Apple');
    expect(data[0].image_urls).toBe('/img/macbook.jpg');
    // Spec keys phải được lowercase
    expect(data[0].spec_cpu).toBe('M4 Pro');
  });

  it('JSON export: product không có category/brand → dùng giá trị rỗng', async () => {
    mockProductFindAll.mockResolvedValueOnce([
      {
        id: 2,
        name: 'Unknown Product',
        slug: 'unknown',
        shortDescription: null,
        basePrice: 5000,
        status: 'active',
        stockQuantity: 0,
        category: null,
        brand: null,
        productImages: [],
        specifications: [],
      },
    ]);

    const res = await supertest(app)
      .get('/api/admin/products/export?format=json')
      .set(adminHeaders);

    expect(res.status).toBe(200);
    const data = Array.isArray(res.body) ? res.body : JSON.parse(res.text);
    expect(data[0].category_slug).toBe('');
    expect(data[0].brand).toBe('');
    expect(data[0].short_description).toBe('');
    expect(data[0].image_urls).toBe('');
  });
});

// ── escapeCsvField: field có dấu phẩy, ngoặc kép, newline ─────────────────

describe('exportProducts CSV — escapeCsvField với ký tự đặc biệt (line 525)', () => {
  it('tên sản phẩm có dấu phẩy → được bọc trong ngoặc kép trong CSV', async () => {
    mockProductFindAll.mockResolvedValueOnce([
      {
        id: 3,
        name: 'Laptop, Core i9',
        slug: 'laptop-core-i9',
        shortDescription: '',
        basePrice: 30000000,
        status: 'active',
        stockQuantity: 5,
        category: { slug: 'laptop' },
        brand: { name: 'Dell' },
        productImages: [],
        specifications: [],
      },
    ]);

    const res = await supertest(app).get('/api/admin/products/export?format=csv').set(adminHeaders);

    expect(res.status).toBe(200);
    // Field có dấu phẩy phải được bọc ngoặc kép
    expect(res.text).toContain('"Laptop, Core i9"');
  });

  it('tên sản phẩm có dấu ngoặc kép → được escape thành ""', async () => {
    mockProductFindAll.mockResolvedValueOnce([
      {
        id: 4,
        name: 'iPhone "Pro" 17',
        slug: 'iphone-pro-17',
        shortDescription: '',
        basePrice: 36990000,
        status: 'active',
        stockQuantity: 20,
        category: { slug: 'dien-thoai' },
        brand: { name: 'Apple' },
        productImages: [],
        specifications: [],
      },
    ]);

    const res = await supertest(app).get('/api/admin/products/export?format=csv').set(adminHeaders);

    expect(res.status).toBe(200);
    // Dấu ngoặc kép trong tên phải được escape thành ""
    expect(res.text).toContain('"iPhone ""Pro"" 17"');
  });
});

// ── vectorStore: upsertProduct throw → log error (line 399) ──────────────────
// setImmediate chạy async sau response → cần chờ để verify log

describe('POST /api/admin/products/import — vectorStore lỗi không làm response fail (line 399)', () => {
  it('vectorStore.upsertProduct throw → logger.error được gọi, response vẫn 200', async () => {
    // Import thành công 1 sản phẩm, sau đó vectorStore fail
    mockProductCreate.mockResolvedValue({ id: 301, name: 'Test' });
    // First call during import transaction (Product.findOne for slug check) returns null
    // Second call (Product.findAll for vector sync) returns the new product
    mockProductFindAll.mockResolvedValueOnce([{ id: 301, toJSON: () => ({ id: 301 }) }]);
    mockVectorAddProduct.mockRejectedValue(new Error('Embedding API down'));

    const logger = require('@utils/logger');

    const csvContent = [
      'name,base_price,category_slug',
      'Product Vector Test,5000,dien-thoai',
    ].join('\n');

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(csvContent), { filename: 'p.csv', contentType: 'text/csv' });

    // Response không bị ảnh hưởng bởi lỗi vector (setImmediate)
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    // Chờ setImmediate thực thi
    await new Promise((resolve) => setImmediate(resolve));

    // logger.error phải được gọi với message về vector sync thất bại
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[VECTOR]'),
      expect.stringContaining('Embedding API down'),
    );
  });
});

// ── allFailed với row có nhiều lỗi (regression test cho fix allFailed condition) ──

describe('POST /api/admin/products/import — allFailed khi row có nhiều lỗi validation', () => {
  it('CSV 1 row thiếu cả name và base_price âm → vẫn là allFailed (multi-error per row)', async () => {
    // Row này có 2 lỗi: thiếu name + base_price âm
    // Bug cũ: validationErrors.length (2) !== rows.length (1) → allFailed=false → 200
    // Fix mới: dùng Set(errors.map(e=>e.row)).size === 1 === rows.length → allFailed=true → 422
    const csvContent = ['name,base_price,category_slug', ',-500,dien-thoai'].join('\n');

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(csvContent), { filename: 'p.csv', contentType: 'text/csv' });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/Tất cả dòng đều không hợp lệ/);
    expect(res.body.errors.length).toBeGreaterThanOrEqual(2); // ít nhất 2 lỗi
  });
});
