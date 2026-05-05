const express = require('express');
const { authenticate, optionalAuthenticate } = require('../../shared/http/middlewares/authenticate');
const { adminAuthenticate } = require('../../shared/http/middlewares/adminAuth');
const { validateRequest } = require('../../shared/http/middlewares/validateRequest');
const { chatLimiter } = require('../../shared/http/middlewares/rateLimiter');
const { sendMessageSchema } = require('./validators/chatValidator');

// Chat module routes — basePath '/chat'. URL không đổi so với routes/chat.js cũ.
module.exports = ({ chatController }) => {
  const router = express.Router();

  router.get('/admin/list', authenticate, adminAuthenticate, chatController.getAdminChatList);
  router.post('/', optionalAuthenticate, validateRequest(sendMessageSchema), chatController.sendMessage);
  router.get('/:identifier', chatLimiter, optionalAuthenticate, chatController.getChatHistory);
  router.patch('/read/:identifier', optionalAuthenticate, chatController.markAsRead);

  return router;
};
