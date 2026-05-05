// Re-export từ middlewares/errorHandler. Phase 5 cleanup sẽ flip.
// AppError class cũng có copy ở shared/errors/AppError — instance equality giữ vì
// shared/errors/AppError cũng re-export class này.
module.exports = require('../../../middlewares/errorHandler');
