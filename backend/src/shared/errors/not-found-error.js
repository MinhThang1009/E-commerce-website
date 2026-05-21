/**
 * @file NotFoundError.js
 * @layer Shared
 * @module global
 * @description Cross-cutting infrastructure: NotFoundError
 */
const AppError = require('@shared/errors/app-error');

// NotFoundError — resource không tồn tại. 404 Not Found.
// Repository.findById trả null → service throw NotFoundError thay vì để controller
// check undefined.
class NotFoundError extends AppError {
  constructor(resource, id) {
    const message = id ? `${resource} với id "${id}" không tồn tại` : `${resource} không tồn tại`;
    super(message, 404);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.resourceId = id;
  }
}

module.exports = NotFoundError;
