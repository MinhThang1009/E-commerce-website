const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authenticate } = require('../middlewares/authenticate');
const { adminAuthenticate } = require('../middlewares/adminAuth');

// All routes require authentication
router.use(authenticate);

// Admin Get Chat List (Put before :userId to avoid routing match conflict)
router.get('/admin/list', adminAuthenticate, chatController.getAdminChatList);

// User/Admin Get chat history
router.get('/:identifier', chatController.getChatHistory);

// Mark conversation as read
router.patch('/read/:identifier', chatController.markAsRead);

module.exports = router;
