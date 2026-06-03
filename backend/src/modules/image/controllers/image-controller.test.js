/**
 * Tests cho image controller (src/controllers/image.js)
 *
 * Chiến lược:
 * - Mock '@modules/image/services/image-service' để tránh I/O thực trên disk
 * - Mock 'multer' để kiểm soát hành vi upload (success / lỗi Multer)
 * - Test healthCheck, getImageById, getImagesByProductId, deleteImage,
 *   convertBase64, cleanupOrphanedFiles, uploadSingle, uploadMultiple
 *
 * Bao gồm:
 * - GET  /api/images/health — health check
 * - GET  /api/images/:id — lấy ảnh theo ID
 * - GET  /api/images/product/:productId — lấy ảnh theo sản phẩm
 * - DELETE /api/images/:id — xóa ảnh
 * - POST /api/images/convert/base64 — chuyển base64
 * - POST /api/images/admin/cleanup — dọn dẹp file mồ côi
 * - POST /api/images/test-upload — upload 1 ảnh (route không cần auth để test)
 * - POST /api/images/upload-multiple (via controller trực tiếp)
 */

process.env.NODE_ENV = 'test';

// ---------- Mocks ----------

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('@middlewares/rate-limiter', () => ({
  apiLimiter: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/admin-auth', () => ({
  requireSuperAdmin: (_req, _res, next) => next(),
  requireRole: () => (_req, _res, next) => next(),
  adminAuthenticate: (_req, _res, next) => next(),
}));

// Mock imageService — tất cả operations trên DB / disk
// Dùng tên mock* để Jest hoisting cho phép truy cập trước khai báo
const mockUploadImage = jest.fn();
const mockUploadMultipleImages = jest.fn();
const mockGetImageById = jest.fn();
const mockGetImagesByProductId = jest.fn();
const mockDeleteImage = jest.fn();
const mockConvertBase64ToFile = jest.fn();
const mockCleanupOrphanedFiles = jest.fn();

jest.mock('@modules/image/services/image-service', () => ({
  uploadImage: (...args) => mockUploadImage(...args),
  uploadMultipleImages: (...args) => mockUploadMultipleImages(...args),
  getImageById: (...args) => mockGetImageById(...args),
  getImagesByProductId: (...args) => mockGetImagesByProductId(...args),
  deleteImage: (...args) => mockDeleteImage(...args),
  convertBase64ToFile: (...args) => mockConvertBase64ToFile(...args),
  cleanupOrphanedFiles: (...args) => mockCleanupOrphanedFiles(...args),
}));

// Multer mock: state object prefixed với 'mock' để Jest hoisting cho phép truy cập.
// Dùng object thay vì primitive để truyền by reference qua closure.
const mockMulterState = {
  singleBehavior: 'success',
  arrayBehavior: 'success',
};

jest.mock('multer', () => {
  // Tham chiếu đến state thông qua require — tránh lỗi "out-of-scope variable"
  // jest.requireActual và global.__mockMulterState được truy cập bên trong factory
  const { MulterError } = jest.requireActual('multer');

  const buildSingleMiddleware = () => (req, _res, cb) => {
    // Đọc state qua global để tránh closure scope issue
    const behavior = global.__mockMulterSingleBehavior || 'success';
    if (behavior === 'success') {
      req.file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        path: '/tmp/temp_uuid.jpg',
        filename: 'temp_uuid.jpg',
        size: 102400,
      };
      cb(null);
    } else if (behavior === 'noFile') {
      cb(null); // không set req.file → controller trả 400
    } else if (behavior === 'limitFileSize') {
      cb(new MulterError('LIMIT_FILE_SIZE'));
    } else {
      cb(new MulterError('LIMIT_UNEXPECTED_FILE'));
    }
  };

  const buildArrayMiddleware = () => (req, _res, cb) => {
    const behavior = global.__mockMulterArrayBehavior || 'success';
    if (behavior === 'success') {
      req.files = [
        {
          originalname: 'photo1.jpg',
          mimetype: 'image/jpeg',
          path: '/tmp/t1.jpg',
          filename: 't1.jpg',
          size: 102400,
        },
        {
          originalname: 'photo2.jpg',
          mimetype: 'image/jpeg',
          path: '/tmp/t2.jpg',
          filename: 't2.jpg',
          size: 204800,
        },
      ];
      cb(null);
    } else if (behavior === 'noFiles') {
      req.files = [];
      cb(null);
    } else if (behavior === 'limitFileSize') {
      cb(new MulterError('LIMIT_FILE_SIZE'));
    } else if (behavior === 'limitFileCount') {
      cb(new MulterError('LIMIT_FILE_COUNT'));
    } else {
      cb(new MulterError('LIMIT_UNEXPECTED_FILE'));
    }
  };

  const factory = jest.fn(() => ({
    single: buildSingleMiddleware,
    array: buildArrayMiddleware,
  }));
  factory.diskStorage = jest.fn(() => ({}));
  factory.MulterError = MulterError;
  return factory;
});

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const imageRouter = require('@modules/image/routes');
const { errorHandler } = require('@middlewares/error-handler');

