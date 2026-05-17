/**
 * Tests cho warrantyPackage controller
 *
 * Bao gồm:
 * - GET  /api/warranty-packages — lấy tất cả gói (phân trang, lọc isActive)
 * - GET  /api/warranty-packages/product/:productId — lấy theo sản phẩm
 * - GET  /api/warranty-packages/:id — lấy theo ID
 * - POST /api/warranty-packages — tạo mới (admin)
 * - PUT  /api/warranty-packages/:id — cập nhật (admin)
 * - DELETE /api/warranty-packages/:id — xóa (admin)
 */

process.env.NODE_ENV = 'test';

// ---------- Mocks ----------

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../middlewares/rateLimiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
}));

jest.mock('../middlewares/adminAuth', () => ({
  adminAuthenticate: (_req, _res, next) => next(),
}));

const mockWarrantyPackageFindAndCountAll = jest.fn();
const mockWarrantyPackageFindByPk = jest.fn();
const mockWarrantyPackageCreate = jest.fn();
const mockProductFindByPk = jest.fn();
const mockProductWarrantyFindAll = jest.fn();
const mockProductWarrantyFindOne = jest.fn();

jest.mock('../models', () => ({
  WarrantyPackage: {
    findAndCountAll: (...args) => mockWarrantyPackageFindAndCountAll(...args),
    findByPk: (...args) => mockWarrantyPackageFindByPk(...args),
    create: (...args) => mockWarrantyPackageCreate(...args),
  },
  ProductWarranty: {
    findAll: (...args) => mockProductWarrantyFindAll(...args),
    findOne: (...args) => mockProductWarrantyFindOne(...args),
  },
  Product: {
    findByPk: (...args) => mockProductFindByPk(...args),
  },
}));

// express-validator: validationResult trả rỗng (pass) theo mặc định
// Một số tests sẽ override bằng mock cụ thể
jest.mock('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => true,
    array: () => [],
  })),
  body: jest.fn(() => ({
    notEmpty: jest.fn().mockReturnThis(),
    isString: jest.fn().mockReturnThis(),
  })),
  param: jest.fn(() => ({ notEmpty: jest.fn().mockReturnThis() })),
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const warrantyRouter = require('../modules/warrantyPackage/routes');
const { validationResult } = require('express-validator');

const app = express();
app.use(express.json());
app.use('/api/warranty-packages', warrantyRouter);
app.use((err, _req, res, _next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});

const request = supertest(app);

// ---------- Helpers ----------

function makeWarrantyPackage(overrides = {}) {
  const base = {
    id: 1,
    name: 'Bảo hành 12 tháng',
    description: 'Bảo hành chính hãng',
    durationMonths: 12,
    price: 500000,
    terms: 'Điều khoản bảo hành',
    coverage: 'Lỗi phần cứng',
    isActive: true,
    sortOrder: 0,
    update: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    toJSON: jest.fn().mockReturnValue({ id: 1, name: 'Bảo hành 12 tháng' }),
  };
  return { ...base, ...overrides };
}

const validCreateBody = {
  name: 'Bảo hành 24 tháng',
  description: 'Bảo hành mở rộng',
  durationMonths: 24,
  price: 1000000,
  terms: 'Điều khoản đầy đủ',
  coverage: 'Lỗi phần cứng và phần mềm',
  isActive: true,
  sortOrder: 1,
};

// ============================================================
// GET /api/warranty-packages — getAllWarrantyPackages
// ============================================================

