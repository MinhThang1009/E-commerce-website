// Unit tests cho UploadController.
// Kiểm tra: _mapMulterError, uploadSingle, uploadMultiple, deleteFile.
// Mock multer để kiểm soát middleware behavior hoàn toàn.

const multer = require('multer');
const UploadController = require('./upload-controller');
const { AppError } = require('@shared/errors');

// ─── Mocks cho edge-cases describe blocks ─────────────────────────────────────

jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
}));

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Authenticate: user thường theo mặc định, admin khi header x-test-admin có giá trị
jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user =
      req.headers['x-test-admin'] === 'true' ? { id: 1, role: 'admin' } : { id: 2, role: 'user' };
    next();
  },
  optionalAuthenticate: (req, _res, next) => {
    req.user = { id: 2, role: 'user' };
    next();
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeController(serviceOverrides = {}) {
  const uploadService = {
    processSingleUpload: jest.fn().mockResolvedValue({ url: 'https://cdn/img.jpg' }),
    processMultipleUpload: jest.fn().mockResolvedValue([{ url: 'a.jpg' }, { url: 'b.jpg' }]),
    deleteFile: jest.fn().mockResolvedValue({ message: 'Xóa file thành công' }),
    ...serviceOverrides,
  };

  // uploadEngine mock: single/array trả về middleware function
  let singleBehavior = 'success';
  let arrayBehavior = 'success';

  const uploadEngine = {
    single: jest.fn(() => (req, res, cb) => {
      if (singleBehavior === 'success') {
        req.file = { originalname: 'test.jpg', mimetype: 'image/jpeg', size: 1024 };
        cb(null);
      } else if (singleBehavior === 'limit_size') {
        const err = new multer.MulterError('LIMIT_FILE_SIZE');
        cb(err);
      } else if (singleBehavior === 'limit_count') {
        const err = new multer.MulterError('LIMIT_FILE_COUNT');
        cb(err);
      } else if (singleBehavior === 'generic_multer') {
        const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
        err.message = 'Unexpected field';
        cb(err);
      } else if (singleBehavior === 'non_multer') {
        cb(new Error('Non-multer error'));
      }
    }),
    array: jest.fn(() => (req, res, cb) => {
      if (arrayBehavior === 'success') {
        req.files = [
          { originalname: 'a.jpg', mimetype: 'image/jpeg', size: 512 },
          { originalname: 'b.jpg', mimetype: 'image/jpeg', size: 512 },
        ];
        cb(null);
      } else if (arrayBehavior === 'limit_size') {
        const err = new multer.MulterError('LIMIT_FILE_SIZE');
        cb(err);
      } else if (arrayBehavior === 'limit_count') {
        const err = new multer.MulterError('LIMIT_FILE_COUNT');
        cb(err);
      } else if (arrayBehavior === 'generic_multer') {
        const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
        err.message = 'Too many files';
        cb(err);
      } else if (arrayBehavior === 'non_multer') {
        cb(new Error('Middleware crash'));
      }
    }),
    _setSingle: (b) => {
      singleBehavior = b;
    },
    _setArray: (b) => {
      arrayBehavior = b;
    },
  };

  const controller = new UploadController({ uploadService, uploadEngine });
  return { controller, uploadService, uploadEngine };
}

function makeReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    file: undefined,
    files: undefined,
    user: { id: 1, role: 'admin' },
    ...overrides,
  };
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

// ─── _mapMulterError ──────────────────────────────────────────────────────────

