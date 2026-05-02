const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat');
const { authenticate } = require('../middlewares/authenticate');
const { adminAuthenticate } = require('../middlewares/adminAuth');

// Tất cả route yêu cầu xác thực
router.use(authenticate);

// Admin lấy danh sách chat (đặt trước :userId để tránh xung đột routing)
router.get('/admin/list', adminAuthenticate, chatController.getAdminChatList);

// Người dùng/Admin lấy lịch sử chat
router.get('/:identifier', chatController.getChatHistory);

// Đánh dấu cuộc hội thoại là đã đọc
router.patch('/read/:identifier', chatController.markAsRead);

module.exports = router;
