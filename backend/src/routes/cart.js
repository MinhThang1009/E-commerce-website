const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  addToCartSchema,
  updateCartItemSchema,
  syncCartSchema,
} = require('../validators/cart');
const { optionalAuthenticate } = require('../middlewares/authenticate');

/**
 * @swagger
 * tags:
 *   name: Cart
 *   description: Quản lý giỏ hàng
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CartItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID mục trong giỏ hàng
 *         cartId:
 *           type: integer
 *           description: ID giỏ hàng
 *         productId:
 *           type: integer
 *           description: ID sản phẩm
 *         variantId:
 *           type: integer
 *           description: ID biến thể sản phẩm
 *         quantity:
 *           type: integer
 *           description: Số lượng sản phẩm
 *         price:
 *           type: number
 *           description: Giá tại thời điểm thêm vào giỏ hàng
 *         Product:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *             slug:
 *               type: string
 *             price:
 *               type: number
 *             thumbnail:
 *               type: string
 *             inStock:
 *               type: boolean
 *             stockQuantity:
 *               type: integer
 *         ProductVariant:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *             price:
 *               type: number
 *             stockQuantity:
 *               type: integer
 */

// Tất cả route dùng xác thực tùy chọn để xử lý cả khách vãng lai và người dùng đã đăng nhập
router.use(optionalAuthenticate);

/**
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Lấy giỏ hàng của người dùng
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chi tiết giỏ hàng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CartItem'
 *                     totalItems:
 *                       type: integer
 *                     subtotal:
 *                       type: number
 */
router.get('/', cartController.getCart);

/**
 * @swagger
 * /api/cart/count:
 *   get:
 *     summary: Lấy số lượng mục trong giỏ hàng
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Số lượng mục trong giỏ hàng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 */
router.get('/count', cartController.getCartCount);

/**
 * @swagger
 * /api/cart:
 *   post:
 *     summary: Thêm sản phẩm vào giỏ hàng
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *             properties:
 *               productId:
 *                 type: integer
 *               variantId:
 *                 type: integer
 *               quantity:
 *                 type: integer
 *                 default: 1
 *     responses:
 *       200:
 *         description: Đã thêm sản phẩm vào giỏ hàng
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc sản phẩm hết hàng
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.post('/', validateRequest(addToCartSchema), cartController.addToCart);

/**
 * @swagger
 * /api/cart/sync:
 *   post:
 *     summary: Đồng bộ giỏ hàng từ local storage lên server
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: integer
 *                     variantId:
 *                       type: integer
 *                     quantity:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     price:
 *                       type: number
 *                     image:
 *                       type: string
 *                     attributes:
 *                       type: object
 *     responses:
 *       200:
 *         description: Đồng bộ giỏ hàng thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 */
router.post('/sync', validateRequest(syncCartSchema), cartController.syncCart);

/**
 * @swagger
 * /api/cart/merge:
 *   post:
 *     summary: Gộp giỏ hàng khách vãng lai vào giỏ hàng người dùng sau khi đăng nhập
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gộp giỏ hàng thành công
 *       401:
 *         description: Người dùng chưa xác thực
 */
router.post('/merge', cartController.mergeCart);

/**
 * @swagger
 * /api/cart/items/{id}:
 *   put:
 *     summary: Cập nhật số lượng sản phẩm trong giỏ hàng
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID mục trong giỏ hàng
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Đã cập nhật mục trong giỏ hàng
 *       400:
 *         description: Số lượng không hợp lệ hoặc sản phẩm hết hàng
 *       403:
 *         description: Không có quyền cập nhật giỏ hàng này
 *       404:
 *         description: Không tìm thấy mục trong giỏ hàng
 */
router.put(
  '/items/:id',
  validateRequest(updateCartItemSchema),
  cartController.updateCartItem
);

/**
 * @swagger
 * /api/cart/items/{id}:
 *   delete:
 *     summary: Xóa sản phẩm khỏi giỏ hàng
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID mục trong giỏ hàng
 *     responses:
 *       200:
 *         description: Đã xóa sản phẩm khỏi giỏ hàng
 *       403:
 *         description: Không có quyền cập nhật giỏ hàng này
 *       404:
 *         description: Không tìm thấy mục trong giỏ hàng
 */
router.delete('/items/:id', cartController.removeCartItem);

/**
 * @swagger
 * /api/cart:
 *   delete:
 *     summary: Xóa toàn bộ giỏ hàng
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đã xóa giỏ hàng
 */
router.delete('/', cartController.clearCart);

// Kiểm tra giỏ hàng: phát hiện thay đổi tồn kho, thay đổi giá
router.get('/validate', cartController.validateCart);

module.exports = router;
