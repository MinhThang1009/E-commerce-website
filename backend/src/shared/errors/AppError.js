// AppError — base operational error (status code + isOperational flag).
// Re-export class hiện có từ middlewares/errorHandler để bảo toàn instance equality
// (mọi nơi dùng instanceof AppError vẫn match). Phase 5 sẽ flip — class thật ở đây.
const { AppError } = require('../../middlewares/errorHandler');

module.exports = AppError;
