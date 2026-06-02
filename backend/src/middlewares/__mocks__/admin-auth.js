/**
 * @file __mocks__/admin-auth.js
 * @description Manual mock cho @middlewares/admin-auth.
 *
 * Jest TỰ ĐỘNG dùng file này khi test gọi `jest.mock('@middlewares/admin-auth')`
 * KHÔNG kèm factory. Nhờ vậy khi middleware thật thêm export mới (vd `requireRole`),
 * chỉ cần cập nhật DUY NHẤT file này — không phải sửa từng test (tránh churn hàng loạt).
 *
 * Mặc định gắn user admin đã xác thực. Test cần user khác → set `req.__mockUser`
 * trước khi gọi endpoint (vd: `app.use((req, _r, n) => { req.__mockUser = {...}; n(); })`).
 */
const BACKOFFICE_ROLES = ['admin', 'staff'];

const adminAuthenticate = (req, _res, next) => {
  req.user = req.__mockUser || {
    id: 1,
    role: 'admin',
    email: 'admin@test.com',
    isEmailVerified: true,
  };
  next();
};

// Guard role: pass-through (việc enforce role được test riêng ở admin-auth.test.js)
const requireRole =
  (..._roles) =>
  (_req, _res, next) =>
    next();

const requireSuperAdmin = requireRole('admin');

module.exports = { adminAuthenticate, requireRole, requireSuperAdmin, BACKOFFICE_ROLES };
