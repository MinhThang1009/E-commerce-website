// Unit tests cho UploadController.
// Kiểm tra: _mapMulterError, uploadSingle, uploadMultiple, deleteFile.
// Mock multer để kiểm soát middleware behavior hoàn toàn.

const multer = require('multer');
const UploadController = require('./upload-controller');
const { AppError } = require('@shared/errors');

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
