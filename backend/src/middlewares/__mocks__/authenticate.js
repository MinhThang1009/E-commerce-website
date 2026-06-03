/**
 * @file __mocks__/authenticate.js
 * @description Manual mock cho @middlewares/authenticate.
 *
 * Jest tự dùng khi test gọi `jest.mock('@middlewares/authenticate')` KHÔNG kèm factory.
 * Mặc định gắn user customer đã xác thực; test cần user khác → set `req.__mockUser`
 * (giống mẫu admin-auth). `optionalAuthenticate` cho guest → chỉ gắn user nếu có
 * `req.__mockUser` (không thì req.user undefined = guest).
 */
const authenticate = (req, _res, next) => {
  req.user = req.__mockUser || {
    id: 1,
    role: 'customer',
    email: 'customer@test.com',
    isEmailVerified: true,
  };
  next();
};

const optionalAuthenticate = (req, _res, next) => {
  if (req.__mockUser) req.user = req.__mockUser;
  next();
};

module.exports = { authenticate, optionalAuthenticate };
