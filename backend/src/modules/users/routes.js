/**
 * @file routes.js
 * @layer Route
 * @module users
 * @description HTTP endpoints của users
 */
const express = require('express');

const { authenticate } = require('@middlewares/authenticate');
const { validateRequest } = require('@middlewares/validate-request');
const {
  updateProfileSchema,
  changePasswordSchema,
  addressSchema,
} = require('@modules/users/validators/users-validator');

// Users module routes — mount tại basePath '/users' (server.js wire vào /api/users).
// Endpoint URL không đổi so với routes/user.js cũ:
//   PUT    /api/users/profile
//   POST   /api/users/change-password
//   GET    /api/users/addresses
//   POST   /api/users/addresses
//   PUT    /api/users/addresses/:id
//   DELETE /api/users/addresses/:id
//   PATCH  /api/users/addresses/:id/default
module.exports = ({ usersController }) => {
  const router = express.Router();

  // Tất cả route yêu cầu xác thực
  router.use(authenticate);

  /**
   * @swagger
   * /api/users/profile:
   *   put:
   *     summary: Cập nhật thông tin cá nhân
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   * /api/users/change-password:
   *   post:
   *     summary: Đổi mật khẩu
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   * /api/users/addresses:
   *   get:
   *     summary: Lấy danh sách địa chỉ giao hàng
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *   post:
   *     summary: Thêm địa chỉ giao hàng mới
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   * /api/users/addresses/{id}:
   *   put:
   *     summary: Cập nhật địa chỉ giao hàng
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *   delete:
   *     summary: Xóa địa chỉ giao hàng
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   * /api/users/addresses/{id}/default:
   *   patch:
   *     summary: Đặt địa chỉ làm mặc định
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   */
  router.put('/profile', validateRequest(updateProfileSchema), usersController.updateProfile);
  router.post(
    '/change-password',
    validateRequest(changePasswordSchema),
    usersController.changePassword,
  );

  router.get('/addresses', usersController.getAddresses);
  router.post('/addresses', validateRequest(addressSchema), usersController.addAddress);
  router.put('/addresses/:id', validateRequest(addressSchema), usersController.updateAddress);
  router.delete('/addresses/:id', usersController.deleteAddress);
  router.patch('/addresses/:id/default', usersController.setDefaultAddress);

  return router;
};
