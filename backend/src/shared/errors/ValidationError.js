/**
 * @file ValidationError.js
 * @layer Shared
 * @module global
 * @description Cross-cutting infrastructure: ValidationError
 */
const AppError = require('./AppError');

// ValidationError — sai format input (Joi/express-validator). 400 Bad Request.
// Service layer dùng class này thay vì throw AppError raw để controller phân biệt
// được lỗi validation vs lỗi business logic.
class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400);
    this.name = 'ValidationError';
    this.details = details;
  }
}

module.exports = ValidationError;
