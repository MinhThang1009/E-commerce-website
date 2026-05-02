const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  reviewSchema,
  reviewHelpfulSchema,
} = require('../validators/review');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Quản lý đánh giá sản phẩm
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: ID đánh giá
 *         productId:
 *           type: string
 *           description: ID sản phẩm
 *         userId:
 *           type: string
 *           description: ID người dùng
 *         userName:
 *           type: string
 *           description: Tên người dùng
 *         userAvatar:
 *           type: string
 *           description: URL ảnh đại diện người dùng
 *         rating:
 *           type: number
 *           description: Điểm đánh giá (1-5)
 *         title:
 *           type: string
 *           description: Tiêu đề đánh giá
 *         comment:
 *           type: string
 *           description: Nội dung đánh giá
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Ảnh đính kèm đánh giá
 *         isVerifiedPurchase:
 *           type: boolean
 *           description: Đánh giá từ người đã mua hàng được xác thực hay không
 *         likes:
 *           type: number
 *           description: Số lượt thích
 *         dislikes:
 *           type: number
 *           description: Số lượt không thích
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Ngày tạo
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Ngày cập nhật lần cuối
 */

// Route công khai

/**
 * @swagger
 * /api/reviews/product/{productId}:
 *   get:
 *     summary: Lấy danh sách đánh giá của sản phẩm
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID sản phẩm
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *         description: Lọc theo điểm đánh giá
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *         description: Lọc theo trạng thái mua hàng được xác thực
 *       - in: query
 *         name: withImages
 *         schema:
 *           type: boolean
 *         description: Lọc đánh giá có kèm ảnh
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, highest_rating, lowest_rating, most_helpful]
 *         description: Thứ tự sắp xếp
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số mục mỗi trang
 *     responses:
 *       200:
 *         description: Danh sách đánh giá
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.get('/product/:productId', reviewController.getProductReviews);

// Route của người dùng (yêu cầu xác thực)

/**
 * @swagger
 * /api/reviews/user:
 *   get:
 *     summary: Lấy danh sách đánh giá của người dùng hiện tại
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách đánh giá của người dùng
 *       401:
 *         description: Chưa xác thực
 */
router.use('/user', authenticate);
router.get('/user', reviewController.getUserReviews);

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Tạo đánh giá mới
 *     tags: [Reviews]
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
 *               - rating
 *               - title
 *               - comment
 *             properties:
 *               productId:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *               comment:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Tạo đánh giá thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.post(
  '/',
  authenticate,
  validateRequest(reviewSchema),
  reviewController.createReview
);

/**
 * @swagger
 * /api/reviews/{id}:
 *   put:
 *     summary: Cập nhật đánh giá
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID đánh giá
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *               comment:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Cập nhật đánh giá thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền cập nhật đánh giá này
 *       404:
 *         description: Không tìm thấy đánh giá
 */
router.put(
  '/:id',
  authenticate,
  validateRequest(reviewSchema),
  reviewController.updateReview
);

/**
 * @swagger
 * /api/reviews/{id}:
 *   delete:
 *     summary: Xóa đánh giá
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID đánh giá
 *     responses:
 *       200:
 *         description: Xóa đánh giá thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền xóa đánh giá này
 *       404:
 *         description: Không tìm thấy đánh giá
 */
router.delete('/:id', authenticate, reviewController.deleteReview);

/**
 * @swagger
 * /api/reviews/{id}/helpful:
 *   put:
 *     summary: Đánh dấu đánh giá là hữu ích hoặc không hữu ích
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID đánh giá
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - helpful
 *             properties:
 *               helpful:
 *                 type: boolean
 *                 description: true để thích, false để không thích
 *     responses:
 *       200:
 *         description: Đã cập nhật trạng thái hữu ích của đánh giá
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy đánh giá
 */
router.put(
  '/:id/helpful',
  authenticate,
  validateRequest(reviewHelpfulSchema),
  reviewController.markReviewHelpful
);

// Route của admin

/**
 * @swagger
 * /api/reviews/admin/all:
 *   get:
 *     summary: Lấy tất cả đánh giá (chỉ dành cho admin)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Số mục mỗi trang
 *     responses:
 *       200:
 *         description: Danh sách tất cả đánh giá
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 */
router.get(
  '/admin/all',
  authenticate,
  authorize('admin'),
  reviewController.getAllReviews
);

/**
 * @swagger
 * /api/reviews/admin/{id}/verify:
 *   patch:
 *     summary: Xác thực đánh giá (chỉ dành cho admin)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID đánh giá
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isVerified
 *             properties:
 *               isVerified:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Đã cập nhật trạng thái xác thực đánh giá
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy đánh giá
 */
router.patch(
  '/admin/:id/verify',
  authenticate,
  authorize('admin'),
  reviewController.verifyReview
);

module.exports = router;
