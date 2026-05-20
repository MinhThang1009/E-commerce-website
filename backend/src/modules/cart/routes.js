/**
 * @file routes.js
 * @layer Route
 * @module cart
 * @description HTTP endpoints của cart
 */
const express = require('express');

const { optionalAuthenticate } = require('@middlewares/authenticate');
const { validateRequest } = require('@middlewares/validate-request');
const {
  addToCartSchema,
  updateCartItemSchema,
  syncCartSchema,
} = require('@modules/cart/validators/cart-validator');

// Cart module routes — basePath '/cart' (mount /api/cart). URL không đổi so với
// routes/cart.js cũ.
module.exports = ({ cartController }) => {
  const router = express.Router();

  // Mọi route dùng optionalAuth (guest có thể có cart qua sessionId cookie).
  router.use(optionalAuthenticate);

  /**
   * @swagger
   * /api/cart:
   *   get:
   *     summary: Lấy giỏ hàng hiện tại
   *     tags: [Cart]
   *   post:
   *     summary: Thêm sản phẩm vào giỏ hàng
   *     tags: [Cart]
   *   delete:
   *     summary: Xóa toàn bộ giỏ hàng
   *     tags: [Cart]
   * /api/cart/count:
   *   get:
   *     summary: Lấy số lượng sản phẩm trong giỏ hàng
   *     tags: [Cart]
   * /api/cart/sync:
   *   post:
   *     summary: Đồng bộ giỏ hàng guest với server
   *     tags: [Cart]
   * /api/cart/merge:
   *   post:
   *     summary: Gộp giỏ hàng guest vào tài khoản sau khi đăng nhập
   *     tags: [Cart]
   * /api/cart/validate:
   *   get:
   *     summary: Kiểm tra tính hợp lệ của giỏ hàng trước khi thanh toán
   *     tags: [Cart]
   * /api/cart/items/{id}:
   *   put:
   *     summary: Cập nhật số lượng sản phẩm trong giỏ
   *     tags: [Cart]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *   delete:
   *     summary: Xóa sản phẩm khỏi giỏ hàng
   *     tags: [Cart]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   */
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
