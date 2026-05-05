// Barrel export cho mọi http middleware. Module mới import:
//   const { authenticate, errorHandler } = require('../../shared/http/middlewares');
const { authenticate, optionalAuthenticate } = require('./authenticate');
const { authorize } = require('./authorize');
const { adminAuthenticate, requireSuperAdmin } = require('./adminAuth');
const { errorHandler, AppError } = require('./errorHandler');
const { validateRequest, validate, validateExpressValidator } = require('./validateRequest');
const rateLimiter = require('./rateLimiter');
const cache = require('./cache');

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  adminAuthenticate,
  requireSuperAdmin,
  errorHandler,
  AppError,
  validateRequest,
  validate,
  validateExpressValidator,
  ...rateLimiter,
  ...cache,
};
