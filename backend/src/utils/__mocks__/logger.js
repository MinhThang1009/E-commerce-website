/**
 * @file __mocks__/logger.js
 * @description Manual mock cho @utils/logger (winston instance).
 *
 * Jest tự dùng file này khi test gọi `jest.mock('@utils/logger')` KHÔNG kèm factory.
 * Thay cho `jest.mock('@utils/logger', () => ({...}))` lặp lại nhiều file — và quan
 * trọng: bare jest.mock KHÔNG có factory để Stryker instrument phá babel-jest-hoist
 * (xem plan majestic-baking-yao.md). Thêm method mới → chỉ sửa file này.
 */
const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  log: jest.fn(),
};
// winston cho phép logger.child() → trả về logger con; mock trả chính nó.
logger.child = jest.fn(() => logger);

module.exports = logger;
