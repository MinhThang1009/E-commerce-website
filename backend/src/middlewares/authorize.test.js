'use strict';

// ─── Mocks ────────────────────────────────────────────────────────────────────
// errorHandler re-exports AppError từ shared/errors/AppError — không cần mock
// authorize.js chỉ phụ thuộc errorHandler để lấy AppError

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const { authorize } = require('./authorize');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(user) {
  return { user };
}

function makeRes() {
  return {};
}

// ════════════════════════════════════════════════════════════════════════════
// authorize
// ════════════════════════════════════════════════════════════════════════════

describe('authorize', () => {
  describe('khi req.user chưa được gán (chưa đăng nhập)', () => {
    it('gọi next với AppError 401', () => {
      const middleware = authorize('admin');
      const next = jest.fn();

      middleware(makeReq(undefined), makeRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(401);
      expect(err.message).toMatch(/đăng nhập/i);
    });
  });

  describe('khi req.user.role không nằm trong danh sách cho phép', () => {
    it('gọi next với AppError 403', () => {
      const middleware = authorize('admin');
      const next = jest.fn();
      const customerUser = { id: 1, role: 'customer' };

      middleware(makeReq(customerUser), makeRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      expect(err.message).toMatch(/quyền/i);
    });
  });

  describe('khi req.user.role khớp với role được phép', () => {
    it('gọi next() không có lỗi', () => {
      const middleware = authorize('admin');
      const next = jest.fn();
      const adminUser = { id: 2, role: 'admin' };

      middleware(makeReq(adminUser), makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi authorize không nhận role nào (danh sách rỗng)', () => {
    it('gọi next với AppError 403 cho mọi role vì danh sách rỗng', () => {
      const middleware = authorize(); // không có role nào được phép
      const next = jest.fn();
      const adminUser = { id: 4, role: 'admin' };

      middleware(makeReq(adminUser), makeRes(), next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
    });
  });
});
