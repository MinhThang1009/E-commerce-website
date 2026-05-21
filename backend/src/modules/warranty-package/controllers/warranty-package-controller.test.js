/**
 * Tests cho warrantyPackage controller
 * Mock service layer — controller chỉ parse request và gọi service.
 */

process.env.NODE_ENV = 'test';

jest.mock('@utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
jest.mock('@middlewares/rate-limiter', () => ({
  apiLimiter: (_req, _res, next) => next(),
}));
jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
}));
jest.mock('@middlewares/admin-auth', () => ({
  adminAuthenticate: (_req, _res, next) => next(),
}));

// Mock validateRequest để không chạy Joi thật trong unit test
jest.mock('@middlewares/validate-request', () => ({
  validateRequest: () => (_req, _res, next) => next(),
}));

const mockService = {
  getAll: jest.fn(),
  getByProduct: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

jest.mock('@modules/warranty-package/services/warranty-package-service', () => mockService);

const express = require('express');
const supertest = require('supertest');
const { AppError } = require('@shared/errors');
const warrantyRouter = require('@modules/warranty-package/routes');

const app = express();
app.use(express.json());
app.use('/api/warranty-packages', warrantyRouter);
app.use((err, _req, res, _next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});

const request = supertest(app);

const validCreateBody = {
  name: 'Bảo hành 24 tháng',
  durationMonths: 24,
  price: 1000000,
};

beforeEach(() => jest.clearAllMocks());

// ============================================================
// GET /api/warranty-packages
// ============================================================

describe('GET /api/warranty-packages — getAllWarrantyPackages', () => {
  test('trả về danh sách có phân trang mặc định', async () => {
    mockService.getAll.mockResolvedValue({
      warrantyPackages: [{ id: 1 }, { id: 2 }],
      pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
    });

    const res = await request.get('/api/warranty-packages');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.warrantyPackages).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(2);
  });

  test('truyền query params đúng vào service', async () => {
    mockService.getAll.mockResolvedValue({ warrantyPackages: [], pagination: {} });

    await request.get('/api/warranty-packages?page=2&limit=5&isActive=true');

    expect(mockService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: '2', limit: '5', isActive: 'true' }),
    );
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockService.getAll.mockRejectedValue(new Error('DB error'));

    const res = await request.get('/api/warranty-packages');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });
});

// ============================================================
// GET /api/warranty-packages/product/:productId
// ============================================================

describe('GET /api/warranty-packages/product/:productId', () => {
  test('trả về danh sách gói bảo hành của sản phẩm', async () => {
    mockService.getByProduct.mockResolvedValue([{ id: 1, isDefault: true }]);

    const res = await request.get('/api/warranty-packages/product/5');

    expect(res.status).toBe(200);
    expect(res.body.data.productId).toBe('5');
    expect(res.body.data.warrantyPackages).toHaveLength(1);
  });

  test('trả về 404 khi sản phẩm không tồn tại', async () => {
    mockService.getByProduct.mockRejectedValue(new AppError('Không tìm thấy sản phẩm', 404));

    const res = await request.get('/api/warranty-packages/product/999');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Không tìm thấy sản phẩm/);
  });
});

// ============================================================
// GET /api/warranty-packages/:id
// ============================================================

describe('GET /api/warranty-packages/:id — getWarrantyPackageById', () => {
  test('trả về gói bảo hành khi ID hợp lệ', async () => {
    mockService.getById.mockResolvedValue({ id: 1, name: 'Bảo hành 12 tháng' });

    const res = await request.get('/api/warranty-packages/1');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
  });

  test('trả về 404 khi ID không tồn tại', async () => {
    mockService.getById.mockRejectedValue(new AppError('Không tìm thấy gói bảo hành', 404));

    const res = await request.get('/api/warranty-packages/999');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Không tìm thấy gói bảo hành/);
  });

  test('trả về 500 khi service throw lỗi bất ngờ', async () => {
    mockService.getById.mockRejectedValue(new Error('Connection lost'));

    const res = await request.get('/api/warranty-packages/1');

    expect(res.status).toBe(500);
  });
});

// ============================================================
// POST /api/warranty-packages
// ============================================================

describe('POST /api/warranty-packages — createWarrantyPackage', () => {
  test('tạo thành công → 201 kèm data', async () => {
    mockService.create.mockResolvedValue({ id: 2, ...validCreateBody });

    const res = await request.post('/api/warranty-packages').send(validCreateBody);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(mockService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Bảo hành 24 tháng' }),
    );
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockService.create.mockRejectedValue(new Error('DB write error'));

    const res = await request.post('/api/warranty-packages').send(validCreateBody);

    expect(res.status).toBe(500);
  });
});

// ============================================================
// PUT /api/warranty-packages/:id
// ============================================================

describe('PUT /api/warranty-packages/:id — updateWarrantyPackage', () => {
  test('cập nhật thành công → 200 kèm data', async () => {
    mockService.update.mockResolvedValue({ id: 1, name: 'Updated' });

    const res = await request.put('/api/warranty-packages/1').send({ name: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(mockService.update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ name: 'Updated' }),
    );
  });

  test('trả về 404 khi gói không tồn tại', async () => {
    mockService.update.mockRejectedValue(new AppError('Không tìm thấy gói bảo hành', 404));

    const res = await request.put('/api/warranty-packages/999').send({ name: 'Test' });

    expect(res.status).toBe(404);
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockService.update.mockRejectedValue(new Error('Lock timeout'));

    const res = await request.put('/api/warranty-packages/1').send({ name: 'Test' });

    expect(res.status).toBe(500);
  });
});

// ============================================================
// DELETE /api/warranty-packages/:id
// ============================================================

describe('DELETE /api/warranty-packages/:id — deleteWarrantyPackage', () => {
  test('xóa thành công → 200', async () => {
    mockService.remove.mockResolvedValue(undefined);

    const res = await request.delete('/api/warranty-packages/1');

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Xóa gói bảo hành thành công/);
  });

  test('trả về 404 khi gói không tồn tại', async () => {
    mockService.remove.mockRejectedValue(new AppError('Không tìm thấy gói bảo hành', 404));

    const res = await request.delete('/api/warranty-packages/999');

    expect(res.status).toBe(404);
  });

  test('trả về 400 khi gói đang được sử dụng', async () => {
    mockService.remove.mockRejectedValue(
      new AppError('Không thể xóa gói bảo hành đang được sử dụng bởi sản phẩm', 400),
    );

    const res = await request.delete('/api/warranty-packages/1');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/đang được sử dụng/);
  });

  test('trả về 500 khi service throw lỗi bất ngờ', async () => {
    mockService.remove.mockRejectedValue(new Error('DB unavailable'));

    const res = await request.delete('/api/warranty-packages/1');

    expect(res.status).toBe(500);
  });
});
