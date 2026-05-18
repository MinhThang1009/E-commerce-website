/**
 * @file AppError.js
 * @layer Shared
 * @module global
 * @description Cross-cutting infrastructure: AppError
 */
class AppError extends Error {
  constructor(message, statusCode, params = {}) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.params = params;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