const app = express();
app.use(express.json());
app.use('/api/images', imageRouter);
app.use(errorHandler);

const request = supertest(app);

// ---------- Helpers ----------

function setMulterSingle(behavior) {
  global.__mockMulterSingleBehavior = behavior;
}

function setMulterArray(behavior) {
  global.__mockMulterArrayBehavior = behavior;
}

function makeImageRecord(overrides = {}) {
  const base = {
    id: 'img-uuid-1',
    originalName: 'photo.jpg',
    fileName: 'uuid-photo.jpg',
    filePath: 'images/products/2024/01/uuid-photo.jpg',
    fileSize: 102400,
    mimeType: 'image/jpeg',
    category: 'product',
    toJSON: jest.fn().mockReturnValue({
      id: 'img-uuid-1',
      originalName: 'photo.jpg',
      filePath: 'images/products/2024/01/uuid-photo.jpg',
    }),
  };
  return { ...base, ...overrides };
}

// ============================================================
// GET /api/images/health — healthCheck
// ============================================================

describe('GET /api/images/health — healthCheck', () => {
  test('trả về 200 với status success và timestamp', async () => {
    const res = await request.get('/api/images/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/đang hoạt động bình thường/);
    expect(res.body.data).toHaveProperty('timestamp');
    expect(res.body.data.version).toBe('1.0.0');
  });

  test('timestamp trong response là ISO string hợp lệ', async () => {
    const res = await request.get('/api/images/health');

    const ts = new Date(res.body.data.timestamp);
    expect(ts.toString()).not.toBe('Invalid Date');
  });
});

// ============================================================
// GET /api/images/:id — getImageById
// ============================================================

describe('GET /api/images/:id — getImageById', () => {
  beforeEach(() => jest.clearAllMocks());

  test('trả về ảnh kèm url khi ID hợp lệ', async () => {
    const image = makeImageRecord();
    mockGetImageById.mockResolvedValue(image);

    const res = await request.get('/api/images/img-uuid-1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.url).toBe('/uploads/images/products/2024/01/uuid-photo.jpg');
    expect(mockGetImageById).toHaveBeenCalledWith('img-uuid-1');
  });

  test('truyền lỗi 404 vào errorHandler khi ảnh không tồn tại', async () => {
    const AppError = require('@shared/errors/app-error');
    mockGetImageById.mockRejectedValue(new AppError('Không tìm thấy ảnh', 404));

    const res = await request.get('/api/images/nonexistent-id');

    expect([404, 500]).toContain(res.status);
  });

  test('truyền lỗi 500 vào errorHandler khi DB throw', async () => {
    mockGetImageById.mockRejectedValue(new Error('DB connection lost'));

    const res = await request.get('/api/images/img-uuid-1');

    expect(res.status).toBe(500);
  });
});

// ============================================================
// GET /api/images/product/:productId — getImagesByProductId
// ============================================================

describe('GET /api/images/product/:productId — getImagesByProductId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('trả về danh sách ảnh kèm url và count', async () => {
    const images = [
      makeImageRecord(),
      makeImageRecord({ id: 'img-uuid-2', fileName: 'uuid2.jpg' }),
    ];
    mockGetImagesByProductId.mockResolvedValue(images);

    const res = await request.get('/api/images/product/prod-uuid-1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.count).toBe(2);
    expect(res.body.data.images).toHaveLength(2);
    expect(res.body.data.images[0].url).toBeDefined();
    expect(mockGetImagesByProductId).toHaveBeenCalledWith('prod-uuid-1');
  });

  test('trả về danh sách rỗng khi sản phẩm không có ảnh', async () => {
    mockGetImagesByProductId.mockResolvedValue([]);

    const res = await request.get('/api/images/product/prod-empty');

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
    expect(res.body.data.images).toEqual([]);
  });

  test('truyền lỗi vào errorHandler khi service throw', async () => {
    mockGetImagesByProductId.mockRejectedValue(new Error('DB error'));

    const res = await request.get('/api/images/product/prod-uuid-1');

    expect(res.status).toBe(500);
  });
});

