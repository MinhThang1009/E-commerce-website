const AppError = require('./AppError');

// DomainError — vi phạm invariant của domain aggregate (vd order.cancel() khi
// đã ship). 422 Unprocessable Entity cho semantic violation.
// Dùng trong DDD-lite modules (orders/payment/inventory/chat/ai).
class DomainError extends AppError {
  constructor(message, code) {
    super(message, 422);
    this.name = 'DomainError';
    this.domainCode = code;
  }
}

module.exports = DomainError;
