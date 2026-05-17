/**
 * Tests cho attribute controller
 *
 * Bao gồm:
 * - GET  /api/attributes/groups — lấy danh sách nhóm thuộc tính
 * - GET  /api/attributes/products/:productId/groups — lấy nhóm theo sản phẩm
 * - POST /api/attributes/groups — tạo nhóm thuộc tính (admin)
 * - PUT  /api/attributes/groups/:id — cập nhật nhóm (admin)
 * - DELETE /api/attributes/groups/:id — xóa mềm nhóm (admin)
 * - POST /api/attributes/groups/:attributeGroupId/values — thêm giá trị (admin)
 * - PUT  /api/attributes/values/:id — cập nhật giá trị (admin)
 * - DELETE /api/attributes/values/:id — xóa mềm giá trị (admin)
 * - POST /api/attributes/products/:productId/groups/:attributeGroupId — gán nhóm (admin)
 * - POST /api/attributes/preview-name — xem trước tên sản phẩm
 * - GET  /api/attributes/name-affecting — lấy thuộc tính ảnh hưởng tên
 * - POST /api/attributes/batch-generate-names — tạo tên hàng loạt (admin)
 * - POST /api/attributes/generate-name-realtime — tạo tên real-time
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-attr';

// ---------- Mocks ----------

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../middlewares/rateLimiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
}));

// Bypass auth/authorize cho tất cả test
jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('../middlewares/adminAuth', () => ({
  adminAuthenticate: (_req, _res, next) => next(),
}));

// Mock tất cả models dùng trong controller
const mockAttributeGroupFindAll = jest.fn();
const mockAttributeGroupFindByPk = jest.fn();
const mockAttributeGroupCreate = jest.fn();
const mockAttributeValueFindByPk = jest.fn();
const mockAttributeValueCreate = jest.fn();
const mockProductAttributeGroupCreate = jest.fn();
const mockProductFindByPk = jest.fn();
const mockProductVariantFindAll = jest.fn();

jest.mock('../models', () => ({
  AttributeGroup: {
    findAll: (...args) => mockAttributeGroupFindAll(...args),
    findByPk: (...args) => mockAttributeGroupFindByPk(...args),
    create: (...args) => mockAttributeGroupCreate(...args),
  },
  AttributeValue: {
    findByPk: (...args) => mockAttributeValueFindByPk(...args),
    create: (...args) => mockAttributeValueCreate(...args),
  },
  ProductAttributeGroup: {
    create: (...args) => mockProductAttributeGroupCreate(...args),
  },
  Product: {
    findByPk: (...args) => mockProductFindByPk(...args),
  },
  ProductVariant: {
    findAll: (...args) => mockProductVariantFindAll(...args),
  },
}));

const mockPreviewProductName = jest.fn();
const mockGetNameAffectingAttributes = jest.fn();
const mockBatchGenerateNames = jest.fn();

jest.mock('../modules/ai/services/productNameGenerator', () => ({
  previewProductName: (...args) => mockPreviewProductName(...args),
  getNameAffectingAttributes: (...args) => mockGetNameAffectingAttributes(...args),
  batchGenerateNames: (...args) => mockBatchGenerateNames(...args),
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const attributeRouter = require('../modules/attribute/routes');
const { errorHandler } = require('../middlewares/errorHandler');

const app = express();
app.use(express.json());
app.use('/api/attributes', attributeRouter);
app.use(errorHandler);

const request = supertest(app);

// ---------- Helpers ----------

function makeAttributeGroup(overrides = {}) {
  const base = {
    id: 1,
    name: 'Màu sắc',
    description: 'Nhóm màu sắc',
    type: 'color',
    isRequired: false,
    sortOrder: 0,
    isActive: true,
    update: jest.fn().mockResolvedValue(undefined),
    toJSON: jest.fn().mockReturnValue({ id: 1, name: 'Màu sắc' }),
  };
  return { ...base, ...overrides };
}

function makeAttributeValue(overrides = {}) {
  const base = {
    id: 10,
    attributeGroupId: 1,
    name: 'Đỏ',
    value: 'red',
    colorCode: '#FF0000',
    isActive: true,
    update: jest.fn().mockResolvedValue(undefined),
    toJSON: jest.fn().mockReturnValue({ id: 10, name: 'Đỏ' }),
  };
  return { ...base, ...overrides };
}

// ============================================================
// GET /api/attributes/groups
// ============================================================

describe('GET /api/attributes/groups — getAttributeGroups', () => {
  beforeEach(() => jest.clearAllMocks());

  test('trả về danh sách nhóm thuộc tính với status success', async () => {
    const groups = [makeAttributeGroup(), makeAttributeGroup({ id: 2, name: 'Kích cỡ' })];
    mockAttributeGroupFindAll.mockResolvedValue(groups);

    const res = await request.get('/api/attributes/groups');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(2);
  });

  test('trả về mảng rỗng khi không có nhóm nào', async () => {
    mockAttributeGroupFindAll.mockResolvedValue([]);

    const res = await request.get('/api/attributes/groups');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toEqual([]);
  });

  test('trả về 500 khi DB throw lỗi', async () => {
    mockAttributeGroupFindAll.mockRejectedValue(new Error('DB connection failed'));

    const res = await request.get('/api/attributes/groups');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/Không thể lấy danh sách nhóm thuộc tính/);
  });
});

// ============================================================
// GET /api/attributes/products/:productId/groups
// ============================================================

describe('GET /api/attributes/products/:productId/groups — getProductAttributeGroups', () => {
  beforeEach(() => jest.clearAllMocks());

  test('trả về nhóm thuộc tính của sản phẩm khi productId hợp lệ', async () => {
    const attributeGroups = [makeAttributeGroup()];
    mockProductFindByPk.mockResolvedValue({ id: 5, attributeGroups });

    const res = await request.get('/api/attributes/products/5/groups');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // So sánh phần data có thể serialize (JSON không giữ jest mock functions)
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(1);
    expect(res.body.data[0].name).toBe('Màu sắc');
  });

  test('trả về 404 khi productId không tồn tại', async () => {
    mockProductFindByPk.mockResolvedValue(null);

    const res = await request.get('/api/attributes/products/999/groups');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/Không tìm thấy sản phẩm/);
  });

  test('trả về 500 khi DB throw lỗi', async () => {
    mockProductFindByPk.mockRejectedValue(new Error('Query timeout'));

    const res = await request.get('/api/attributes/products/5/groups');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });
});

// ============================================================
// POST /api/attributes/groups (admin)
// ============================================================

describe('POST /api/attributes/groups — createAttributeGroup', () => {
  beforeEach(() => jest.clearAllMocks());

  const validBody = {
    name: 'Chất liệu',
    description: 'Nhóm chất liệu sản phẩm',
    type: 'text',
    isRequired: false,
    sortOrder: 1,
  };

  test('tạo nhóm thuộc tính thành công → 201 kèm data', async () => {
    const created = makeAttributeGroup({ id: 3, name: 'Chất liệu' });
    mockAttributeGroupCreate.mockResolvedValue(created);

    const res = await request.post('/api/attributes/groups').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/Tạo nhóm thuộc tính thành công/);
    expect(mockAttributeGroupCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Chất liệu', type: 'text' }),
    );
  });

  test('trả về 500 khi DB throw lỗi khi tạo', async () => {
    mockAttributeGroupCreate.mockRejectedValue(new Error('Unique constraint violation'));

    const res = await request.post('/api/attributes/groups').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/Không thể tạo nhóm thuộc tính/);
  });
});

// ============================================================
// PUT /api/attributes/groups/:id (admin)
// ============================================================

describe('PUT /api/attributes/groups/:id — updateAttributeGroup', () => {
  beforeEach(() => jest.clearAllMocks());

  test('cập nhật thành công khi nhóm tồn tại → 200', async () => {
    const existingGroup = makeAttributeGroup();
    mockAttributeGroupFindByPk.mockResolvedValue(existingGroup);

    const res = await request
      .put('/api/attributes/groups/1')
      .send({ name: 'Màu sắc mới', isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/Cập nhật nhóm thuộc tính thành công/);
    expect(existingGroup.update).toHaveBeenCalledTimes(1);
  });

  test('trả về 404 khi nhóm không tồn tại', async () => {
    mockAttributeGroupFindByPk.mockResolvedValue(null);

    const res = await request.put('/api/attributes/groups/999').send({ name: 'Không tồn tại' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Không tìm thấy nhóm thuộc tính/);
  });

  test('trả về 500 khi DB throw lỗi khi tìm kiếm', async () => {
    mockAttributeGroupFindByPk.mockRejectedValue(new Error('DB error'));

    const res = await request.put('/api/attributes/groups/1').send({ name: 'Test' });

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });
});

// ============================================================
// DELETE /api/attributes/groups/:id (admin)
// ============================================================

describe('DELETE /api/attributes/groups/:id — deleteAttributeGroup', () => {
  beforeEach(() => jest.clearAllMocks());

  test('xóa mềm (set isActive=false) thành công → 200', async () => {
    const existingGroup = makeAttributeGroup();
    mockAttributeGroupFindByPk.mockResolvedValue(existingGroup);

    const res = await request.delete('/api/attributes/groups/1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/Xóa nhóm thuộc tính thành công/);
    // Phải gọi update với isActive: false, không phải destroy()
    expect(existingGroup.update).toHaveBeenCalledWith({ isActive: false });
  });

  test('trả về 404 khi nhóm không tồn tại', async () => {
    mockAttributeGroupFindByPk.mockResolvedValue(null);

    const res = await request.delete('/api/attributes/groups/999');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Không tìm thấy nhóm thuộc tính/);
  });

  test('trả về 500 khi attributeGroup.update throw lỗi (lines 308-309)', async () => {
    // Khi attributeGroup.update({ isActive: false }) throw → catch block (lines 307-314)
    const existingGroup = makeAttributeGroup({
      update: jest.fn().mockRejectedValue(new Error('Foreign key constraint')),
    });
    mockAttributeGroupFindByPk.mockResolvedValue(existingGroup);

    const res = await request.delete('/api/attributes/groups/1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/Không thể xóa nhóm thuộc tính/);
    expect(res.body.error).toBe('Foreign key constraint');
  });
});

// ============================================================
// POST /api/attributes/groups/:attributeGroupId/values (admin)
// ============================================================

describe('POST /api/attributes/groups/:attributeGroupId/values — addAttributeValue', () => {
  beforeEach(() => jest.clearAllMocks());

  const validValueBody = {
    name: 'Xanh lam',
    value: 'blue',
    colorCode: '#0000FF',
    priceAdjustment: 0,
    sortOrder: 1,
    affectsName: true,
    nameTemplate: '{baseName} Xanh',
  };

  test('thêm giá trị thuộc tính thành công → 201 kèm data', async () => {
    const created = makeAttributeValue({ name: 'Xanh lam', value: 'blue' });
    mockAttributeValueCreate.mockResolvedValue(created);

    const res = await request.post('/api/attributes/groups/1/values').send(validValueBody);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/Thêm giá trị thuộc tính thành công/);
    expect(mockAttributeValueCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        attributeGroupId: '1',
        name: 'Xanh lam',
        affectsName: true,
      }),
    );
  });

  test('affectsName mặc định là false khi không truyền', async () => {
    const created = makeAttributeValue();
    mockAttributeValueCreate.mockResolvedValue(created);

    const { affectsName: _af, ...bodyWithoutAffectsName } = validValueBody;
    await request.post('/api/attributes/groups/1/values').send(bodyWithoutAffectsName);

    expect(mockAttributeValueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ affectsName: false }),
    );
  });

  test('trả về 500 khi DB throw lỗi khi tạo', async () => {
    mockAttributeValueCreate.mockRejectedValue(new Error('FK constraint failed'));

    const res = await request.post('/api/attributes/groups/1/values').send(validValueBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Không thể thêm giá trị thuộc tính/);
  });
});

// ============================================================
// PUT /api/attributes/values/:id (admin)
// ============================================================

describe('PUT /api/attributes/values/:id — updateAttributeValue', () => {
  beforeEach(() => jest.clearAllMocks());

  test('cập nhật giá trị thành công → 200', async () => {
    const existingValue = makeAttributeValue();
    mockAttributeValueFindByPk.mockResolvedValue(existingValue);

    const res = await request
      .put('/api/attributes/values/10')
      .send({ name: 'Đỏ đậm', colorCode: '#CC0000', isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/Cập nhật giá trị thuộc tính thành công/);
    expect(existingValue.update).toHaveBeenCalledTimes(1);
  });

  test('trả về 404 khi giá trị không tồn tại', async () => {
    mockAttributeValueFindByPk.mockResolvedValue(null);

    const res = await request.put('/api/attributes/values/999').send({ name: 'Không tồn tại' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Không tìm thấy giá trị thuộc tính/);
  });

  test('trả về 500 khi attributeValue.update throw lỗi (lines 279-280)', async () => {
    // Khi attributeValue.update() throw → catch block (lines 278-285) được kích hoạt
    const existingValue = makeAttributeValue({
      update: jest.fn().mockRejectedValue(new Error('DB constraint failed')),
    });
    mockAttributeValueFindByPk.mockResolvedValue(existingValue);

    const res = await request.put('/api/attributes/values/10').send({ name: 'Đỏ', isActive: true });

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/Không thể cập nhật giá trị thuộc tính/);
    expect(res.body.error).toBe('DB constraint failed');
  });
});

// ============================================================
// DELETE /api/attributes/values/:id (admin)
// ============================================================

describe('DELETE /api/attributes/values/:id — deleteAttributeValue', () => {
  beforeEach(() => jest.clearAllMocks());

  test('xóa mềm giá trị thuộc tính → 200', async () => {
    const existingValue = makeAttributeValue();
    mockAttributeValueFindByPk.mockResolvedValue(existingValue);

    const res = await request.delete('/api/attributes/values/10');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/Xóa giá trị thuộc tính thành công/);
    expect(existingValue.update).toHaveBeenCalledWith({ isActive: false });
  });

  test('trả về 404 khi giá trị không tồn tại', async () => {
    mockAttributeValueFindByPk.mockResolvedValue(null);

    const res = await request.delete('/api/attributes/values/999');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Không tìm thấy giá trị thuộc tính/);
  });

  test('trả về 500 khi DB throw lỗi', async () => {
    mockAttributeValueFindByPk.mockRejectedValue(new Error('Timeout'));

    const res = await request.delete('/api/attributes/values/10');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });
});

// ============================================================
// POST /api/attributes/products/:productId/groups/:attributeGroupId (admin)
// ============================================================

describe('POST /api/attributes/products/:productId/groups/:attributeGroupId — assignAttributeGroupToProduct', () => {
  beforeEach(() => jest.clearAllMocks());

  test('gán nhóm thuộc tính cho sản phẩm thành công → 201', async () => {
    const assignment = { productId: 5, attributeGroupId: 1, isRequired: true, sortOrder: 0 };
    mockProductAttributeGroupCreate.mockResolvedValue(assignment);

    const res = await request
      .post('/api/attributes/products/5/groups/1')
      .send({ isRequired: true, sortOrder: 0 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/Gán nhóm thuộc tính cho sản phẩm thành công/);
    expect(mockProductAttributeGroupCreate).toHaveBeenCalledWith(
      expect.objectContaining({ productId: '5', attributeGroupId: '1' }),
    );
  });

  test('trả về 500 khi DB throw lỗi khi gán', async () => {
    mockProductAttributeGroupCreate.mockRejectedValue(new Error('Duplicate entry'));

    const res = await request
      .post('/api/attributes/products/5/groups/1')
      .send({ isRequired: false });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Không thể gán nhóm thuộc tính cho sản phẩm/);
  });
});

// ============================================================
// POST /api/attributes/preview-name
// ============================================================

describe('POST /api/attributes/preview-name — previewProductName', () => {
  beforeEach(() => jest.clearAllMocks());

  test('trả về preview tên thành công khi có baseName', async () => {
    const previewResult = { generatedName: 'iPhone 15 Pro Đen 256GB', parts: [] };
    mockPreviewProductName.mockResolvedValue(previewResult);

    const res = await request.post('/api/attributes/preview-name').send({
      baseName: 'iPhone 15 Pro',
      selectedAttributes: [1, 2],
      separator: ' ',
      includeDetails: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toEqual(previewResult);
    expect(mockPreviewProductName).toHaveBeenCalledWith(
      'iPhone 15 Pro',
      [1, 2],
      expect.objectContaining({ separator: ' ', includeDetails: true }),
    );
  });

  test('trả về 400 khi thiếu baseName', async () => {
    const res = await request.post('/api/attributes/preview-name').send({
      selectedAttributes: [1],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Tên cơ bản là bắt buộc/);
    expect(mockPreviewProductName).not.toHaveBeenCalled();
  });

  test('dùng mảng rỗng khi không truyền selectedAttributes', async () => {
    mockPreviewProductName.mockResolvedValue({ generatedName: 'Laptop Dell' });

    await request.post('/api/attributes/preview-name').send({ baseName: 'Laptop Dell' });

    expect(mockPreviewProductName).toHaveBeenCalledWith(
      'Laptop Dell',
      [],
      expect.objectContaining({ separator: ' ', includeDetails: false }),
    );
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockPreviewProductName.mockRejectedValue(new Error('AI service unavailable'));

    const res = await request
      .post('/api/attributes/preview-name')
      .send({ baseName: 'Test Product' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Không thể xem trước tên sản phẩm/);
  });
});

// ============================================================
// GET /api/attributes/name-affecting
// ============================================================

describe('GET /api/attributes/name-affecting — getNameAffectingAttributes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('trả về danh sách thuộc tính ảnh hưởng tên khi có productId', async () => {
    const attributes = [
      { id: 1, name: 'Màu sắc' },
      { id: 2, name: 'Dung lượng' },
    ];
    mockGetNameAffectingAttributes.mockResolvedValue(attributes);

    const res = await request.get('/api/attributes/name-affecting?productId=5');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toEqual(attributes);
    expect(mockGetNameAffectingAttributes).toHaveBeenCalledWith('5');
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockGetNameAffectingAttributes.mockRejectedValue(new Error('Service error'));

    const res = await request.get('/api/attributes/name-affecting');

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Không thể lấy thuộc tính ảnh hưởng đến tên/);
  });
});

// ============================================================
// POST /api/attributes/batch-generate-names (admin)
// ============================================================

describe('POST /api/attributes/batch-generate-names — batchGenerateProductNames', () => {
  beforeEach(() => jest.clearAllMocks());

  test('tạo tên hàng loạt thành công → 200 kèm kết quả', async () => {
    const batchResults = [
      { baseName: 'iPhone 15', generatedName: 'iPhone 15 Đen 128GB' },
      { baseName: 'iPhone 15', generatedName: 'iPhone 15 Trắng 256GB' },
    ];
    mockBatchGenerateNames.mockResolvedValue(batchResults);

    const res = await request.post('/api/attributes/batch-generate-names').send({
      items: [
        { baseName: 'iPhone 15', attributes: [1, 3] },
        { baseName: 'iPhone 15', attributes: [2, 4] },
      ],
      separator: ' ',
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toEqual(batchResults);
    expect(mockBatchGenerateNames).toHaveBeenCalledWith(expect.any(Array), ' ');
  });

  test('trả về 400 khi items không phải là mảng', async () => {
    const res = await request.post('/api/attributes/batch-generate-names').send({
      items: 'không phải mảng',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Tham số items phải là một mảng/);
    expect(mockBatchGenerateNames).not.toHaveBeenCalled();
  });

  test('trả về 400 khi không truyền items', async () => {
    const res = await request.post('/api/attributes/batch-generate-names').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Tham số items phải là một mảng/);
  });

  test('dùng separator mặc định là khoảng trắng khi không truyền', async () => {
    mockBatchGenerateNames.mockResolvedValue([]);

    await request.post('/api/attributes/batch-generate-names').send({ items: [] });

    expect(mockBatchGenerateNames).toHaveBeenCalledWith([], ' ');
  });

  test('trả về 500 khi service throw lỗi', async () => {
    mockBatchGenerateNames.mockRejectedValue(new Error('Batch processing failed'));

    const res = await request.post('/api/attributes/batch-generate-names').send({
      items: [{ baseName: 'Test' }],
    });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Không thể tạo tên sản phẩm hàng loạt/);
  });
});

// ============================================================
// POST /api/attributes/generate-name-realtime
// ============================================================

describe('POST /api/attributes/generate-name-realtime — generateNameRealTime', () => {
  beforeEach(() => jest.clearAllMocks());

  test('tạo tên real-time thành công với attributeValues là mảng', async () => {
    const preview = { generatedName: 'iPhone 15 Đen', parts: [] };
    mockPreviewProductName.mockResolvedValue(preview);

    const res = await request.post('/api/attributes/generate-name-realtime').send({
      baseName: 'iPhone 15',
      attributeValues: [1, 2],
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toMatchObject({ generatedName: 'iPhone 15 Đen' });
    expect(res.body.data).toHaveProperty('timestamp');
  });

  test('tạo tên real-time thành công với attributeValues là object', async () => {
    const preview = { generatedName: 'iPhone 15 Trắng' };
    mockPreviewProductName.mockResolvedValue(preview);

    const res = await request.post('/api/attributes/generate-name-realtime').send({
      baseName: 'iPhone 15',
      attributeValues: { color: 3, storage: null },
    });

    expect(res.status).toBe(200);
    // Object.values lọc null → chỉ giữ id 3
    expect(mockPreviewProductName).toHaveBeenCalledWith(
      'iPhone 15',
      [3],
      expect.objectContaining({ includeDetails: true }),
    );
  });

  test('trả về 400 khi thiếu baseName', async () => {
    const res = await request.post('/api/attributes/generate-name-realtime').send({
      attributeValues: [1],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Tên cơ bản là bắt buộc/);
  });

  test('lấy thêm gợi ý khi có productId', async () => {
    const preview = { generatedName: 'Laptop Dell Đen' };
    mockPreviewProductName.mockResolvedValue(preview);
    const mockVariants = [
      {
        attributeValues: [1, 2],
        displayName: 'Dell Đen 16GB',
        name: 'Laptop Dell Đen 16GB SSD',
      },
    ];
    mockProductVariantFindAll.mockResolvedValue(mockVariants);

    const res = await request.post('/api/attributes/generate-name-realtime').send({
      baseName: 'Laptop Dell',
      productId: 10,
      attributeValues: [],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toHaveLength(1);
    expect(mockProductVariantFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 10 } }),
    );
  });

  test('trả về suggestions rỗng khi ProductVariant.findAll throw', async () => {
    const preview = { generatedName: 'Test Product' };
    mockPreviewProductName.mockResolvedValue(preview);
    mockProductVariantFindAll.mockRejectedValue(new Error('Variant query failed'));

    const res = await request.post('/api/attributes/generate-name-realtime').send({
      baseName: 'Test Product',
      productId: 5,
      attributeValues: [],
    });

    // Lỗi trong getPopularAttributeCombinations được bắt nội bộ → không crash
    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toEqual([]);
  });

  test('trả về 500 khi previewProductName throw', async () => {
    mockPreviewProductName.mockRejectedValue(new Error('Service down'));

    const res = await request.post('/api/attributes/generate-name-realtime').send({
      baseName: 'Test',
      attributeValues: [],
    });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Không thể tạo tên theo thời gian thực/);
  });

  test('attributeValues không được truyền (undefined) — fallback về {} rồi lấy [] (line 453 || {} branch)', async () => {
    // Khi attributeValues là undefined/null → !Array.isArray(undefined) = true
    // → Object.values(undefined || {}) = Object.values({}) = []
    // Covers the || {} fallback branch on line 453.
    const preview = { generatedName: 'Product Only' };
    mockPreviewProductName.mockResolvedValue(preview);

    const res = await request.post('/api/attributes/generate-name-realtime').send({
      baseName: 'Product Only',
      // attributeValues không được truyền → undefined trong body
    });

    expect(res.status).toBe(200);
    // previewProductName được gọi với mảng rỗng (Object.values({}) = [])
    expect(mockPreviewProductName).toHaveBeenCalledWith(
      'Product Only',
      [],
      expect.objectContaining({ includeDetails: true }),
    );
  });

  test('attributeValues = null — fallback về {} (line 453 || {} branch)', async () => {
    const preview = { generatedName: 'Null Attrs' };
    mockPreviewProductName.mockResolvedValue(preview);

    const res = await request.post('/api/attributes/generate-name-realtime').send({
      baseName: 'Null Attrs',
      attributeValues: null,
    });

    expect(res.status).toBe(200);
    expect(mockPreviewProductName).toHaveBeenCalledWith('Null Attrs', [], expect.any(Object));
  });
});