describe('GET /api/warranty-packages — getAllWarrantyPackages', () => {
  beforeEach(() => jest.clearAllMocks());

  test('trả về danh sách có phân trang mặc định (page=1, limit=10)', async () => {
    const rows = [makeWarrantyPackage(), makeWarrantyPackage({ id: 2, name: 'Bảo hành 6 tháng' })];
    mockWarrantyPackageFindAndCountAll.mockResolvedValue({ count: 2, rows });

    const res = await request.get('/api/warranty-packages');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.warrantyPackages).toHaveLength(2);
    expect(res.body.data.pagination).toMatchObject({
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });

  test('lọc theo isActive=true khi truyền query param', async () => {
    mockWarrantyPackageFindAndCountAll.mockResolvedValue({
      count: 1,
      rows: [makeWarrantyPackage()],
    });

    await request.get('/api/warranty-packages?isActive=true');

    expect(mockWarrantyPackageFindAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
      }),
    );
  });

  test('lọc theo isActive=false khi truyền query param', async () => {
    mockWarrantyPackageFindAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await request.get('/api/warranty-packages?isActive=false');

    expect(mockWarrantyPackageFindAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: false },
      }),
    );
  });

  test('không lọc isActive khi không truyền query param', async () => {
    mockWarrantyPackageFindAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await request.get('/api/warranty-packages');

    expect(mockWarrantyPackageFindAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  test('phân trang đúng khi truyền page và limit tùy chỉnh', async () => {
    mockWarrantyPackageFindAndCountAll.mockResolvedValue({ count: 25, rows: [] });

    await request.get('/api/warranty-packages?page=3&limit=5');

    expect(mockWarrantyPackageFindAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 10, limit: 5 }),
    );
  });

  test('totalPages tính đúng khi có nhiều trang', async () => {
    mockWarrantyPackageFindAndCountAll.mockResolvedValue({ count: 25, rows: [] });

    const res = await request.get('/api/warranty-packages?limit=10');

    expect(res.body.data.pagination.totalPages).toBe(3);
  });

  test('trả về 500 khi DB throw lỗi', async () => {
    mockWarrantyPackageFindAndCountAll.mockRejectedValue(new Error('DB error'));

    const res = await request.get('/api/warranty-packages');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/Lỗi máy chủ/);
  });
});

// ============================================================
// GET /api/warranty-packages/product/:productId
// ============================================================

describe('GET /api/warranty-packages/product/:productId — getWarrantyPackagesByProduct', () => {
  beforeEach(() => jest.clearAllMocks());

  test('trả về danh sách gói bảo hành của sản phẩm kèm isDefault', async () => {
    mockProductFindByPk.mockResolvedValue({ id: 5, name: 'iPhone 15' });

    const pkg = makeWarrantyPackage();
    const productWarranties = [
      {
        warrantyPackage: pkg,
        isDefault: true,
      },
    ];
    mockProductWarrantyFindAll.mockResolvedValue(productWarranties);

    const res = await request.get('/api/warranty-packages/product/5');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.productId).toBe('5');
    expect(res.body.data.warrantyPackages).toHaveLength(1);
    expect(res.body.data.warrantyPackages[0].isDefault).toBe(true);
  });

  test('trả về 404 khi sản phẩm không tồn tại', async () => {
    mockProductFindByPk.mockResolvedValue(null);

    const res = await request.get('/api/warranty-packages/product/999');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Không tìm thấy sản phẩm/);
    expect(mockProductWarrantyFindAll).not.toHaveBeenCalled();
  });

  test('trả về 500 khi ProductWarranty.findAll throw', async () => {
    mockProductFindByPk.mockResolvedValue({ id: 5 });
    mockProductWarrantyFindAll.mockRejectedValue(new Error('Join query failed'));

    const res = await request.get('/api/warranty-packages/product/5');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });
});

// ============================================================
// GET /api/warranty-packages/:id
// ============================================================

describe('GET /api/warranty-packages/:id — getWarrantyPackageById', () => {
  beforeEach(() => jest.clearAllMocks());

  test('trả về gói bảo hành khi ID hợp lệ', async () => {
    mockWarrantyPackageFindByPk.mockResolvedValue(makeWarrantyPackage());

    const res = await request.get('/api/warranty-packages/1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });

  test('trả về 404 khi ID không tồn tại', async () => {
    mockWarrantyPackageFindByPk.mockResolvedValue(null);

    const res = await request.get('/api/warranty-packages/999');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Không tìm thấy gói bảo hành/);
  });

  test('trả về 500 khi DB throw lỗi', async () => {
    mockWarrantyPackageFindByPk.mockRejectedValue(new Error('Connection lost'));

    const res = await request.get('/api/warranty-packages/1');

    expect(res.status).toBe(500);
  });
});

// ============================================================
// POST /api/warranty-packages — createWarrantyPackage (admin)
// ============================================================

describe('POST /api/warranty-packages — createWarrantyPackage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: validation pass
    validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
  });

  test('tạo gói bảo hành thành công → 201 kèm data', async () => {
    const created = makeWarrantyPackage({ id: 2, name: 'Bảo hành 24 tháng' });
    mockWarrantyPackageCreate.mockResolvedValue(created);

    const res = await request.post('/api/warranty-packages').send(validCreateBody);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
    expect(mockWarrantyPackageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Bảo hành 24 tháng',
        durationMonths: 24,
        price: 1000000,
      }),
    );
  });

  test('trả về 400 khi validation thất bại', async () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Tên gói bảo hành là bắt buộc', param: 'name' }],
    });

    const res = await request.post('/api/warranty-packages').send({});

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/Dữ liệu không hợp lệ/);
    expect(res.body.errors).toHaveLength(1);
    expect(mockWarrantyPackageCreate).not.toHaveBeenCalled();
  });

  test('dùng isActive=true và sortOrder=0 làm default khi không truyền', async () => {
    const created = makeWarrantyPackage();
    mockWarrantyPackageCreate.mockResolvedValue(created);

    const { isActive: _ia, sortOrder: _so, ...bodyWithoutDefaults } = validCreateBody;
    await request.post('/api/warranty-packages').send(bodyWithoutDefaults);

    expect(mockWarrantyPackageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true, sortOrder: 0 }),
    );
  });

  test('trả về 500 khi DB throw lỗi', async () => {
    mockWarrantyPackageCreate.mockRejectedValue(new Error('DB write error'));

    const res = await request.post('/api/warranty-packages').send(validCreateBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Lỗi máy chủ/);
  });
});

