const express = require('express');
const router = express.Router();
const imageController = require('../controllers/image');
const { authenticate } = require('../middlewares/authenticate');
const { adminAuthenticate } = require('../middlewares/adminAuth');

/**
 * @swagger
 * tags:
 *   name: Images
 *   description: Quản lý hình ảnh nâng cao với tối ưu hóa và theo dõi trong database
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Image:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Định danh duy nhất của ảnh
 *         originalName:
 *           type: string
 *           description: Tên file gốc
 *         fileName:
 *           type: string
 *           description: Tên file duy nhất được tạo ra
 *         filePath:
 *           type: string
 *           description: Đường dẫn file tương đối
 *         fileSize:
 *           type: number
 *           description: Kích thước file tính bằng byte
 *         mimeType:
 *           type: string
 *           description: Kiểu MIME
 *         width:
 *           type: number
 *           description: Chiều rộng ảnh tính bằng pixel
 *         height:
 *           type: number
 *           description: Chiều cao ảnh tính bằng pixel
 *         category:
 *           type: string
 *           enum: [product, thumbnail, user, review]
 *           description: Danh mục ảnh
 *         productId:
 *           type: string
 *           format: uuid
 *           description: ID sản phẩm liên kết
 *         userId:
 *           type: string
 *           format: uuid
 *           description: ID người dùng liên kết
 *         url:
 *           type: string
 *           description: URL công khai để truy cập ảnh
 *         thumbnails:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               size:
 *                 type: string
 *                 enum: [small, medium, large]
 *               path:
 *                 type: string
 *               fileName:
 *                 type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/images/upload:
 *   post:
 *     summary: Tải lên một ảnh với tối ưu hóa
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh cần tải lên
 *               category:
 *                 type: string
 *                 enum: [product, user, review]
 *                 default: product
 *                 description: Danh mục ảnh
 *               productId:
 *                 type: string
 *                 format: uuid
 *                 description: ID sản phẩm nếu đây là ảnh sản phẩm
 *               generateThumbs:
 *                 type: boolean
 *                 default: true
 *                 description: Có tạo thumbnail hay không
 *               optimize:
 *                 type: boolean
 *                 default: true
 *                 description: Có tối ưu hóa ảnh hay không
 *     responses:
 *       200:
 *         description: Tải ảnh lên thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Image uploaded successfully
 *                 data:
 *                   $ref: '#/components/schemas/Image'
 *       400:
 *         description: File không hợp lệ hoặc lỗi tải lên
 *       401:
 *         description: Chưa xác thực
 */
/**
 * @swagger
 * /api/images/health:
 *   get:
 *     summary: Kiểm tra trạng thái dịch vụ ảnh
 *     tags: [Images]
 *     responses:
 *       200:
 *         description: Dịch vụ ảnh đang hoạt động bình thường
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Image service is healthy
 *                 data:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: string
 *                       example: "1.0.0"
 */
router.get('/health', imageController.healthCheck);

router.post('/upload', authenticate, imageController.uploadSingle);

// Endpoint kiểm tra không yêu cầu xác thực (chỉ dùng trong môi trường dev)
router.post('/test-upload', imageController.uploadSingle);

/**
 * @swagger
 * /api/images/upload-multiple:
 *   post:
 *     summary: Tải lên nhiều ảnh với tối ưu hóa
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Các file ảnh cần tải lên (tối đa 10)
 *               category:
 *                 type: string
 *                 enum: [product, user, review]
 *                 default: product
 *                 description: Danh mục ảnh
 *               productId:
 *                 type: string
 *                 format: uuid
 *                 description: ID sản phẩm nếu đây là ảnh sản phẩm
 *               generateThumbs:
 *                 type: boolean
 *                 default: true
 *                 description: Có tạo thumbnail hay không
 *               optimize:
 *                 type: boolean
 *                 default: true
 *                 description: Có tối ưu hóa ảnh hay không
 *     responses:
 *       200:
 *         description: Tải nhiều ảnh lên thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: 5 images uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     successful:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Image'
 *                     failed:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           fileName:
 *                             type: string
 *                           error:
 *                             type: string
 *                     count:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         successful:
 *                           type: number
 *                         failed:
 *                           type: number
 *       400:
 *         description: File không hợp lệ hoặc lỗi tải lên
 *       401:
 *         description: Chưa xác thực
 */
router.post('/upload-multiple', authenticate, imageController.uploadMultiple);

/**
 * @swagger
 * /api/images/{id}:
 *   get:
 *     summary: Lấy thông tin ảnh theo ID
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID ảnh
 *     responses:
 *       200:
 *         description: Lấy thông tin ảnh thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Image'
 *       404:
 *         description: Không tìm thấy ảnh
 */
router.get('/:id', imageController.getImageById);

/**
 * @swagger
 * /api/images/product/{productId}:
 *   get:
 *     summary: Lấy tất cả ảnh của sản phẩm
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID sản phẩm
 *     responses:
 *       200:
 *         description: Lấy ảnh sản phẩm thành công
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
 *                     images:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Image'
 *                     count:
 *                       type: number
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.get('/product/:productId', imageController.getImagesByProductId);

/**
 * @swagger
 * /api/images/{id}:
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
 *           type: string
 *           format: uuid
 *         description: ID ảnh
 *     responses:
 *       200:
 *         description: Xóa ảnh thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Image deleted successfully
 *       404:
 *         description: Không tìm thấy ảnh
 *       401:
 *         description: Chưa xác thực
 */
router.delete('/:id', authenticate, imageController.deleteImage);

/**
 * @swagger
 * /api/images/convert/base64:
 *   post:
 *     summary: Chuyển đổi chuỗi base64 thành file
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               base64Data:
 *                 type: string
 *                 description: Dữ liệu ảnh được mã hóa base64
 *                 example: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD..."
 *               category:
 *                 type: string
 *                 enum: [product, user, review]
 *                 default: product
 *                 description: Danh mục ảnh
 *               productId:
 *                 type: string
 *                 format: uuid
 *                 description: ID sản phẩm nếu đây là ảnh sản phẩm
 *             required:
 *               - base64Data
 *     responses:
 *       200:
 *         description: Chuyển đổi base64 thành file thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Base64 converted to file successfully
 *                 data:
 *                   $ref: '#/components/schemas/Image'
 *       400:
 *         description: Dữ liệu base64 không hợp lệ
 *       401:
 *         description: Chưa xác thực
 */
router.post('/convert/base64', authenticate, imageController.convertBase64);

/**
 * @swagger
 * /api/images/admin/cleanup:
 *   post:
 *     summary: Dọn dẹp file mồ côi (chỉ dành cho admin)
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dọn dẹp file mồ côi thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Orphaned files cleaned up successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalFiles:
 *                       type: number
 *                     activeFiles:
 *                       type: number
 *                     orphanedFiles:
 *                       type: number
 *                     deletedFiles:
 *                       type: number
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập (chỉ dành cho admin)
 */
router.post(
  '/admin/cleanup',
  authenticate,
  adminAuthenticate,
  imageController.cleanupOrphanedFiles
);

module.exports = router;
