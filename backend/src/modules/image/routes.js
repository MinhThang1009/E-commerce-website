/**
 * @file routes.js
 * @layer Route
 * @module image
 * @description HTTP endpoints của image
 */
const express = require('express');
const router = express.Router();
const imageController = require('@modules/image/controllers/image-controller');
const { authenticate } = require('@middlewares/authenticate');
const { adminAuthenticate } = require('@middlewares/admin-auth');

/**
 * @swagger
 * /api/images/health:
 *   get:
 *     summary: Kiểm tra trạng thái service ảnh
 *     tags: [Images]
 * /api/images/upload:
 *   post:
 *     summary: Upload một ảnh
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 * /api/images/test-upload:
 *   post:
 *     summary: Upload ảnh test (chỉ dùng trong development)
 *     tags: [Images]
 * /api/images/upload-multiple:
 *   post:
 *     summary: Upload nhiều ảnh cùng lúc
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 * /api/images/product/{productId}:
 *   get:
 *     summary: Lấy danh sách ảnh của sản phẩm
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 * /api/images/{id}:
 *   get:
 *     summary: Lấy thông tin ảnh theo ID
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *   delete:
 *     summary: Xóa ảnh
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 * /api/images/convert/base64:
 *   post:
 *     summary: Chuyển đổi ảnh base64 thành file
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 * /api/images/admin/cleanup:
 *   post:
 *     summary: Dọn dẹp file ảnh không còn tham chiếu (admin)
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 */
router.get('/health', imageController.healthCheck);

// Upload ảnh (yêu cầu đăng nhập)
router.post('/upload', authenticate, imageController.uploadSingle);

// Upload ảnh test (không cần xác thực — chỉ dùng trong development)
router.post('/test-upload', imageController.uploadSingle);

// Upload nhiều ảnh
router.post('/upload-multiple', authenticate, imageController.uploadMultiple);

// Lấy thông tin ảnh
router.get('/product/:productId', imageController.getImagesByProductId);
router.get('/:id', imageController.getImageById);

// Xóa ảnh
router.delete('/:id', authenticate, imageController.deleteImage);

// Chuyển đổi base64 sang file
router.post('/convert/base64', authenticate, imageController.convertBase64);

// Admin: Dọn dẹp file không còn tham chiếu
router.post(
  '/admin/cleanup',
  authenticate,
  adminAuthenticate,
  imageController.cleanupOrphanedFiles,
);

module.exports = router;
