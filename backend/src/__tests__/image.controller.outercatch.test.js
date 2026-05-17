// Tests for outer try/catch blocks in image controller (lines 94, 147).
// Lines 94 and 147 are the outer catch blocks in uploadSingle/uploadMultiple
// that fire when the multer middleware function throws synchronously.
//
// These paths require a mock where upload.single()/upload.array() returns a
// middleware that throws synchronously instead of calling the callback.

process.env.NODE_ENV = 'test';

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../services/image', () => ({
  uploadImage: jest.fn(),
  uploadMultipleImages: jest.fn(),
  getImageById: jest.fn(),
  getImagesByProductId: jest.fn(),
  deleteImage: jest.fn(),
  convertBase64ToFile: jest.fn(),
  cleanupOrphanedFiles: jest.fn(),
}));

// Multer mock where single/array middlewares throw synchronously
jest.mock('multer', () => {
  const { MulterError } = jest.requireActual('multer');

  const singleMiddlewareThatThrows = () => (_req, _res, _cb) => {
    throw new Error('multer internal sync error in single');
  };

  const arrayMiddlewareThatThrows = () => (_req, _res, _cb) => {
    throw new Error('multer internal sync error in array');
  };

  const factory = jest.fn(() => ({
    single: singleMiddlewareThatThrows,
    array: arrayMiddlewareThatThrows,
  }));
  factory.diskStorage = jest.fn(() => ({}));
  factory.MulterError = MulterError;
  return factory;
});

let imageController;

beforeAll(() => {
  imageController = require('../modules/image/controllers/imageController');
});

// ─── uploadSingle outer catch — line 94 ──────────────────────────────────────

describe('ImageController.uploadSingle — outer catch khi multer middleware throw đồng bộ (line 94)', () => {
  it('gọi next với lỗi khi multer middleware throw synchronously', async () => {
    const req = { body: {}, user: { id: 1 }, headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await imageController.uploadSingle(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'multer internal sync error in single' }),
    );
  });
});

// ─── uploadMultiple outer catch — line 147 ───────────────────────────────────

describe('ImageController.uploadMultiple — outer catch khi multer middleware throw đồng bộ (line 147)', () => {
  it('gọi next với lỗi khi multer middleware throw synchronously', async () => {
    const req = { body: {}, user: { id: 1 }, headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await imageController.uploadMultiple(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'multer internal sync error in array' }),
    );
  });
});
