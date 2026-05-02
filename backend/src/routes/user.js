const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  updateUserSchema,
  changePasswordSchema,
} = require('../validators/user');
const { addressSchema } = require('../validators/address');
const { authenticate } = require('../middlewares/authenticate');

// Tất cả route yêu cầu xác thực
router.use(authenticate);

// Các route quản lý hồ sơ người dùng
router.put(
  '/profile',
  validateRequest(updateUserSchema),
  userController.updateProfile
);
router.post(
  '/change-password',
  validateRequest(changePasswordSchema),
  userController.changePassword
);

// Các route quản lý địa chỉ
router.get('/addresses', userController.getAddresses);
router.post(
  '/addresses',
  validateRequest(addressSchema),
  userController.addAddress
);
router.put(
  '/addresses/:id',
  validateRequest(addressSchema),
  userController.updateAddress
);
router.delete('/addresses/:id', userController.deleteAddress);
router.patch('/addresses/:id/default', userController.setDefaultAddress);

module.exports = router;
