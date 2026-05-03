const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat');
const { authenticate, optionalAuthenticate } = require('../middlewares/authenticate');
const { adminAuthenticate } = require('../middlewares/adminAuth');
const { chatLimiter } = require('../middlewares/rateLimiter');
const { validateRequest } = require('../middlewares/validateRequest');
const { sendMessageSchema } = require('../validators/chat');

// Admin lấy danh sách chat — bắt buộc xác thực + quyền admin
router.get('/admin/list', authenticate, adminAuthenticate, chatController.getAdminChatList);

// Gửi tin nhắn hỗ trợ (user/guest → admin) — validate content max 2000 ký tự, trả 422
router.post(
  '/',
  chatLimiter,
  optionalAuthenticate,
  validateRequest(sendMessageSchema, 422),
  chatController.sendMessage
);

// Lấy lịch sử chat — optionalAuthenticate để guest dùng được; chatLimiter chống enumeration
router.get('/:identifier', chatLimiter, optionalAuthenticate, chatController.getChatHistory);

// Đánh dấu cuộc hội thoại là đã đọc — optionalAuthenticate để guest dùng được
router.patch('/read/:identifier', optionalAuthenticate, chatController.markAsRead);

module.exports = router;
