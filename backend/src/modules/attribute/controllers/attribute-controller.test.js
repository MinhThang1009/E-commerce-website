/**
 * Tests cho attribute controller
 * Mock service layer — controller chỉ parse request và gọi service.
 */

process.env.NODE_ENV = 'test';

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('@middlewares/rate-limiter', () => ({ apiLimiter: (_r, _s, n) => n() }));
jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
}));
jest.mock('@middlewares/authorize', () => ({ authorize: () => (_r, _s, n) => n() }));

const mockService = {
  getAttributeGroups: jest.fn(),
  getProductAttributeGroups: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  addValue: jest.fn(),
  updateValue: jest.fn(),
  deleteValue: jest.fn(),
  assignGroupToProduct: jest.fn(),
  previewProductName: jest.fn(),
  getNameAffectingAttributes: jest.fn(),
  batchGenerateNames: jest.fn(),
  generateNameRealTime: jest.fn(),
  setNameGenerator: jest.fn(),
};

jest.mock('@modules/attribute/services/attribute-service', () => mockService);

const express = require('express');
const supertest = require('supertest');
const { AppError } = require('@shared/errors');
const attributeRouter = require('@modules/attribute/routes');

const app = express();
app.use(express.json());
app.use('/api/attributes', attributeRouter);
app.use((err, _req, res, _next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});

const request = supertest(app);

beforeEach(() => jest.clearAllMocks());

// ============================================================
// GET /api/attributes/groups
// ============================================================

describe('GET /api/attributes/groups — getAttributeGroups', () => {
  test('trả về danh sách nhóm thuộc tính', async () => {
    mockService.getAttributeGroups.mockResolvedValue([{ id: 1, name: 'Màu sắc' }]);

    const res = await request.get('/api/attributes/groups');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(1);
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockService.getAttributeGroups.mockRejectedValue(new Error('DB error'));

    const res = await request.get('/api/attributes/groups');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });
});

// ============================================================
// GET /api/attributes/products/:productId/groups
// ============================================================

