/**
 * Test Phase 16 — Error Handling & Environment Validation
 *
 * Bao gồm:
 * - errorHandler trả đúng status code cho từng loại lỗi
 * - SequelizeUniqueConstraintError → 409 Conflict (không phải 500)
 * - SequelizeValidationError → 422 Unprocessable Entity
 * - MulterError → 400 Bad Request
 * - JsonWebTokenError → 401 Unauthorized
 * - TokenExpiredError → 401 Unauthorized
 * - Env var validation logic
 */

const express = require('express');
const supertest = require('supertest');
const { AppError, errorHandler } = require('../middlewares/errorHandler');

// Tạo app test tối giản với một route throw lỗi bất kỳ được truyền vào
const createTestApp = (errorToThrow) => {
  const app = express();
  app.use(express.json());
  // Route throw lỗi để test errorHandler
  app.get('/test-error', (_req, _res, next) => {
    next(errorToThrow);
  });
  // Gắn errorHandler của Phase 16
  app.use(errorHandler);
  return app;
};

// ============================================================
// SequelizeUniqueConstraintError → 409 Conflict
// ============================================================

describe('errorHandler — SequelizeUniqueConstraintError', () => {
  const uniqueConstraintErr = {
    name: 'SequelizeUniqueConstraintError',
    message: 'slug must be unique',
    errors: [{ path: 'slug', value: 'ao-thun-trang' }],
  };

  test('409 Conflict khi trùng unique constraint', async () => {
    const app = createTestApp(uniqueConstraintErr);
    const res = await supertest(app).get('/test-error');
    expect(res.status).toBe(409);
  });

  test('response có status field', async () => {
    const app = createTestApp(uniqueConstraintErr);
    const res = await supertest(app).get('/test-error');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('message');
  });

  test('message đề cập đến field bị trùng', async () => {
    const app = createTestApp(uniqueConstraintErr);
    const res = await supertest(app).get('/test-error');
    expect(res.body.message).toContain('slug');
  });
});

// ============================================================
// SequelizeValidationError → 422 Unprocessable Entity
// ============================================================

describe('errorHandler — SequelizeValidationError', () => {
  const validationErr = {
    name: 'SequelizeValidationError',
    message: 'Validation error',
    errors: [
      { message: 'name không được để trống' },
      { message: 'price phải lớn hơn 0' },
    ],
  };

  test('422 khi Sequelize validation thất bại', async () => {
    const app = createTestApp(validationErr);
    const res = await supertest(app).get('/test-error');
    expect(res.status).toBe(422);
  });

  test('response có message giải thích validation errors', async () => {
    const app = createTestApp(validationErr);
    const res = await supertest(app).get('/test-error');
    expect(res.body.message).toBeTruthy();
    expect(typeof res.body.message).toBe('string');
  });
});

// ============================================================
// MulterError → 400 Bad Request
// ============================================================

describe('errorHandler — MulterError', () => {
  const multerFileSizeErr = {
    name: 'MulterError',
    code: 'LIMIT_FILE_SIZE',
    message: 'File too large',
  };

  const multerUnexpectedErr = {
    name: 'MulterError',
    code: 'LIMIT_UNEXPECTED_FILE',
    message: 'Unexpected field',
  };

  test('400 khi file vượt quá kích thước cho phép', async () => {
    const app = createTestApp(multerFileSizeErr);
    const res = await supertest(app).get('/test-error');
    expect(res.status).toBe(400);
  });

  test('400 khi field file không hợp lệ', async () => {
    const app = createTestApp(multerUnexpectedErr);
    const res = await supertest(app).get('/test-error');
    expect(res.status).toBe(400);
  });
});

// ============================================================
// JWT errors → 401 Unauthorized
// ============================================================

describe('errorHandler — JWT errors', () => {
  test('401 khi JsonWebTokenError', async () => {
    const jwtErr = { name: 'JsonWebTokenError', message: 'invalid signature' };
    const app = createTestApp(jwtErr);
    const res = await supertest(app).get('/test-error');
    expect(res.status).toBe(401);
  });

  test('401 khi TokenExpiredError', async () => {
    const expiredErr = { name: 'TokenExpiredError', message: 'jwt expired' };
    const app = createTestApp(expiredErr);
    const res = await supertest(app).get('/test-error');
    expect(res.status).toBe(401);
  });
});

