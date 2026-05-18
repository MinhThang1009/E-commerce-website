// Phase 42.1 — Unit tests cho shared/errors hierarchy
const { AppError, DomainError, ValidationError, NotFoundError } = require('.');

describe('shared/errors', () => {
  test('AppError set statusCode + isOperational', () => {
    const e = new AppError('boom', 500);
    expect(e.message).toBe('boom');
    expect(e.statusCode).toBe(500);
    expect(e.isOperational).toBe(true);
    expect(e.status).toBe('error');
  });

  test('AppError 4xx → status="fail"', () => {
    const e = new AppError('bad', 400);
    expect(e.status).toBe('fail');
  });

  test('BusinessError extends AppError, statusCode 422, có domainCode', () => {
    const e = new DomainError('cannot cancel', 'ORDER_INVALID');
    expect(e).toBeInstanceOf(AppError);
    expect(e.statusCode).toBe(422);
    expect(e.domainCode).toBe('ORDER_INVALID');
    expect(e.name).toBe('BusinessError');
  });

  test('ValidationError statusCode 400, có details', () => {
    const e = new ValidationError('bad email', { field: 'email' });
    expect(e).toBeInstanceOf(AppError);
    expect(e.statusCode).toBe(400);
    expect(e.details).toEqual({ field: 'email' });
  });

  test('NotFoundError format message với resource + id', () => {
    const e = new NotFoundError('User', 42);
    expect(e).toBeInstanceOf(AppError);
    expect(e.statusCode).toBe(404);
    expect(e.message).toContain('User');
    expect(e.message).toContain('42');
    expect(e.resource).toBe('User');
    expect(e.resourceId).toBe(42);
  });

  test('NotFoundError không có id chỉ dùng resource trong message', () => {
    const e = new NotFoundError('Cart');
    expect(e.message).toBe('Cart không tồn tại');
  });

  test('AppError instance equality giữa shared/ và middlewares/', () => {
    const sharedAppError = require('./app-error');
    const oldAppError = require('@middlewares/error-handler').AppError;
    expect(sharedAppError).toBe(oldAppError);
  });
});
