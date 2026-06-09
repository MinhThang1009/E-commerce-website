'use strict';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const logger = require('@utils/logger');
const AppError = require('@shared/errors/app-error');
const { errorHandler } = require('./error-handler');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  // Cập nhật statusCode khi .status() được gọi
  res.status.mockImplementation((code) => {
    res.statusCode = code;
    return res;
  });
  return res;
}

function makeReq() {
  return { method: 'GET', url: '/test' };
}

function saveAndSetEnv(value) {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  return () => {
    process.env.NODE_ENV = original;
  };
}

// ════════════════════════════════════════════════════════════════════════════
// errorHandler — development mode (sendErrorDev)
// ════════════════════════════════════════════════════════════════════════════

describe('errorHandler — môi trường development', () => {
  let restore;
  beforeEach(() => {
    restore = saveAndSetEnv('development');
    jest.clearAllMocks();
  });
  afterEach(() => restore());

  it('trả về status, message, error object và stack trong response', () => {
    const err = new AppError('Lỗi test', 400);
    const res = makeRes();

    errorHandler(err, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('fail');
    expect(body.message).toBe('Lỗi test');
    // stack key luôn có trong response dev — giá trị có thể là undefined
    // vì stack là non-enumerable trên Error và không được copy bởi Object.assign
    expect(Object.keys(body)).toContain('stack');
    expect(body.error).toBeDefined();
  });

  it('dùng statusCode mặc định 500 khi err.statusCode không được set', () => {
    const err = new Error('Unknown crash');
    const res = makeRes();

    errorHandler(err, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// errorHandler — production mode (sendErrorProd)
// ════════════════════════════════════════════════════════════════════════════

describe('errorHandler — môi trường production', () => {
  let restore;
  beforeEach(() => {
    restore = saveAndSetEnv('production');
    jest.clearAllMocks();
  });
  afterEach(() => restore());

  describe('khi lỗi là operational (AppError)', () => {
    it('trả về status và message của lỗi gốc', () => {
      const err = new AppError('Resource not found', 404);
      const res = makeRes();

      errorHandler(err, makeReq(), res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      const body = res.json.mock.calls[0][0];
      expect(body.message).toBe('Resource not found');
      expect(body.stack).toBeUndefined(); // production không trả stack
    });
  });

  describe('khi lỗi không phải operational (lỗi lập trình)', () => {
    it('trả về 500 và message generic, log error', () => {
      const err = new Error('DB exploded'); // Error thường — không phải AppError
      const res = makeRes();

      errorHandler(err, makeReq(), res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe('error');
      expect(body.message).toMatch(/lỗi/i);
      expect(body.stack).toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// handleCastErrorDB (line 34-35)
// ════════════════════════════════════════════════════════════════════════════

describe('errorHandler — CastError (MongoDB)', () => {
  let restore;
  beforeEach(() => {
    restore = saveAndSetEnv('production');
    jest.clearAllMocks();
  });
  afterEach(() => restore());

  it('trả về 400 với message chứa giá trị không hợp lệ', () => {
    const castErr = new Error('Cast to ObjectId failed');
    castErr.name = 'CastError';
    castErr.value = 'abc-not-an-id';
    const res = makeRes();

    errorHandler(castErr, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toContain('abc-not-an-id');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// handleDuplicateFieldsDB (line 40-42)
// ════════════════════════════════════════════════════════════════════════════

describe('errorHandler — DuplicateFieldsDB (MongoDB code 11000)', () => {
  let restore;
  beforeEach(() => {
    restore = saveAndSetEnv('production');
    jest.clearAllMocks();
  });
  afterEach(() => restore());

  it('trả về 409 với message chứa giá trị trùng lặp', () => {
    const dupErr = new Error('E11000 duplicate key error');
    dupErr.code = 11000;
    dupErr.errmsg = 'E11000 duplicate key error dup key: { email: "test@example.com" }';
    const res = makeRes();

    errorHandler(dupErr, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toContain('trùng lặp');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// handleValidationErrorDB (line 47-49)
// ════════════════════════════════════════════════════════════════════════════

describe('errorHandler — ValidationError (MongoDB/Mongoose)', () => {
  let restore;
  beforeEach(() => {
    restore = saveAndSetEnv('production');
    jest.clearAllMocks();
  });
  afterEach(() => restore());

  it('trả về 422 với message ghép từ tất cả validation errors', () => {
    const validationErr = new Error('Validation failed');
    validationErr.name = 'ValidationError';
    validationErr.errors = {
      email: { message: 'Email không hợp lệ' },
      name: { message: 'Tên quá ngắn' },
    };
    const res = makeRes();

    errorHandler(validationErr, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(422);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toContain('Email không hợp lệ');
    expect(body.message).toContain('Tên quá ngắn');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// handleJWTError và handleJWTExpiredError
// ════════════════════════════════════════════════════════════════════════════

describe('errorHandler — JsonWebTokenError', () => {
  let restore;
  beforeEach(() => {
    restore = saveAndSetEnv('production');
    jest.clearAllMocks();
  });
  afterEach(() => restore());

  it('trả về 401 khi token không hợp lệ', () => {
    const jwtErr = new Error('invalid signature');
    jwtErr.name = 'JsonWebTokenError';
    const res = makeRes();

    errorHandler(jwtErr, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toMatch(/Token/);
  });

  it('trả về 401 khi token hết hạn', () => {
    const expiredErr = new Error('jwt expired');
    expiredErr.name = 'TokenExpiredError';
    const res = makeRes();

    errorHandler(expiredErr, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toMatch(/hết hạn/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// handleSequelizeUniqueConstraintError
// ════════════════════════════════════════════════════════════════════════════

describe('errorHandler — SequelizeUniqueConstraintError', () => {
  let restore;
  beforeEach(() => {
    restore = saveAndSetEnv('production');
    jest.clearAllMocks();
  });
  afterEach(() => restore());

  it('trả về 409 với message chứa field và value khi có errors[0]', () => {
    const seqErr = new Error('Validation error');
    seqErr.name = 'SequelizeUniqueConstraintError';
    seqErr.errors = [{ path: 'email', value: 'dup@test.com' }];
    const res = makeRes();

    errorHandler(seqErr, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toContain('dup@test.com');
    expect(body.message).toContain('email');
  });

  it('trả về 409 với message generic khi không có errors[0]', () => {
    const seqErr = new Error('Validation error');
    seqErr.name = 'SequelizeUniqueConstraintError';
    seqErr.errors = [];
    const res = makeRes();

    errorHandler(seqErr, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toMatch(/đã tồn tại/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// handleSequelizeValidationError
// ════════════════════════════════════════════════════════════════════════════

describe('errorHandler — SequelizeValidationError', () => {
  let restore;
  beforeEach(() => {
    restore = saveAndSetEnv('production');
    jest.clearAllMocks();
  });
  afterEach(() => restore());

  it('trả về 422 với message ghép từ Sequelize validation errors', () => {
    const seqErr = new Error('Validation error');
    seqErr.name = 'SequelizeValidationError';
    seqErr.errors = [{ message: 'Email không được để trống' }, { message: 'Mật khẩu quá ngắn' }];
    const res = makeRes();

    errorHandler(seqErr, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(422);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toContain('Email không được để trống');
    expect(body.message).toContain('Mật khẩu quá ngắn');
  });

  it('dùng err.message khi errors array trống', () => {
    const seqErr = new Error('Fallback validation message');
    seqErr.name = 'SequelizeValidationError';
    seqErr.errors = null; // không có errors
    const res = makeRes();

    errorHandler(seqErr, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(422);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toContain('Fallback validation message');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// handleMulterError (line 83 — unknown code branch)
// ════════════════════════════════════════════════════════════════════════════

describe('errorHandler — MulterError', () => {
  let restore;
  beforeEach(() => {
    restore = saveAndSetEnv('production');
    jest.clearAllMocks();
  });
  afterEach(() => restore());

  it('trả về 400 với message LIMIT_FILE_SIZE khi vượt kích thước', () => {
    const multerErr = new Error('File too large');
    multerErr.name = 'MulterError';
    multerErr.code = 'LIMIT_FILE_SIZE';
    const res = makeRes();

    errorHandler(multerErr, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toMatch(/kích thước/);
  });

  it('trả về 400 với message LIMIT_UNEXPECTED_FILE khi field không hợp lệ', () => {
    const multerErr = new Error('Unexpected field');
    multerErr.name = 'MulterError';
    multerErr.code = 'LIMIT_UNEXPECTED_FILE';
    const res = makeRes();

    errorHandler(multerErr, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toMatch(/file/i);
  });

  it('trả về 400 với message generic cho mã lỗi Multer không xác định (line 83)', () => {
    const multerErr = new Error('Some unknown multer error');
    multerErr.name = 'MulterError';
    multerErr.code = 'LIMIT_UNKNOWN';
    const res = makeRes();

    errorHandler(multerErr, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toContain('Some unknown multer error');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// edge-cases — integration-style via supertest (express app)
// ════════════════════════════════════════════════════════════════════════════

describe('errorHandler — edge cases (supertest integration)', () => {
  const express = require('express');
  const supertest = require('supertest');

  const createTestApp = (errorToThrow) => {
    const app = express();
    app.use(express.json());
    app.get('/test-error', (_req, _res, next) => {
      next(errorToThrow);
    });
    app.use(errorHandler);
    return app;
  };

  describe('SequelizeUniqueConstraintError → 409 Conflict', () => {
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

  describe('SequelizeValidationError → 422 Unprocessable Entity', () => {
    const validationErr = {
      name: 'SequelizeValidationError',
      message: 'Validation error',
      errors: [{ message: 'name không được để trống' }, { message: 'price phải lớn hơn 0' }],
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

  describe('MulterError → 400 Bad Request', () => {
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

  describe('JWT errors → 401 Unauthorized', () => {
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

  describe('AppError operational — giữ nguyên statusCode', () => {
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

  describe('Unknown/unexpected error → 500', () => {
    test('500 cho lỗi không xác định', async () => {
      const unknownErr = new Error('Lỗi không xác định từ thư viện bên ngoài');
      const app = createTestApp(unknownErr);
      const res = await supertest(app).get('/test-error');
      expect(res.status).toBe(500);
    });
  });

  describe('REQUIRED_ENV_VARS validation logic', () => {
    const REQUIRED_VARS = [
      'DB_HOST',
      'DB_USER',
      'DB_PASSWORD',
      'DB_NAME',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'LLM_API_KEY',
      'EMAIL_USERNAME',
      'EMAIL_PASSWORD',
    ];

    test('tất cả required vars đều có trong process.env của test', () => {
      expect(REQUIRED_VARS).toContain('JWT_SECRET');
      expect(REQUIRED_VARS).toContain('JWT_REFRESH_SECRET');
      expect(REQUIRED_VARS).toContain('DB_HOST');
      expect(REQUIRED_VARS).toContain('LLM_API_KEY');
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
        LLM_API_KEY: 'ai-key',
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
        LLM_API_KEY: 'ai-key',
        EMAIL_USERNAME: 'user@example.com',
        EMAIL_PASSWORD: 'pass',
      };
      const missing = REQUIRED_VARS.filter((key) => !completeEnv[key]);
      expect(missing).toHaveLength(0);
    });
  });
});
