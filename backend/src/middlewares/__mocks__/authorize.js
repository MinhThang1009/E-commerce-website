/**
 * @file __mocks__/authorize.js
 * @description Manual mock cho @middlewares/authorize — pass-through mọi role.
 * Dùng khi test gọi `jest.mock('@middlewares/authorize')` không kèm factory.
 * Việc enforce role được test riêng ở authorize.test.js.
 */
const authorize =
  (..._roles) =>
  (_req, _res, next) =>
    next();

module.exports = { authorize };