describe('_mapMulterError', () => {
  const { controller } = makeController();

  it('LIMIT_FILE_SIZE → AppError 413 với message về kích thước', () => {
    const err = new multer.MulterError('LIMIT_FILE_SIZE');
    const mapped = controller._mapMulterError(err, 5);

    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped.statusCode).toBe(413);
    expect(mapped.message).toMatch(/5MB/);
  });

  it('LIMIT_FILE_COUNT → AppError 400 với maxFiles trong message', () => {
    const err = new multer.MulterError('LIMIT_FILE_COUNT');
    const mapped = controller._mapMulterError(err, 10);

    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped.statusCode).toBe(400);
    expect(mapped.message).toContain('10');
  });

  it('MulterError khác → AppError 400 với err.message', () => {
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
    err.message = 'Unexpected field';
    const mapped = controller._mapMulterError(err);

    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped.statusCode).toBe(400);
    expect(mapped.message).toContain('Unexpected field');
  });

  it('non-MulterError → trả về error gốc không thay đổi', () => {
    const original = new Error('Network error');
    const mapped = controller._mapMulterError(original);

    expect(mapped).toBe(original);
  });
});

// ─── uploadSingle ─────────────────────────────────────────────────────────────

describe('uploadSingle', () => {
  afterEach(() => jest.clearAllMocks());

  it('upload thành công → res.status(200).json với data', async () => {
    const { controller, uploadService, uploadEngine } = makeController();
    uploadEngine._setSingle('success');
    const uploadData = { url: 'https://cdn/photo.jpg', size: 1024 };
    uploadService.processSingleUpload.mockResolvedValue(uploadData);

    const req = makeReq({ params: { type: 'products' } });
    const res = makeRes();
    const next = jest.fn();

    await controller.uploadSingle(req, res, next);

    expect(uploadService.processSingleUpload).toHaveBeenCalledWith({
      file: req.file,
      uploadType: 'products',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', data: uploadData }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('uploadType mặc định là "general" khi không có params.type', async () => {
    const { controller, uploadService, uploadEngine } = makeController();
    uploadEngine._setSingle('success');
    uploadService.processSingleUpload.mockResolvedValue({ url: 'img.jpg' });

    const req = makeReq({ params: {} });
    const res = makeRes();

    await controller.uploadSingle(req, res, jest.fn());

    expect(uploadService.processSingleUpload).toHaveBeenCalledWith(
      expect.objectContaining({ uploadType: 'general' }),
    );
  });

  it('LIMIT_FILE_SIZE multer error → gọi next với AppError 413', async () => {
    const { controller, uploadEngine } = makeController();
    uploadEngine._setSingle('limit_size');

    const req = makeReq();
    const next = jest.fn();

    await controller.uploadSingle(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 413 }));
  });

  it('LIMIT_FILE_COUNT multer error → gọi next với AppError 400', async () => {
    const { controller, uploadEngine } = makeController();
    uploadEngine._setSingle('limit_count');

    const req = makeReq();
    const next = jest.fn();

    await controller.uploadSingle(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('generic multer error → gọi next với AppError 400', async () => {
    const { controller, uploadEngine } = makeController();
    uploadEngine._setSingle('generic_multer');

    const next = jest.fn();
    await controller.uploadSingle(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('non-multer error từ middleware → gọi next với error gốc', async () => {
    const { controller, uploadEngine } = makeController();
    uploadEngine._setSingle('non_multer');

    const next = jest.fn();
    await controller.uploadSingle(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('service throw → gọi next với error từ service', async () => {
    const { controller, uploadService, uploadEngine } = makeController();
    uploadEngine._setSingle('success');
    const serviceErr = new AppError('File không hợp lệ', 400);
    uploadService.processSingleUpload.mockRejectedValue(serviceErr);

    const next = jest.fn();
    await controller.uploadSingle(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(serviceErr);
  });
});

// ─── uploadMultiple ───────────────────────────────────────────────────────────

describe('uploadMultiple', () => {
  afterEach(() => jest.clearAllMocks());

  it('upload nhiều file thành công → res 200 với count và files', async () => {
    const { controller, uploadService, uploadEngine } = makeController();
    uploadEngine._setArray('success');
    const files = [{ url: 'a.jpg' }, { url: 'b.jpg' }];
    uploadService.processMultipleUpload.mockResolvedValue(files);

    const req = makeReq({ params: { type: 'reviews' } });
    const res = makeRes();
    const next = jest.fn();

    await controller.uploadMultiple(req, res, next);

    expect(uploadService.processMultipleUpload).toHaveBeenCalledWith({
      files: req.files,
      uploadType: 'reviews',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: expect.objectContaining({ count: 2, type: 'reviews' }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('uploadType=reviews → maxFiles = 5', async () => {
    const { controller, uploadEngine } = makeController();
    uploadEngine._setArray('success');

    const req = makeReq({ params: { type: 'reviews' } });
    await controller.uploadMultiple(req, makeRes(), jest.fn());

    expect(uploadEngine.array).toHaveBeenCalledWith('files', 5);
  });

  it('uploadType khác reviews → maxFiles = 10', async () => {
    const { controller, uploadEngine } = makeController();
    uploadEngine._setArray('success');

    const req = makeReq({ params: { type: 'products' } });
    await controller.uploadMultiple(req, makeRes(), jest.fn());

    expect(uploadEngine.array).toHaveBeenCalledWith('files', 10);
  });

  it('uploadType mặc định general khi không có params.type → maxFiles = 10', async () => {
    const { controller, uploadService, uploadEngine } = makeController();
    uploadEngine._setArray('success');
    uploadService.processMultipleUpload.mockResolvedValue([]);

    const req = makeReq({ params: {} });
    await controller.uploadMultiple(req, makeRes(), jest.fn());

    expect(uploadEngine.array).toHaveBeenCalledWith('files', 10);
  });

  it('LIMIT_FILE_SIZE → gọi next với AppError 413', async () => {
    const { controller, uploadEngine } = makeController();
    uploadEngine._setArray('limit_size');

    const next = jest.fn();
    await controller.uploadMultiple(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 413 }));
  });

  it('LIMIT_FILE_COUNT → gọi next với AppError 400 chứa maxFiles', async () => {
    const { controller, uploadEngine } = makeController();
    uploadEngine._setArray('limit_count');

    const next = jest.fn();
    const req = makeReq({ params: { type: 'general' } });
    await controller.uploadMultiple(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('generic multer error → gọi next với AppError 400', async () => {
    const { controller, uploadEngine } = makeController();
    uploadEngine._setArray('generic_multer');

    const next = jest.fn();
    await controller.uploadMultiple(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('non-multer error từ middleware → gọi next với error gốc', async () => {
    const { controller, uploadEngine } = makeController();
    uploadEngine._setArray('non_multer');

    const next = jest.fn();
    await controller.uploadMultiple(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('service throw → gọi next với error từ service', async () => {
    const { controller, uploadService, uploadEngine } = makeController();
    uploadEngine._setArray('success');
    const serviceErr = new AppError('Xử lý file thất bại', 500);
    uploadService.processMultipleUpload.mockRejectedValue(serviceErr);

    const next = jest.fn();
    await controller.uploadMultiple(makeReq({ params: { type: 'products' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(serviceErr);
  });
});

// ─── deleteFile ───────────────────────────────────────────────────────────────

describe('deleteFile', () => {
  afterEach(() => jest.clearAllMocks());

  it('xóa file thành công → res 200 với message', async () => {
    const { controller, uploadService } = makeController();
    uploadService.deleteFile.mockResolvedValue({
      message: 'Xóa file products/test.jpg thành công',
    });

    const req = makeReq({
      params: { type: 'products', filename: 'test.jpg' },
      user: { id: 1, role: 'admin' },
    });
    const res = makeRes();
    const next = jest.fn();

    await controller.deleteFile(req, res, next);

    expect(uploadService.deleteFile).toHaveBeenCalledWith({
      user: req.user,
      type: 'products',
      filenameRaw: 'test.jpg',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', message: expect.any(String) }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('service throw AppError 404 → gọi next với lỗi', async () => {
    const { controller, uploadService } = makeController();
    const notFound = new AppError('File không tồn tại', 404);
    uploadService.deleteFile.mockRejectedValue(notFound);

    const next = jest.fn();
    await controller.deleteFile(
      makeReq({ params: { type: 'products', filename: 'missing.jpg' } }),
      makeRes(),
      next,
    );

    expect(next).toHaveBeenCalledWith(notFound);
  });

  it('truyền đúng type và filenameRaw từ params', async () => {
    const { controller, uploadService } = makeController();
    uploadService.deleteFile.mockResolvedValue({ message: 'OK' });

    const req = makeReq({
      params: { type: 'avatars', filename: 'user-avatar.png' },
    });

    await controller.deleteFile(req, makeRes(), jest.fn());

    expect(uploadService.deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'avatars', filenameRaw: 'user-avatar.png' }),
    );
  });
});

// ─── Outer try-catch — lines 42, 63 ──────────────────────────────────────────
// Covers line 42: outer catch khi uploadEngine.single() bản thân throw
// Covers line 63: outer catch khi uploadEngine.array() bản thân throw

describe('uploadSingle — outer try-catch khi uploadEngine.single throw (line 42)', () => {
  it('uploadEngine.single throw đồng bộ → gọi next với lỗi đó', async () => {
    const crashError = new Error('multer config crash');
    const uploadEngine = {
      single: jest.fn().mockImplementation(() => {
        throw crashError;
      }),
      array: jest.fn(),
    };
    const controller = new UploadController({
      uploadService: { processSingleUpload: jest.fn() },
      uploadEngine,
    });

    const next = jest.fn();
    await controller.uploadSingle(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(crashError);
  });
});

describe('uploadMultiple — outer try-catch khi uploadEngine.array throw (line 63)', () => {
  it('uploadEngine.array throw đồng bộ → gọi next với lỗi đó', async () => {
    const crashError = new Error('multer array config crash');
    const uploadEngine = {
      single: jest.fn(),
      array: jest.fn().mockImplementation(() => {
        throw crashError;
      }),
    };
    const controller = new UploadController({
      uploadService: { processMultipleUpload: jest.fn() },
      uploadEngine,
    });

    const next = jest.fn();
    await controller.uploadMultiple(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(crashError);
  });
});

// ─── Edge Cases: Image & File Handling Standards ──────────────────────────────
// Nguồn: upload-controller.edge-cases.test.js
// Bao gồm: validateMagicBytes, POST /api/uploads/:type/single, DELETE /api/uploads/:type/:filename

const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const supertest = require('supertest');
const { errorHandler } = require('@middlewares/error-handler');

// Magic bytes đặc trưng cho từng định dạng
// JPEG: FF D8 FF — 3 bytes đầu
const JPEG_MAGIC = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
// PNG: 89 50 4E 47 0D 0A 1A 0A — 8 bytes đầu
const PNG_MAGIC = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
// WebP: RIFF (4 bytes) + size (4 bytes) + WEBP (4 bytes)
const WEBP_MAGIC = Buffer.concat([
  Buffer.from([0x52, 0x49, 0x46, 0x46]),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from([0x57, 0x45, 0x42, 0x50]),
]);
// File giả mạo: bắt đầu bằng MZ header (Windows PE/EXE) — không phải ảnh
const FAKE_EXE_MAGIC = Buffer.from([
  0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
]);

describe('validateMagicBytes — kiểm tra bytes thực tế của file', () => {
  let tempDir;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phase18-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // Tạo file tạm với nội dung bytes tuỳ ý để kiểm tra
  async function writeTempFile(name, buffer) {
    const filePath = path.join(tempDir, name);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  // Phase 42 modules/upload expose validateMagicBytes wrapper qua module instance
  const buildUploadModuleForUnit = require('../module');
  const eventBusUnit = require('@shared/event-bus');
  const loggerUnit = require('@utils/logger');
  const { validateMagicBytes } = buildUploadModuleForUnit({
    eventBus: eventBusUnit,
    logger: loggerUnit,
  });

  test('JPEG hợp lệ → trả true', async () => {
    const p = await writeTempFile('valid.jpg', JPEG_MAGIC);
    await expect(validateMagicBytes(p)).resolves.toBe(true);
  });

  test('PNG hợp lệ → trả true', async () => {
    const p = await writeTempFile('valid.png', PNG_MAGIC);
    await expect(validateMagicBytes(p)).resolves.toBe(true);
  });

  test('WebP hợp lệ → trả true', async () => {
    const p = await writeTempFile('valid.webp', WEBP_MAGIC);
    await expect(validateMagicBytes(p)).resolves.toBe(true);
  });

  test('File exe giả mạo jpg → trả false', async () => {
    const p = await writeTempFile('fake.jpg', FAKE_EXE_MAGIC);
    await expect(validateMagicBytes(p)).resolves.toBe(false);
  });

  test('File PDF giả mạo png → trả false', async () => {
    // %PDF header
    const pdfBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
    const p = await writeTempFile('fake.png', pdfBytes);
    await expect(validateMagicBytes(p)).resolves.toBe(false);
  });

  test('File rỗng → trả false', async () => {
    const p = await writeTempFile('empty.jpg', Buffer.alloc(0));
    await expect(validateMagicBytes(p)).resolves.toBe(false);
  });
});

describe('POST /api/uploads/:type/single — upload endpoint', () => {
  let app;
  const uploadedFiles = [];

  beforeAll(() => {
    // Phase 42 modules/upload thay routes/upload
    const buildUploadModule = require('../module');
    const eventBus = require('@shared/event-bus');
    const logger = require('@utils/logger');
    const uploadModule = buildUploadModule({ eventBus, logger });
    app = express();
    app.use(express.json());
    app.use('/api/uploads', uploadModule.router);
    app.use(errorHandler);
  });

  afterAll(async () => {
    // Dọn dẹp các file thực sự đã được upload trong quá trình test
    await Promise.allSettled(uploadedFiles.map((fp) => fs.unlink(fp).catch(() => {})));
  });

  const request = () => supertest(app);

  // --- MIME type bị từ chối ---

  test('400 khi upload file GIF (MIME type không được phép)', async () => {
    // GIF87a magic bytes
    const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    const res = await request()
      .post('/api/uploads/products/single')
      .attach('file', gifBuffer, { filename: 'test.gif', contentType: 'image/gif' });

    // 4xx AppError trả về status: 'fail' theo convention errorHandler
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.message).toMatch(/Only JPG, PNG, WEBP allowed/i);
  });

  test('400 khi upload file PDF (MIME type không được phép)', async () => {
    const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46]);
    const res = await request()
      .post('/api/uploads/products/single')
      .attach('file', pdfBuffer, { filename: 'doc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.message).toMatch(/Only JPG, PNG, WEBP allowed/i);
  });

  // --- File quá lớn ---

  test('413 khi upload file lớn hơn 5MB', async () => {
    // Tạo buffer > 5MB với JPEG header để qua fileFilter trước
    const bigBuffer = Buffer.concat([JPEG_MAGIC, Buffer.alloc(5 * 1024 * 1024 + 1, 0)]);
    const res = await request()
      .post('/api/uploads/products/single')
      .attach('file', bigBuffer, { filename: 'big.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(413);
  });

  // --- Magic bytes giả mạo ---

  test('400 khi upload file exe giả mạo jpg (magic bytes không hợp lệ)', async () => {
    // MIME type là image/jpeg nhưng bytes là MZ (EXE header) → qua fileFilter, bị chặn tại magic bytes check
    const res = await request()
      .post('/api/uploads/products/single')
      .attach('file', FAKE_EXE_MAGIC, { filename: 'malicious.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
    expect(res.body.message).toMatch(/Chỉ cho phép file JPG, PNG, WEBP/i);
  });

  // --- File hợp lệ ---

  test('200 khi upload JPEG hợp lệ', async () => {
    const res = await request()
      .post('/api/uploads/products/single')
      .attach('file', JPEG_MAGIC, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toMatchObject({
      originalName: 'photo.jpg',
      type: 'products',
    });
    expect(res.body.data.url).toMatch(/^\/uploads\/products\//);
    // Lưu lại đường dẫn để dọn dẹp sau test
    if (res.body.data.filename) {
      const uploadDirs = require('../module')({
        eventBus: require('@shared/event-bus'),
        logger: require('@utils/logger'),
      })._uploadDirs;
      uploadedFiles.push(path.join(uploadDirs.products, res.body.data.filename));
    }
  });

  test('200 khi upload PNG hợp lệ', async () => {
    const res = await request()
      .post('/api/uploads/products/single')
      .attach('file', PNG_MAGIC, { filename: 'image.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    if (res.body.data?.filename) {
      const uploadDirs = require('../module')({
        eventBus: require('@shared/event-bus'),
        logger: require('@utils/logger'),
      })._uploadDirs;
      uploadedFiles.push(path.join(uploadDirs.products, res.body.data.filename));
    }
  });

  test('200 khi upload WebP hợp lệ', async () => {
    const res = await request()
      .post('/api/uploads/products/single')
      .attach('file', WEBP_MAGIC, { filename: 'image.webp', contentType: 'image/webp' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    if (res.body.data?.filename) {
      const uploadDirs = require('../module')({
        eventBus: require('@shared/event-bus'),
        logger: require('@utils/logger'),
      })._uploadDirs;
      uploadedFiles.push(path.join(uploadDirs.products, res.body.data.filename));
    }
  });

  test('400 khi không có file trong request', async () => {
    // Gửi multipart form hợp lệ (có boundary) nhưng không có field 'file'
    // Dùng .field() để trigger multipart parsing mà không kèm file
    const res = await request().post('/api/uploads/products/single').field('dummy', 'value');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Không có file/i);
  });
});

describe('DELETE /api/uploads/:type/:filename — xóa file', () => {
  let app;
  let tempFile;

  beforeAll(async () => {
    const buildUploadModule = require('../module');
    const eventBus = require('@shared/event-bus');
    const logger = require('@utils/logger');
    const uploadModule = buildUploadModule({ eventBus, logger });
    app = express();
    app.use(express.json());
    app.use('/api/uploads', uploadModule.router);
    app.use(errorHandler);

    // Tạo file test thực sự trong thư mục products (dùng _uploadDirs từ module)
    tempFile = path.join(uploadModule._uploadDirs.products, 'test-delete-phase18.jpg');
    await fs.writeFile(tempFile, JPEG_MAGIC);
  });

  afterAll(async () => {
    // Dọn dẹp nếu test không xóa được
    await fs.unlink(tempFile).catch(() => {});
  });

  const request = () => supertest(app);

  test('403 khi user thường cố xóa file (không phải admin)', async () => {
    const res = await request().delete('/api/uploads/products/test-delete-phase18.jpg');
    // authenticate mock đặt role = 'user' khi không có x-test-admin header

    expect(res.status).toBe(403);
  });

  test('404 khi admin xóa file không tồn tại', async () => {
    const res = await request()
      .delete('/api/uploads/products/nonexistent-file.jpg')
      .set('x-test-admin', 'true');

    expect(res.status).toBe(404);
  });

  test('200 khi admin xóa file tồn tại', async () => {
    const res = await request()
      .delete('/api/uploads/products/test-delete-phase18.jpg')
      .set('x-test-admin', 'true');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    // Xác nhận file đã bị xóa khỏi disk
    await expect(fs.stat(tempFile)).rejects.toThrow();
  });

  test('400 khi loại upload không hợp lệ', async () => {
    const res = await request()
      .delete('/api/uploads/invalidtype/somefile.jpg')
      .set('x-test-admin', 'true');

    expect(res.status).toBe(400);
  });
});