describe('GET /api/attributes/products/:productId/groups — getProductAttributeGroups', () => {
  test('trả về nhóm thuộc tính của sản phẩm', async () => {
    mockService.getProductAttributeGroups.mockResolvedValue([{ id: 1 }]);

    const res = await request.get('/api/attributes/products/5/groups');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('trả về 404 khi productId không tồn tại', async () => {
    mockService.getProductAttributeGroups.mockRejectedValue(
      new AppError('Không tìm thấy sản phẩm', 404),
    );

    const res = await request.get('/api/attributes/products/999/groups');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Không tìm thấy sản phẩm/);
  });
});

// ============================================================
// POST /api/attributes/groups
// ============================================================

describe('POST /api/attributes/groups — createAttributeGroup', () => {
  test('tạo nhóm thành công → 201', async () => {
    mockService.createGroup.mockResolvedValue({ id: 1, name: 'RAM' });

    const res = await request.post('/api/attributes/groups').send({ name: 'RAM', type: 'select' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/Tạo nhóm thuộc tính thành công/);
  });

  test('trả về 500 khi service throw lỗi khi tạo', async () => {
    mockService.createGroup.mockRejectedValue(new Error('DB fail'));

    const res = await request.post('/api/attributes/groups').send({ name: 'RAM' });

    expect(res.status).toBe(500);
  });
});

// ============================================================
// PUT /api/attributes/groups/:id
// ============================================================

describe('PUT /api/attributes/groups/:id — updateAttributeGroup', () => {
  test('cập nhật thành công → 200', async () => {
    mockService.updateGroup.mockResolvedValue({ id: 1, name: 'Updated' });

    const res = await request.put('/api/attributes/groups/1').send({ name: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Cập nhật nhóm thuộc tính thành công/);
  });

  test('trả về 404 khi nhóm không tồn tại', async () => {
    mockService.updateGroup.mockRejectedValue(new AppError('Không tìm thấy nhóm thuộc tính', 404));

    const res = await request.put('/api/attributes/groups/999').send({ name: 'X' });

    expect(res.status).toBe(404);
  });
});

// ============================================================
// DELETE /api/attributes/groups/:id
// ============================================================

describe('DELETE /api/attributes/groups/:id — deleteAttributeGroup', () => {
  test('xóa mềm thành công → 200', async () => {
    mockService.deleteGroup.mockResolvedValue(undefined);

    const res = await request.delete('/api/attributes/groups/1');

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Xóa nhóm thuộc tính thành công/);
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockService.deleteGroup.mockRejectedValue(new Error('Update failed'));

    const res = await request.delete('/api/attributes/groups/1');

    expect(res.status).toBe(500);
  });
});

// ============================================================
// POST /api/attributes/groups/:attributeGroupId/values
// ============================================================

describe('POST /api/attributes/groups/:attributeGroupId/values — addAttributeValue', () => {
  test('thêm giá trị thành công → 201', async () => {
    mockService.addValue.mockResolvedValue({ id: 1, name: 'Đỏ' });

    const res = await request
      .post('/api/attributes/groups/1/values')
      .send({ name: 'Đỏ', value: 'red' });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/Thêm giá trị thuộc tính thành công/);
  });

  test('affectsName mặc định false khi không truyền', async () => {
    mockService.addValue.mockResolvedValue({ id: 1 });

    await request.post('/api/attributes/groups/1/values').send({ name: 'Xanh' });

    expect(mockService.addValue).toHaveBeenCalledWith(
      expect.objectContaining({ attributeGroupId: '1' }),
    );
  });

  test('trả về 500 khi service throw lỗi khi tạo', async () => {
    mockService.addValue.mockRejectedValue(new Error('DB fail'));

    const res = await request.post('/api/attributes/groups/1/values').send({ name: 'X' });

    expect(res.status).toBe(500);
  });
});

// ============================================================
// PUT /api/attributes/values/:id
// ============================================================

describe('PUT /api/attributes/values/:id — updateAttributeValue', () => {
  test('cập nhật thành công → 200', async () => {
    mockService.updateValue.mockResolvedValue({ id: 1, name: 'Updated' });

    const res = await request.put('/api/attributes/values/1').send({ name: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Cập nhật giá trị thuộc tính thành công/);
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockService.updateValue.mockRejectedValue(new Error('fail'));

    const res = await request.put('/api/attributes/values/1').send({ name: 'X' });

    expect(res.status).toBe(500);
  });
});

// ============================================================
// DELETE /api/attributes/values/:id
// ============================================================

describe('DELETE /api/attributes/values/:id — deleteAttributeValue', () => {
  test('xóa mềm thành công → 200', async () => {
    mockService.deleteValue.mockResolvedValue(undefined);

    const res = await request.delete('/api/attributes/values/1');

    expect(res.status).toBe(200);
  });
});

// ============================================================
// POST /api/attributes/products/:productId/groups/:attributeGroupId
// ============================================================

describe('POST /api/attributes/products/:productId/groups/:attributeGroupId — assign', () => {
  test('gán thành công → 201', async () => {
    mockService.assignGroupToProduct.mockResolvedValue({ id: 1 });

    const res = await request
      .post('/api/attributes/products/5/groups/2')
      .send({ isRequired: false, sortOrder: 0 });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/Gán nhóm thuộc tính cho sản phẩm thành công/);
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockService.assignGroupToProduct.mockRejectedValue(new Error('fail'));

    const res = await request.post('/api/attributes/products/5/groups/2').send({});

    expect(res.status).toBe(500);
  });
});

// ============================================================
// POST /api/attributes/preview-name
// ============================================================

describe('POST /api/attributes/preview-name — previewProductName', () => {
  test('trả về preview tên thành công khi có baseName', async () => {
    mockService.previewProductName.mockResolvedValue({ generatedName: 'iPhone 15 Pro Đen' });

    const res = await request.post('/api/attributes/preview-name').send({
      baseName: 'iPhone 15 Pro',
      selectedAttributes: [1, 2],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.generatedName).toBe('iPhone 15 Pro Đen');
  });

  test('trả về 400 khi thiếu baseName', async () => {
    const res = await request.post('/api/attributes/preview-name').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/bắt buộc/);
    expect(mockService.previewProductName).not.toHaveBeenCalled();
  });

  test('dùng mảng rỗng khi không truyền selectedAttributes', async () => {
    mockService.previewProductName.mockResolvedValue({ generatedName: 'iPhone 15' });

    await request.post('/api/attributes/preview-name').send({ baseName: 'iPhone 15' });

    expect(mockService.previewProductName).toHaveBeenCalledWith(
      'iPhone 15',
      [],
      expect.any(Object),
    );
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockService.previewProductName.mockRejectedValue(new Error('fail'));

    const res = await request.post('/api/attributes/preview-name').send({ baseName: 'Test' });

    expect(res.status).toBe(500);
  });
});

// ============================================================
// GET /api/attributes/name-affecting
// ============================================================

describe('GET /api/attributes/name-affecting — getNameAffectingAttributes', () => {
  test('trả về danh sách thuộc tính ảnh hưởng tên khi có productId', async () => {
    mockService.getNameAffectingAttributes.mockResolvedValue([{ id: 1 }]);

    const res = await request.get('/api/attributes/name-affecting?productId=5');

    expect(res.status).toBe(200);
    expect(mockService.getNameAffectingAttributes).toHaveBeenCalledWith('5');
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockService.getNameAffectingAttributes.mockRejectedValue(new Error('fail'));

    const res = await request.get('/api/attributes/name-affecting');

    expect(res.status).toBe(500);
  });
});

// ============================================================
// POST /api/attributes/batch-generate-names
// ============================================================

describe('POST /api/attributes/batch-generate-names — batchGenerateProductNames', () => {
  test('tạo tên hàng loạt thành công → 200', async () => {
    mockService.batchGenerateNames.mockResolvedValue([{ name: 'iPhone 15 Đen' }]);

    const res = await request.post('/api/attributes/batch-generate-names').send({
      items: [{ baseName: 'iPhone 15', attributes: [1] }],
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('dùng separator mặc định khi không truyền', async () => {
    mockService.batchGenerateNames.mockResolvedValue([]);

    await request.post('/api/attributes/batch-generate-names').send({ items: [] });

    expect(mockService.batchGenerateNames).toHaveBeenCalledWith([], ' ');
  });

  test('trả về 400 khi items không phải mảng', async () => {
    const res = await request.post('/api/attributes/batch-generate-names').send({ items: 'wrong' });

    expect(res.status).toBe(400);
    expect(mockService.batchGenerateNames).not.toHaveBeenCalled();
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockService.batchGenerateNames.mockRejectedValue(new Error('fail'));

    const res = await request.post('/api/attributes/batch-generate-names').send({ items: [] });

    expect(res.status).toBe(500);
  });
});

// ============================================================
// POST /api/attributes/generate-name-realtime
// ============================================================

describe('POST /api/attributes/generate-name-realtime — generateNameRealTime', () => {
  test('tạo tên real-time thành công với attributeValues là mảng', async () => {
    mockService.generateNameRealTime.mockResolvedValue({
      generatedName: 'iPhone 15 Pro Đen 256GB',
      suggestions: [],
    });

    const res = await request.post('/api/attributes/generate-name-realtime').send({
      baseName: 'iPhone 15 Pro',
      attributeValues: [1, 2],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.generatedName).toBeDefined();
  });

  test('tạo tên real-time thành công với attributeValues là object', async () => {
    mockService.generateNameRealTime.mockResolvedValue({
      generatedName: 'MacBook Pro Bạc',
      suggestions: [],
    });

    const res = await request.post('/api/attributes/generate-name-realtime').send({
      baseName: 'MacBook Pro',
      attributeValues: { color: 1, storage: 2 },
    });

    expect(res.status).toBe(200);
  });

  test('trả về 400 khi thiếu baseName', async () => {
    const res = await request.post('/api/attributes/generate-name-realtime').send({});

    expect(res.status).toBe(400);
    expect(mockService.generateNameRealTime).not.toHaveBeenCalled();
  });

  test('lấy thêm gợi ý khi có productId', async () => {
    mockService.generateNameRealTime.mockResolvedValue({
      generatedName: 'Test',
      suggestions: [{ id: 1 }],
    });

    const res = await request.post('/api/attributes/generate-name-realtime').send({
      baseName: 'Test',
      productId: 5,
    });

    expect(res.status).toBe(200);
    expect(mockService.generateNameRealTime).toHaveBeenCalledWith('Test', undefined, 5);
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockService.generateNameRealTime.mockRejectedValue(new Error('fail'));

    const res = await request
      .post('/api/attributes/generate-name-realtime')
      .send({ baseName: 'Test' });

    expect(res.status).toBe(500);
  });
});

// ============================================================
// DELETE /api/attributes/values/:id — error path
// ============================================================

describe('DELETE /api/attributes/values/:id — deleteAttributeValue error path', () => {
  test('trả về 500 khi deleteValue throw lỗi', async () => {
    mockService.deleteValue.mockRejectedValue(new Error('DB lỗi'));

    const res = await request.delete('/api/attributes/values/1');

    expect(res.status).toBe(500);
  });
});
