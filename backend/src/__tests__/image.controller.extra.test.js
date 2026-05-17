// Tests bổ sung cho image controller (src/controllers/image.js) — nhắm vào
// các nhánh chưa được cover: non-multer error trong uploadSingle/uploadMultiple.

process.env.NODE_ENV = 'test';

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../middlewares/rateLimiter', () => ({
  apiLimiter: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/adminAuth', () => ({
  adminAuthenticate: (_req, _res, next) => next(),
}));

// Mock imageService — tất cả operations
const mockUploadImage = jest.fn();
const mockUploadMultipleImages = jest.fn();
const mockGetImageById = jest.fn();
const mockGetImagesByProductId = jest.fn();
const mockDeleteImage = jest.fn();
const mockConvertBase64ToFile = jest.fn();
const mockCleanupOrphanedFiles = jest.fn();

jest.mock('../modules/image/services/imageService', () => ({
  uploadImage: (...args) => mockUploadImage(...args),
  uploadMultipleImages: (...args) => mockUploadMultipleImages(...args),
  getImageById: (...args) => mockGetImageById(...args),
  getImagesByProductId: (...args) => mockGetImagesByProductId(...args),
  deleteImage: (...args) => mockDeleteImage(...args),
  convertBase64ToFile: (...args) => mockConvertBase64ToFile(...args),
  cleanupOrphanedFiles: (...args) => mockCleanupOrphanedFiles(...args),
}));

// Multer mock kiểm soát bởi global state
jest.mock('multer', () => {
  const { MulterError } = jest.requireActual('multer');

  const buildSingleMiddleware = () => (req, _res, cb) => {
    const behavior = global.__extraMockMulterSingle || 'success';
    if (behavior === 'success') {
      req.file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        path: '/tmp/t.jpg',
        filename: 't.jpg',
        size: 1024,
      };
      cb(null);
    } else if (behavior === 'noFile') {
      cb(null);
    } else if (behavior === 'limitFileSize') {
      cb(new MulterError('LIMIT_FILE_SIZE'));
    } else if (behavior === 'nonMulter') {
      cb(new Error('Disk full'));
    } else {
      cb(new MulterError('LIMIT_UNEXPECTED_FILE'));
    }
  };

  const buildArrayMiddleware = () => (req, _res, cb) => {
    const behavior = global.__extraMockMulterArray || 'success';
    if (behavior === 'success') {
      req.files = [
        {
          originalname: 'p1.jpg',
          mimetype: 'image/jpeg',
          path: '/tmp/p1.jpg',
          filename: 'p1.jpg',
          size: 512,
        },
        {
          originalname: 'p2.jpg',
          mimetype: 'image/jpeg',
          path: '/tmp/p2.jpg',
          filename: 'p2.jpg',
          size: 512,
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
    } else if (behavior === 'nonMulter') {
      cb(new Error('S3 connection refused'));
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

// Load controller trực tiếp để kiểm tra các nhánh không qua route
let imageController;

beforeAll(() => {
  imageController = require('../modules/image/controllers/imageController');
});

beforeEach(() => {
  jest.clearAllMocks();
  global.__extraMockMulterSingle = 'success';
  global.__extraMockMulterArray = 'success';
});

afterEach(() => {
  delete global.__extraMockMulterSingle;
  delete global.__extraMockMulterArray;
});

// ─── uploadSingle — non-multer error path ────────────────────────────────────

describe('ImageController.uploadSingle — non-multer error từ middleware', () => {
  it('gọi next với error gốc khi middleware callback nhận non-MulterError', async () => {
    global.__extraMockMulterSingle = 'nonMulter';

    const req = { body: {}, user: { id: 1 }, headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await imageController.uploadSingle(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Disk full' }));
    expect(mockUploadImage).not.toHaveBeenCalled();
  });
});

// ─── uploadMultiple — nhánh non-multer error ─────────────────────────────────

describe('ImageController.uploadMultiple — non-multer error từ middleware', () => {
  it('gọi next với error gốc khi middleware callback nhận non-MulterError', async () => {
    global.__extraMockMulterArray = 'nonMulter';

    const req = { body: {}, user: { id: 1 }, headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await imageController.uploadMultiple(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'S3 connection refused' }),
    );
    expect(mockUploadMultipleImages).not.toHaveBeenCalled();
  });
});

// ─── uploadSingle — req.body.generateThumbs / optimize options ───────────────

describe('ImageController.uploadSingle — options từ req.body', () => {
  it('generateThumbs=false → options.generateThumbs = false', async () => {
    global.__extraMockMulterSingle = 'success';
    mockUploadImage.mockResolvedValue({ id: 'img-1', filePath: 'products/test.jpg' });

    const req = {
      body: { generateThumbs: 'false', optimize: 'true', category: 'product' },
      user: { id: 1 },
      headers: {},
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await imageController.uploadSingle(req, res, next);

    expect(mockUploadImage).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ generateThumbs: false, optimize: true }),
    );
  });

  it('optimize=false → options.optimize = false', async () => {
    global.__extraMockMulterSingle = 'success';
    mockUploadImage.mockResolvedValue({ id: 'img-2', filePath: 'products/t2.jpg' });

    const req = {
      body: { optimize: 'false' },
      user: null,
      headers: {},
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await imageController.uploadSingle(req, res, jest.fn());

    expect(mockUploadImage).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ optimize: false, userId: null }),
    );
  });
});

// ─── uploadMultiple — options từ req.body ────────────────────────────────────

describe('ImageController.uploadMultiple — options từ req.body', () => {
  it('generateThumbs=false → options.generateThumbs = false', async () => {
    global.__extraMockMulterArray = 'success';
    const multiResult = {
      successful: [],
      failed: [],
      count: { total: 2, successful: 2, failed: 0 },
    };
    mockUploadMultipleImages.mockResolvedValue(multiResult);

    const req = {
      body: { generateThumbs: 'false', category: 'reviews' },
      user: { id: 5 },
      headers: {},
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await imageController.uploadMultiple(req, res, jest.fn());

    expect(mockUploadMultipleImages).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ generateThumbs: false }),
    );
  });
});

// ─── uploadSingle — uploadSingle generic multer error (không phải LIMIT_FILE_SIZE) ─

describe('ImageController.uploadSingle — generic multer error', () => {
  it('MulterError khác LIMIT_FILE_SIZE → AppError 400 với err.message', async () => {
    global.__extraMockMulterSingle = 'other';

    const req = { body: {}, user: { id: 1 }, headers: {} };
    const next = jest.fn();

    await imageController.uploadSingle(
      req,
      { status: jest.fn().mockReturnThis(), json: jest.fn() },
      next,
    );

    const calledWith = next.mock.calls[0][0];
    expect(calledWith).toMatchObject({ statusCode: 400 });
  });
});