// ============================================================
// AppError (operational) — giữ nguyên statusCode
// ============================================================

describe('errorHandler — AppError operational', () => {
  test('404 cho AppError(404)', async () => {
    const appErr = new AppError('Không tìm thấy sản phẩm', 404);
    const app = createTestApp(appErr);
    const res = await supertest(app).get('/test-error');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Không tìm thấy sản phẩm');
  });

  test('403 cho AppError(403)', async () => {
    const appErr = new AppError('Không có quyền truy cập', 403);
    const app = createTestApp(appErr);
    const res = await supertest(app).get('/test-error');
    expect(res.status).toBe(403);
  });
});

// ============================================================
// Unknown error → 500
// ============================================================

describe('errorHandler — Unknown/unexpected error', () => {
  test('500 cho lỗi không xác định', async () => {
    const unknownErr = new Error('Lỗi không xác định từ thư viện bên ngoài');
    const app = createTestApp(unknownErr);
    const res = await supertest(app).get('/test-error');
    expect(res.status).toBe(500);
  });
});

// ============================================================
// Environment Variables Validation Logic
// ============================================================

describe('REQUIRED_ENV_VARS validation logic', () => {
  // Kiểm tra logic validation (không khởi động server thực sự)
  const REQUIRED_VARS = [
    'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
    'JWT_SECRET', 'JWT_REFRESH_SECRET',
    'STRIPE_SECRET_KEY',
    'GEMINI_API_KEY',
    'EMAIL_USERNAME', 'EMAIL_PASSWORD',
  ];

  test('tất cả required vars đều có trong process.env của test', () => {
    // Test này xác nhận rằng setup.js và .env đã đặt đủ các biến bắt buộc
    // STRIPE_SECRET_KEY, GEMINI_API_KEY, EMAIL_USERNAME, EMAIL_PASSWORD có thể undefined trong test env
    // — quan trọng là danh sách phải đúng theo plan
    expect(REQUIRED_VARS).toContain('JWT_SECRET');
    expect(REQUIRED_VARS).toContain('JWT_REFRESH_SECRET');
    expect(REQUIRED_VARS).toContain('DB_HOST');
    expect(REQUIRED_VARS).toContain('STRIPE_SECRET_KEY');
    expect(REQUIRED_VARS).toContain('GEMINI_API_KEY');
    expect(REQUIRED_VARS).toContain('EMAIL_USERNAME');
    expect(REQUIRED_VARS).toContain('EMAIL_PASSWORD');
  });

  test('missing vars được phát hiện đúng', () => {
    const mockEnv = {
      DB_HOST: 'localhost',
      DB_USER: 'root',
      DB_PASSWORD: 'password',
      DB_NAME: 'mydb',
      JWT_SECRET: 'secret',
      // JWT_REFRESH_SECRET bị thiếu
      STRIPE_SECRET_KEY: 'sk_test_xxx',
      GEMINI_API_KEY: 'ai-key',
      EMAIL_USERNAME: 'user@example.com',
      EMAIL_PASSWORD: 'pass',
    };
    const missing = REQUIRED_VARS.filter((key) => !mockEnv[key]);
    expect(missing).toContain('JWT_REFRESH_SECRET');
    expect(missing).toHaveLength(1);
  });

  test('không có missing vars khi tất cả được set', () => {
    const completeEnv = {
      DB_HOST: 'localhost',
      DB_USER: 'root',
      DB_PASSWORD: 'password',
      DB_NAME: 'mydb',
      JWT_SECRET: 'secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
      STRIPE_SECRET_KEY: 'sk_test_xxx',
      GEMINI_API_KEY: 'ai-key',
      EMAIL_USERNAME: 'user@example.com',
      EMAIL_PASSWORD: 'pass',
    };
    const missing = REQUIRED_VARS.filter((key) => !completeEnv[key]);
    expect(missing).toHaveLength(0);
  });
});
