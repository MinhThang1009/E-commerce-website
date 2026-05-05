/**
 * Test Phase 18 — Image & File Handling Standards
 *
 * Bao gồm:
 * - validateMagicBytes — phát hiện file giả mạo qua nội dung bytes thực tế
 * - POST /api/uploads/:type/single — từ chối MIME type không được phép
 * - POST /api/uploads/:type/single — giới hạn kích thước 5MB (413)
 * - POST /api/uploads/:type/single — từ chối file có magic bytes không hợp lệ
 * - POST /api/uploads/:type/single — chấp nhận JPEG/PNG/WebP hợp lệ
 * - DELETE /api/uploads/:type/:filename — từ chối non-admin (403)
 * - DELETE /api/uploads/:type/:filename — trả 404 khi file không tồn tại
 */

const os = require('os');
const path = require('path');
const fs = require('fs').promises;

// ---------- Mocks phụ thuộc không liên quan đến upload ----------

jest.mock('../middlewares/rateLimiter', () => ({
  chatLimiter: (_req, _res, next) => next(),
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  }),
}));

// Authenticate: user thường theo mặc định, admin khi header x-test-admin có giá trị
jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = req.headers['x-test-admin'] === 'true'
      ? { id: 1, role: 'admin' }
      : { id: 2, role: 'user' };
    next();
  },
  optionalAuthenticate: (req, _res, next) => {
    req.user = { id: 2, role: 'user' };
    next();
  },
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const { errorHandler } = require('../middlewares/errorHandler');

// Magic bytes đặc trưng cho từng định dạng
// JPEG: FF D8 FF — 3 bytes đầu
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
// PNG: 89 50 4E 47 0D 0A 1A 0A — 8 bytes đầu
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
// WebP: RIFF (4 bytes) + size (4 bytes) + WEBP (4 bytes)
const WEBP_MAGIC = Buffer.concat([
  Buffer.from([0x52, 0x49, 0x46, 0x46]),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from([0x57, 0x45, 0x42, 0x50]),
]);
// File giả mạo: bắt đầu bằng MZ header (Windows PE/EXE) — không phải ảnh
const FAKE_EXE_MAGIC = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);

// ============================================================
// Unit test: validateMagicBytes
// ============================================================

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

  const { validateMagicBytes } = require('../controllers/upload');

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

// ============================================================
// Endpoint tests: POST /api/uploads/:type/single
// ============================================================

describe('POST /api/uploads/:type/single — upload endpoint', () => {
  let app;
  let uploadedFiles = [];

  beforeAll(() => {
    // Require upload route sau khi mocks đã được thiết lập
    const uploadRouter = require('../routes/upload');
    app = express();
    app.use(express.json());
    app.use('/api/uploads', uploadRouter);
    app.use(errorHandler);
  });

  afterAll(async () => {
    // Dọn dẹp các file thực sự đã được upload trong quá trình test
    await Promise.allSettled(
      uploadedFiles.map((fp) => fs.unlink(fp).catch(() => {}))
    );
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
    const bigBuffer = Buffer.concat([
      JPEG_MAGIC,
      Buffer.alloc(5 * 1024 * 1024 + 1, 0),
    ]);
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
    expect(res.body.message).toMatch(/Only JPG, PNG, WEBP allowed/i);
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
      const { uploadDirs } = require('../controllers/upload');
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
      const { uploadDirs } = require('../controllers/upload');
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
      const { uploadDirs } = require('../controllers/upload');
      uploadedFiles.push(path.join(uploadDirs.products, res.body.data.filename));
    }
  });

  test('400 khi không có file trong request', async () => {
    // Gửi multipart form hợp lệ (có boundary) nhưng không có field 'file'
    // Dùng .field() để trigger multipart parsing mà không kèm file
    const res = await request()
      .post('/api/uploads/products/single')
      .field('dummy', 'value');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Không có file/i);
  });
});

// ============================================================
// Endpoint tests: DELETE /api/uploads/:type/:filename
// ============================================================

describe('DELETE /api/uploads/:type/:filename — xóa file', () => {
  let app;
  let tempFile;

  beforeAll(async () => {
    const uploadRouter = require('../routes/upload');
    app = express();
    app.use(express.json());
    app.use('/api/uploads', uploadRouter);
    app.use(errorHandler);

    // Tạo file test thực sự trong thư mục products
    const { uploadDirs } = require('../controllers/upload');
    tempFile = path.join(uploadDirs.products, 'test-delete-phase18.jpg');
    await fs.writeFile(tempFile, JPEG_MAGIC);
  });

  afterAll(async () => {
    // Dọn dẹp nếu test không xóa được
    await fs.unlink(tempFile).catch(() => {});
  });

  const request = () => supertest(app);

  test('403 khi user thường cố xóa file (không phải admin)', async () => {
    const res = await request()
      .delete('/api/uploads/products/test-delete-phase18.jpg');
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
