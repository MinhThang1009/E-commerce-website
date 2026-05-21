'use strict';

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const { z } = require('zod');
const { validateRequest } = require('./validate-request');

function makeReqRes(body = {}) {
  const req = { body };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  return { req, res, next };
}

describe('validateRequest (Zod)', () => {
  const schema = z.object({
    name: z.string({ message: 'Tên là bắt buộc' }).min(1, 'Tên là bắt buộc'),
    age: z.number().int().min(0).optional(),
  });

  it('gọi next() khi data hợp lệ', () => {
    const { req, res, next } = makeReqRes({ name: 'Test', age: 18 });
    validateRequest(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body.name).toBe('Test');
  });

  it('strip unknown fields', () => {
    const { req, res, next } = makeReqRes({ name: 'Test', unknownField: 'xxx' });
    validateRequest(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body.unknownField).toBeUndefined();
  });

  it('gọi next(AppError) khi data không hợp lệ', () => {
    const { req, res, next } = makeReqRes({ age: 18 }); // thiếu name
    validateRequest(schema)(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('Tên là bắt buộc');
  });

  it('dùng statusCode tuỳ chỉnh', () => {
    const { req, res, next } = makeReqRes({});
    validateRequest(schema, 422)(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(422);
  });

  it('validate query params', () => {
    const querySchema = z.object({ page: z.coerce.number().int().min(1) });
    const req = { query: { page: '2' } };
    const next = jest.fn();
    validateRequest(querySchema, 400, 'query')(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.query.page).toBe(2);
  });
});
