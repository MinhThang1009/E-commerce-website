/**
 * @file routes.js
 * @layer Route
 * @module cart
 * @description HTTP endpoints của cart
 */
const express = require('express');

const { optionalAuthenticate } = require('../../middlewares/authenticate');
const { validateRequest } = require('../../middlewares/validateRequest');
const {
  addToCartSchema,
  updateCartItemSchema,
  syncCartSchema,
} = require('./validators/cartValidator');

// Cart module routes — basePath '/cart' (mount /api/cart). URL không đổi so với
// routes/cart.js cũ.
module.exports = ({ cartController }) => {
  const router = express.Router();

  // Mọi route dùng optionalAuth (guest có thể có cart qua sessionId cookie).
  router.use(optionalAuthenticate);

  router.get('/', cartController.getCart);
  router.get('/count', cartController.getCartCount);
  router.post('/', validateRequest(addToCartSchema), cartController.addToCart);
  router.post('/sync', validateRequest(syncCartSchema), cartController.syncCart);
  router.post('/merge', cartController.mergeCart);
  router.put('/items/:id', validateRequest(updateCartItemSchema), cartController.updateCartItem);
  router.delete('/items/:id', cartController.removeCartItem);
  router.delete('/', cartController.clearCart);
  router.get('/validate', cartController.validateCart);

  return router;
};