// ============================================================
// PUT /api/warranty-packages/:id — updateWarrantyPackage (admin)
// ============================================================

describe('PUT /api/warranty-packages/:id — updateWarrantyPackage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
  });

  test('cập nhật thành công → 200 kèm data', async () => {
    const existingPkg = makeWarrantyPackage();
    mockWarrantyPackageFindByPk.mockResolvedValue(existingPkg);

    const res = await request
      .put('/api/warranty-packages/1')
      .send({ name: 'Bảo hành 12 tháng mới', price: 600000 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(existingPkg.update).toHaveBeenCalledTimes(1);
  });

  test('trả về 400 khi validation thất bại', async () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'Price phải là số', param: 'price' }],
    });

    const res = await request.put('/api/warranty-packages/1').send({ price: 'không phải số' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(mockWarrantyPackageFindByPk).not.toHaveBeenCalled();
  });

  test('trả về 404 khi gói không tồn tại', async () => {
    mockWarrantyPackageFindByPk.mockResolvedValue(null);

    const res = await request.put('/api/warranty-packages/999').send({ name: 'Test' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Không tìm thấy gói bảo hành/);
  });

  test('trả về 500 khi DB throw lỗi', async () => {
    mockWarrantyPackageFindByPk.mockRejectedValue(new Error('Lock timeout'));

    const res = await request.put('/api/warranty-packages/1').send({ name: 'Test' });

    expect(res.status).toBe(500);
  });
});

// ============================================================
// DELETE /api/warranty-packages/:id — deleteWarrantyPackage (admin)
// ============================================================

describe('DELETE /api/warranty-packages/:id — deleteWarrantyPackage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('xóa thành công khi gói không được sử dụng → 200', async () => {
    const existingPkg = makeWarrantyPackage();
    mockWarrantyPackageFindByPk.mockResolvedValue(existingPkg);
    mockProductWarrantyFindOne.mockResolvedValue(null); // chưa được dùng

    const res = await request.delete('/api/warranty-packages/1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/Xóa gói bảo hành thành công/);
    expect(existingPkg.destroy).toHaveBeenCalledTimes(1);
  });

  test('trả về 404 khi gói không tồn tại', async () => {
    mockWarrantyPackageFindByPk.mockResolvedValue(null);

    const res = await request.delete('/api/warranty-packages/999');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Không tìm thấy gói bảo hành/);
    expect(mockProductWarrantyFindOne).not.toHaveBeenCalled();
  });

  test('trả về 400 khi gói đang được sử dụng bởi sản phẩm', async () => {
    const existingPkg = makeWarrantyPackage();
    mockWarrantyPackageFindByPk.mockResolvedValue(existingPkg);
    mockProductWarrantyFindOne.mockResolvedValue({ warrantyPackageId: 1, productId: 5 });

    const res = await request.delete('/api/warranty-packages/1');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/đang được sử dụng/);
    expect(existingPkg.destroy).not.toHaveBeenCalled();
  });

  test('trả về 500 khi DB throw lỗi', async () => {
    mockWarrantyPackageFindByPk.mockRejectedValue(new Error('DB unavailable'));

    const res = await request.delete('/api/warranty-packages/1');

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Lỗi máy chủ/);
  });
});
