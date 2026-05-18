/**
 * @file BusinessError.js
 * @layer Shared
 * @module global
 * @description Cross-cutting infrastructure: BusinessError
 */
const AppError = require('@shared/errors/app-error');

// BusinessError — vi phạm business rule (trạng thái không hợp lệ, điều kiện không thỏa) (vd order.cancel() khi
// đã ship). 422 Unprocessable Entity cho semantic violation.
// Dùng trong DDD-lite modules (orders/payment/inventory/chat/ai).
class BusinessError extends AppError {
  constructor(message, code) {
    super(message, 422);
    this.name = 'BusinessError';
    this.domainCode = code;
  }
}

module.exports = BusinessError;
