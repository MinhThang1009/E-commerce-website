const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat');
const { authenticate, optionalAuthenticate } = require('../middlewares/authenticate');
const { adminAuthenticate } = require('../middlewares/adminAuth');
const { chatLimiter } = require('../middlewares/rateLimiter');

// Admin lấy danh sách chat — bắt buộc xác thực + quyền admin
router.get('/admin/list', authenticate, adminAuthenticate, chatController.getAdminChatList);

// Lấy lịch sử chat — optionalAuthenticate để guest dùng được; chatLimiter chống enumeration
router.get('/:identifier', chatLimiter, optionalAuthenticate, chatController.getChatHistory);

// Đánh dấu cuộc hội thoại là đã đọc — optionalAuthenticate để guest dùng được
router.patch('/read/:identifier', optionalAuthenticate, chatController.markAsRead);

module.exports = router;
