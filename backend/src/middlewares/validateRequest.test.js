'use strict';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../utils/logger', () => mockLogger);

const Joi = require('joi');
const { validateRequest, validateExpressValidator, validate } = require('./validateRequest');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const res = {
    _status: null,
    _body: null,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  res.status.mockImplementation((code) => {
    res._status = code;
    return res;
  });
  res.json.mockImplementation((body) => {
    res._body = body;
    return res;
  });
  return res;
}

// ════════════════════════════════════════════════════════════════════════════
// validateRequest (Joi schema validation)
// ════════════════════════════════════════════════════════════════════════════

describe('validateRequest', () => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });

  describe('khi body hợp lệ theo schema', () => {
    it('gọi next() không có lỗi', () => {
      const validBody = { email: 'user@example.com', password: 'secret123' };
      const req = { body: validBody };
      const next = jest.fn();

      validateRequest(schema)(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi body có lỗi validation Joi', () => {
    it('gọi next với AppError chứa message từ Joi details', () => {
      const invalidBody = { email: 'not-an-email', password: '123' };
      const req = { body: invalidBody };
      const next = jest.fn();

      validateRequest(schema)(req, makeRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400); // statusCode mặc định
      expect(err.message).toMatch(/email|password/i);
    });

    it('dùng statusCode tùy chỉnh (422) khi được truyền vào', () => {
      const invalidBody = { email: '', password: '' };
      const req = { body: invalidBody };
      const next = jest.fn();

      validateRequest(schema, 422)(req, makeRes(), next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(422);
    });

    it('ghép nhiều validation error thành một message duy nhất', () => {
      const invalidBody = { email: 'bad', password: '1' }; // cả 2 field đều sai
      const req = { body: invalidBody };
      const next = jest.fn();

      validateRequest(schema)(req, makeRes(), next);

      const err = next.mock.calls[0][0];
      // message chứa nhiều lỗi được nối bằng dấu phẩy
      expect(err.message).toContain(',');
    });
  });

  describe('khi body có field không xác định (stripUnknown=true)', () => {
    it('gọi next() và loại bỏ field thừa — không báo lỗi', () => {
      const bodyWithExtra = {
        email: 'user@example.com',
        password: 'validpass',
        unknownField: 'shouldBeStripped',
      };
      const req = { body: bodyWithExtra };
      const next = jest.fn();

      validateRequest(schema)(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// validateExpressValidator (lines 28-50)
// ════════════════════════════════════════════════════════════════════════════

describe('validateExpressValidator', () => {
  // Tạo req giả với validationResult mock
  function makeReqWithErrors(errors = []) {
    // express-validator gắn validationResult vào req thông qua internal symbols
    // Ta dùng cách inject trực tiếp để bypass
    const req = {
      body: {},
      params: {},
      // express-validator store dùng symbol nội bộ — không thể set trực tiếp.
      // Thay vào đó, mock module express-validator để validationResult trả về mock.
    };
    return req;
  }

  describe('khi không có validation errors', () => {
    it('gọi next() không có lỗi', () => {
      // Mock express-validator để trả về empty errors
      jest.resetModules();
      jest.mock('../utils/logger', () => mockLogger);

      const { validationResult } = require('express-validator');

      // Sử dụng cách khác: inject express-validator mock
      jest.doMock('express-validator', () => ({
        validationResult: jest.fn().mockReturnValue({
          isEmpty: () => true,
          array: () => [],
        }),
      }));

      jest.resetModules();
      jest.mock('../utils/logger', () => mockLogger);
      jest.doMock('express-validator', () => ({
        validationResult: jest.fn().mockReturnValue({
          isEmpty: () => true,
          array: () => [],
        }),
      }));

      const { validateExpressValidator: vev } = require('./validateRequest');
      const req = { body: {}, params: {} };
      const res = makeRes();
      const next = jest.fn();

      vev(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('khi có validation errors từ express-validator', () => {
    it('trả về 400 JSON với danh sách lỗi được format', () => {
      jest.resetModules();
      jest.mock('../utils/logger', () => mockLogger);
      jest.doMock('express-validator', () => ({
        validationResult: jest.fn().mockReturnValue({
          isEmpty: () => false,
          array: () => [
            { path: 'email', msg: 'Email không hợp lệ', value: 'bad-email' },
            { path: 'password', msg: 'Mật khẩu quá ngắn', value: '123' },
          ],
        }),
      }));

      const { validateExpressValidator: vev } = require('./validateRequest');

      const req = { body: { email: 'bad-email', password: '123' }, params: {} };
      const res = makeRes();
      const next = jest.fn();

      vev(req, res, next);

      expect(res._status).toBe(400);
      expect(res._body.status).toBe('fail');
      expect(res._body.message).toBe('Lỗi kiểm tra dữ liệu đầu vào');
      expect(res._body.errors).toHaveLength(2);
      expect(res._body.errors[0]).toMatchObject({
        field: 'email',
        message: 'Email không hợp lệ',
        value: 'bad-email',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('log error và debug khi có validation errors', () => {
      jest.resetModules();
      jest.mock('../utils/logger', () => mockLogger);
      jest.doMock('express-validator', () => ({
        validationResult: jest.fn().mockReturnValue({
          isEmpty: () => false,
          array: () => [
            { path: 'name', msg: 'Tên bắt buộc', value: '' },
          ],
        }),
      }));

      const { validateExpressValidator: vev } = require('./validateRequest');

      const req = { body: { name: '' }, params: {} };
      const res = makeRes();
      const next = jest.fn();

      vev(req, res, next);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledTimes(2); // body + params
    });

    it('dùng error.param khi error.path không có (compat cũ)', () => {
      jest.resetModules();
      jest.mock('../utils/logger', () => mockLogger);
      jest.doMock('express-validator', () => ({
        validationResult: jest.fn().mockReturnValue({
          isEmpty: () => false,
          array: () => [
            // path undefined — dùng param (express-validator v5 compat)
            { param: 'username', msg: 'Bắt buộc', value: '' },
          ],
        }),
      }));

      const { validateExpressValidator: vev } = require('./validateRequest');

      const req = { body: {}, params: {} };
      const res = makeRes();
      const next = jest.fn();

      vev(req, res, next);

      expect(res._body.errors[0].field).toBe('username');
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// validate (factory function)
// ════════════════════════════════════════════════════════════════════════════

describe('validate', () => {
  it('trả về mảng gồm validation rules và validateExpressValidator ở cuối', () => {
    const rule1 = jest.fn();
    const rule2 = jest.fn();

    const result = validate([rule1, rule2]);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(rule1);
    expect(result[1]).toBe(rule2);
    // Phần tử cuối là validateExpressValidator (function)
    expect(typeof result[2]).toBe('function');
  });
});
