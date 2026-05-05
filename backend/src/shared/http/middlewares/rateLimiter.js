// Re-export từ middlewares/rateLimiter — bảo toàn proxy stores singleton (counter
// chia sẻ qua các route mount). Phase 5 cleanup sẽ flip.
module.exports = require('../../../middlewares/rateLimiter');
