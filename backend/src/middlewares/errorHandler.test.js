'use strict';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const logger = require('../utils/logger');
const AppError = require('../shared/errors/AppError');
const { errorHandler } = require('./errorHandler');

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
  return () => { process.env.NODE_ENV = original; };
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
  beforeEach(() => { restore = saveAndSetEnv('production'); jest.clearAllMocks(); });
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
  beforeEach(() => { restore = saveAndSetEnv('production'); jest.clearAllMocks(); });
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
  beforeEach(() => { restore = saveAndSetEnv('production'); jest.clearAllMocks(); });
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
  beforeEach(() => { restore = saveAndSetEnv('production'); jest.clearAllMocks(); });
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
  beforeEach(() => { restore = saveAndSetEnv('production'); jest.clearAllMocks(); });
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
  beforeEach(() => { restore = saveAndSetEnv('production'); jest.clearAllMocks(); });
  afterEach(() => restore());

  it('trả về 422 với message ghép từ Sequelize validation errors', () => {
    const seqErr = new Error('Validation error');
    seqErr.name = 'SequelizeValidationError';
    seqErr.errors = [
      { message: 'Email không được để trống' },
      { message: 'Mật khẩu quá ngắn' },
    ];
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
  beforeEach(() => { restore = saveAndSetEnv('production'); jest.clearAllMocks(); });
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
