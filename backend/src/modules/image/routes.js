const express = require('express');
const router = express.Router();
const imageController = require('./controllers/imageController');
const { authenticate } = require('../../middlewares/authenticate');
const { adminAuthenticate } = require('../../middlewares/adminAuth');

// Kiểm tra trạng thái hoạt động
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
