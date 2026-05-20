/**
 * @file routes.js
 * @layer Route
 * @module wishlist
 * @description HTTP endpoints của wishlist
 */
const express = require('express');
const { authenticate } = require('@middlewares/authenticate');

// Wishlist routes — basePath '/wishlists'. Old route mount tại /api/wishlists.
module.exports = ({ wishlistController }) => {
  const router = express.Router();
  router.use(authenticate);

  /**
   * @swagger
   * /api/wishlists:
   *   get:
   *     summary: Lấy danh sách yêu thích
   *     tags: [Wishlist]
   *     security:
   *       - bearerAuth: []
   *   post:
   *     summary: Thêm sản phẩm vào danh sách yêu thích
   *     tags: [Wishlist]
   *     security:
   *       - bearerAuth: []
   *   delete:
   *     summary: Xóa toàn bộ danh sách yêu thích
   *     tags: [Wishlist]
   *     security:
   *       - bearerAuth: []
   * /api/wishlists/check/{productId}:
   *   get:
   *     summary: Kiểm tra sản phẩm có trong danh sách yêu thích không
   *     tags: [Wishlist]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   * /api/wishlists/{productId}:
   *   delete:
   *     summary: Xóa sản phẩm khỏi danh sách yêu thích
   *     tags: [Wishlist]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   */
  router.get('/', wishlistController.getWishlist);
  router.post('/', wishlistController.addToWishlist);
  router.get('/check/:productId', wishlistController.checkWishlist);
  router.delete('/:productId', wishlistController.removeFromWishlist);
  router.delete('/', wishlistController.clearWishlist);

  return router;
};
