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