// ============================================================
// DELETE /api/images/:id — deleteImage
// ============================================================

describe('DELETE /api/images/:id — deleteImage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('xóa ảnh thành công → 200 với message', async () => {
    mockDeleteImage.mockResolvedValue(undefined);

    const res = await request.delete('/api/images/img-uuid-1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/Ảnh đã được xóa thành công/);
    expect(mockDeleteImage).toHaveBeenCalledWith('img-uuid-1');
  });

  test('truyền lỗi vào errorHandler khi ảnh không tồn tại', async () => {
    const AppError = require('@shared/errors/app-error');
    mockDeleteImage.mockRejectedValue(new AppError('Không tìm thấy ảnh', 404));

    const res = await request.delete('/api/images/nonexistent');

    expect([404, 500]).toContain(res.status);
  });
});

// ============================================================
// POST /api/images/convert/base64 — convertBase64
// ============================================================

describe('POST /api/images/convert/base64 — convertBase64', () => {
  beforeEach(() => jest.clearAllMocks());

  test('chuyển đổi base64 thành công → 200', async () => {
    const result = makeImageRecord();
    mockConvertBase64ToFile.mockResolvedValue(result);

    const res = await request.post('/api/images/convert/base64').send({
      base64Data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgAB',
      category: 'product',
      productId: 'prod-uuid-1',
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/Đã chuyển đổi base64 sang file thành công/);
    expect(mockConvertBase64ToFile).toHaveBeenCalledWith(
      'data:image/jpeg;base64,/9j/4AAQSkZJRgAB',
      expect.objectContaining({ category: 'product', productId: 'prod-uuid-1' }),
    );
  });

  test('trả về 400 khi thiếu base64Data', async () => {
    const res = await request.post('/api/images/convert/base64').send({ category: 'product' });

    expect(res.status).toBe(400);
    expect(mockConvertBase64ToFile).not.toHaveBeenCalled();
  });

  test('userId lấy từ req.user.id khi đã xác thực', async () => {
    mockConvertBase64ToFile.mockResolvedValue(makeImageRecord());

    await request.post('/api/images/convert/base64').send({
      base64Data: 'data:image/png;base64,abc123',
    });

    expect(mockConvertBase64ToFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ userId: 1 }),
    );
  });

  test('dùng category mặc định là "product" khi không truyền', async () => {
    mockConvertBase64ToFile.mockResolvedValue(makeImageRecord());

    await request.post('/api/images/convert/base64').send({
      base64Data: 'data:image/png;base64,abc123',
    });

    expect(mockConvertBase64ToFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ category: 'product' }),
    );
  });

  test('truyền lỗi vào errorHandler khi service throw', async () => {
    mockConvertBase64ToFile.mockRejectedValue(new Error('Invalid base64'));

    const res = await request.post('/api/images/convert/base64').send({
      base64Data: 'invalid-base64',
    });

    expect(res.status).toBe(500);
  });
});

// ============================================================
// POST /api/images/admin/cleanup — cleanupOrphanedFiles
// ============================================================

describe('POST /api/images/admin/cleanup — cleanupOrphanedFiles', () => {
  beforeEach(() => jest.clearAllMocks());

  test('dọn dẹp thành công → 200 kèm data kết quả', async () => {
    const cleanupResult = { totalFiles: 100, activeFiles: 95, orphanedFiles: 5, deletedFiles: 5 };
    mockCleanupOrphanedFiles.mockResolvedValue(cleanupResult);

    const res = await request.post('/api/images/admin/cleanup');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toEqual(cleanupResult);
    expect(mockCleanupOrphanedFiles).toHaveBeenCalledTimes(1);
  });

  test('truyền lỗi vào errorHandler khi service throw', async () => {
    mockCleanupOrphanedFiles.mockRejectedValue(new Error('Cleanup failed'));

    const res = await request.post('/api/images/admin/cleanup');

    expect(res.status).toBe(500);
  });
});

// ============================================================
// POST /api/images/test-upload — uploadSingle (route không cần auth)
// ============================================================

