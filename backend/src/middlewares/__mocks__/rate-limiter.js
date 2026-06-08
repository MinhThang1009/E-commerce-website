/**
 * @file __mocks__/rate-limiter.js
 * @description Manual mock cho @middlewares/rate-limiter.
 *
 * Jest tự dùng khi test gọi `jest.mock('@middlewares/rate-limiter')` KHÔNG kèm factory.
 * Mọi limiter → middleware pass-through (test không kiểm rate-limit ở đây). Mirror export thật.
 */
const passthrough = (_req, _res, next) => next();

module.exports = {
  apiLimiter: passthrough,
  authLimiter: passthrough,
  otpLimiter: passthrough,
  chatbotLimiter: passthrough,
  chatLimiter: passthrough,
  destructiveLimiter: passthrough,
};