describe('POST /api/images/test-upload — uploadSingle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMulterSingle('success');
  });

  afterEach(() => {
    setMulterSingle('success');
  });

  test('upload thành công → 200 với data ảnh', async () => {
    const uploadResult = makeImageRecord();
    mockUploadImage.mockResolvedValue(uploadResult);

    const res = await request
      .post('/api/images/test-upload')
      .attach('image', Buffer.from('fake-image-bytes'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toMatch(/Ảnh đã được upload thành công/);
    expect(mockUploadImage).toHaveBeenCalledTimes(1);
    expect(mockUploadImage).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: 'photo.jpg' }),
      expect.objectContaining({ category: 'product' }),
    );
  });

  test('400 khi không có file trong request', async () => {
    setMulterSingle('noFile');

    const res = await request.post('/api/images/test-upload').send({});

    expect(res.status).toBe(400);
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  test('400 khi multer báo lỗi LIMIT_FILE_SIZE', async () => {
    setMulterSingle('limitFileSize');

    // Gửi buffer nhỏ — behaviour được kiểm soát bởi state, không phải kích thước thực
    const res = await request
      .post('/api/images/test-upload')
      .attach('image', Buffer.from('small-bytes'), {
        filename: 'big.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  test('400 khi multer báo MulterError khác', async () => {
    setMulterSingle('other');

    const res = await request
      .post('/api/images/test-upload')
      .attach('image', Buffer.from('bytes'), {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
  });

  test('truyền lỗi vào errorHandler khi imageService.uploadImage throw', async () => {
    setMulterSingle('success');
    mockUploadImage.mockRejectedValue(new Error('S3 upload failed'));

    const res = await request
      .post('/api/images/test-upload')
      .attach('image', Buffer.from('bytes'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(500);
  });

  test('dùng category từ body khi được truyền — test qua controller trực tiếp', async () => {
    // req.body không được parse từ multipart/form-data khi multer bị mock hoàn toàn.
    // Gọi controller trực tiếp để kiểm tra logic đọc req.body.category.
    setMulterSingle('success');
    mockUploadImage.mockResolvedValue(makeImageRecord());

    const ctrl = require('./image-controller');
    const fakeRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const fakeNext = jest.fn();
    const fakeReq = {
      body: { category: 'user', productId: 'prod-1' },
      user: { id: 1 },
      headers: {},
    };

    await ctrl.uploadSingle(fakeReq, fakeRes, fakeNext);

    expect(mockUploadImage).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ category: 'user', productId: 'prod-1' }),
    );
  });
});

// ============================================================
// uploadMultiple — controller logic trực tiếp
// ============================================================

describe('uploadMultiple — logic controller', () => {
  let imageController;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    setMulterArray('success');
    // Load controller sau khi mock đã sẵn sàng
    jest.resetModules();
    // Re-mock sau resetModules
    jest.mock('@modules/image/services/image-service', () => ({
      uploadImage: (...args) => mockUploadImage(...args),
      uploadMultipleImages: (...args) => mockUploadMultipleImages(...args),
      getImageById: (...args) => mockGetImageById(...args),
      getImagesByProductId: (...args) => mockGetImagesByProductId(...args),
      deleteImage: (...args) => mockDeleteImage(...args),
      convertBase64ToFile: (...args) => mockConvertBase64ToFile(...args),
      cleanupOrphanedFiles: (...args) => mockCleanupOrphanedFiles(...args),
    }));
    imageController = require('./image-controller');
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    setMulterArray('success');
  });

  test('upload nhiều ảnh thành công → gọi res.json với status success', async () => {
    const multiResult = {
      successful: [makeImageRecord(), makeImageRecord({ id: 'img-2' })],
      failed: [],
      count: { total: 2, successful: 2, failed: 0 },
    };
    mockUploadMultipleImages.mockResolvedValue(multiResult);

    const req = {
      body: { category: 'product', productId: null },
      user: { id: 1 },
      headers: {},
    };

    await imageController.uploadMultiple(req, mockRes, mockNext);

    expect(mockUploadMultipleImages).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ originalname: 'photo1.jpg' })]),
      expect.objectContaining({ category: 'product' }),
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });

  test('400 khi không có files trong request', async () => {
    setMulterArray('noFiles');

    const req = { body: {}, user: { id: 1 }, headers: {} };

    await imageController.uploadMultiple(req, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(mockUploadMultipleImages).not.toHaveBeenCalled();
  });

  test('400 khi multer báo lỗi LIMIT_FILE_SIZE', async () => {
    setMulterArray('limitFileSize');

    const req = { body: {}, user: { id: 1 }, headers: {} };

    await imageController.uploadMultiple(req, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  test('400 khi multer báo lỗi LIMIT_FILE_COUNT', async () => {
    setMulterArray('limitFileCount');

    const req = { body: {}, user: { id: 1 }, headers: {} };

    await imageController.uploadMultiple(req, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  test('message upload chứa số lượng ảnh thành công', async () => {
    setMulterArray('success');
    const multiResult = {
      successful: [makeImageRecord()],
      failed: [],
      count: { total: 2, successful: 1, failed: 1 },
    };
    mockUploadMultipleImages.mockResolvedValue(multiResult);

    const req = { body: {}, user: { id: 1 }, headers: {} };
    await imageController.uploadMultiple(req, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('1') }),
    );
  });
});

// ============================================================
// MUTATION-KILL — message cụ thể + options + url shape
// ============================================================

describe('mutation-kill: controller messages + options + url', () => {
  let ctrl;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    setMulterSingle('success');
    setMulterArray('success');
    jest.resetModules();
    jest.mock('@modules/image/services/image-service', () => ({
      uploadImage: (...args) => mockUploadImage(...args),
      uploadMultipleImages: (...args) => mockUploadMultipleImages(...args),
      getImageById: (...args) => mockGetImageById(...args),
      getImagesByProductId: (...args) => mockGetImagesByProductId(...args),
      deleteImage: (...args) => mockDeleteImage(...args),
      convertBase64ToFile: (...args) => mockConvertBase64ToFile(...args),
      cleanupOrphanedFiles: (...args) => mockCleanupOrphanedFiles(...args),
    }));
    ctrl = require('./image-controller');
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });
  afterEach(() => {
    setMulterSingle('success');
    setMulterArray('success');
  });

  // ── uploadSingle ──
  test('uploadSingle success → options + message "Ảnh đã được upload thành công"', async () => {
    mockUploadImage.mockResolvedValue({ id: 1 });
    const req = {
      body: { category: 'user', productId: 'p1', generateThumbs: 'false', optimize: 'false' },
      user: { id: 5 },
      headers: {},
    };

    await ctrl.uploadSingle(req, res, next);

    expect(mockUploadImage).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: 'photo.jpg' }),
      { category: 'user', productId: 'p1', userId: 5, generateThumbs: false, optimize: false },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Ảnh đã được upload thành công', data: { id: 1 } }),
    );
  });

  test('uploadSingle body rỗng → options mặc định (product/null/null/true/true)', async () => {
    mockUploadImage.mockResolvedValue({ id: 1 });
    const req = { body: {}, headers: {} }; // không user → userId null

    await ctrl.uploadSingle(req, res, next);

    expect(mockUploadImage).toHaveBeenCalledWith(expect.any(Object), {
      category: 'product',
      productId: null,
      userId: null,
      generateThumbs: true,
      optimize: true,
    });
  });

  test('uploadSingle LIMIT_FILE_SIZE → next("File quá lớn. Kích thước tối đa là 10MB")', async () => {
    setMulterSingle('limitFileSize');
    await ctrl.uploadSingle({ body: {}, headers: {} }, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'File quá lớn. Kích thước tối đa là 10MB',
        statusCode: 400,
      }),
    );
  });

  test('uploadSingle MulterError khác → next("Lỗi upload: ...")', async () => {
    setMulterSingle('other'); // LIMIT_UNEXPECTED_FILE
    await ctrl.uploadSingle({ body: {}, headers: {} }, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Lỗi upload:'), statusCode: 400 }),
    );
  });

  test('uploadSingle noFile → next("Không có file nào được upload")', async () => {
    setMulterSingle('noFile');
    await ctrl.uploadSingle({ body: {}, headers: {} }, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Không có file nào được upload', statusCode: 400 }),
    );
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  // ── uploadMultiple ──
  test('uploadMultiple LIMIT_FILE_SIZE → message "File quá lớn..."', async () => {
    setMulterArray('limitFileSize');
    await ctrl.uploadMultiple({ body: {}, user: { id: 1 }, headers: {} }, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'File quá lớn. Kích thước tối đa là 10MB' }),
    );
  });

  test('uploadMultiple LIMIT_FILE_COUNT → message "Quá nhiều file. Tối đa là 10 file"', async () => {
    setMulterArray('limitFileCount');
    await ctrl.uploadMultiple({ body: {}, user: { id: 1 }, headers: {} }, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Quá nhiều file. Tối đa là 10 file' }),
    );
  });

  test('uploadMultiple MulterError khác → message "Lỗi upload: ..."', async () => {
    setMulterArray('other');
    await ctrl.uploadMultiple({ body: {}, user: { id: 1 }, headers: {} }, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Lỗi upload:') }),
    );
  });

  test('uploadMultiple noFiles → message "Không có file nào được upload"', async () => {
    setMulterArray('noFiles');
    await ctrl.uploadMultiple({ body: {}, user: { id: 1 }, headers: {} }, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Không có file nào được upload' }),
    );
  });

  test('uploadMultiple success → message "{n} ảnh đã được upload thành công" + options', async () => {
    mockUploadMultipleImages.mockResolvedValue({
      successful: [{ id: 1 }, { id: 2 }],
      failed: [],
      count: { total: 2, successful: 2, failed: 0 },
    });
    const req = { body: { category: 'review' }, user: { id: 8 }, headers: {} };

    await ctrl.uploadMultiple(req, res, next);

    expect(mockUploadMultipleImages).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ category: 'review', userId: 8 }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '2 ảnh đã được upload thành công' }),
    );
  });

  test('uploadMultiple options ĐẦY ĐỦ (category/productId/generateThumbs/optimize) (kill L67/68/70/71)', async () => {
    mockUploadMultipleImages.mockResolvedValue({
      successful: [],
      failed: [],
      count: { successful: 0 },
    });
    const req = {
      body: { category: 'user', productId: 'p9', generateThumbs: 'false', optimize: 'false' },
      user: { id: 4 },
      headers: {},
    };

    await ctrl.uploadMultiple(req, res, next);

    expect(mockUploadMultipleImages).toHaveBeenCalledWith(expect.any(Array), {
      category: 'user',
      productId: 'p9',
      userId: 4,
      generateThumbs: false,
      optimize: false,
    });
  });

  test('uploadMultiple options MẶC ĐỊNH (product/null/true/true) khi body rỗng', async () => {
    mockUploadMultipleImages.mockResolvedValue({
      successful: [],
      failed: [],
      count: { successful: 0 },
    });
    const req = { body: {}, headers: {} }; // không user → userId null

    await ctrl.uploadMultiple(req, res, next);

    expect(mockUploadMultipleImages).toHaveBeenCalledWith(expect.any(Array), {
      category: 'product',
      productId: null,
      userId: null,
      generateThumbs: true,
      optimize: true,
    });
  });

  // ── convertBase64 + cleanup + getImagesByProductId ──
  test('convertBase64 thiếu base64Data → next("base64Data là bắt buộc")', async () => {
    await ctrl.convertBase64({ body: {}, headers: {} }, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'base64Data là bắt buộc', statusCode: 400 }),
    );
    expect(mockConvertBase64ToFile).not.toHaveBeenCalled();
  });

  test('convertBase64 hợp lệ → service(options) + message', async () => {
    mockConvertBase64ToFile.mockResolvedValue({ id: 1 });
    const req = {
      body: { base64Data: 'data:image/png;base64,x', category: 'user' },
      user: { id: 3 },
      headers: {},
    };

    await ctrl.convertBase64(req, res, next);

    expect(mockConvertBase64ToFile).toHaveBeenCalledWith('data:image/png;base64,x', {
      category: 'user',
      productId: null,
      userId: 3,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Đã chuyển đổi base64 sang file thành công' }),
    );
  });

  test('cleanupOrphanedFiles → message "Đã dọn dẹp..." + data', async () => {
    mockCleanupOrphanedFiles.mockResolvedValue({ deletedFiles: 3 });
    await ctrl.cleanupOrphanedFiles({ headers: {} }, res, next);

    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      message: 'Đã dọn dẹp các file không còn được tham chiếu thành công',
      data: { deletedFiles: 3 },
    });
  });

  test('getImagesByProductId → mỗi ảnh có url /uploads/{filePath} + count', async () => {
    mockGetImagesByProductId.mockResolvedValue([
      { toJSON: () => ({ id: 1 }), filePath: 'images/product/x.webp' },
      { toJSON: () => ({ id: 2 }), filePath: 'images/product/y.webp' },
    ]);
    await ctrl.getImagesByProductId({ params: { productId: 7 }, headers: {} }, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.data.count).toBe(2);
    expect(body.data.images[0].url).toBe('/uploads/images/product/x.webp');
  });
});
