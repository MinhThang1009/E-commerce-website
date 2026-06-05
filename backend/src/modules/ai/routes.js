/**
 * @file routes.js
 * @layer Route
 * @module ai
 * @description HTTP endpoints của ai
 */
const express = require('express');
const { optionalAuthenticate, authenticate } = require('@middlewares/authenticate');
const { chatbotLimiter } = require('@middlewares/rate-limiter');
const { validateRequest } = require('@middlewares/validate-request');
const { chatMessageSchema } = require('@modules/ai/validators/ai-validator');

// AI module routes — basePath '/chatbot'. Đã migrate đầy đủ từ routes/chatbot.js.
module.exports = ({ aiController }) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/chatbot/message:
   *   post:
   *     summary: Gửi tin nhắn tới chatbot AI
   *     tags: [AI Chatbot]
   */
  router.post(
    '/message',
    chatbotLimiter,
    optionalAuthenticate,
    validateRequest(chatMessageSchema),
    aiController.handleMessage,
  );
  /**
   * @swagger
   * /api/chatbot/cart/add:
   *   post:
   *     summary: Thêm sản phẩm vào giỏ hàng qua chatbot
   *     tags: [AI Chatbot]
   *     security:
   *       - bearerAuth: []
   */
  router.post('/cart/add', authenticate, aiController.addToCart);

  /**
   * @swagger
   * /api/chatbot/session/clear:
   *   post:
   *     summary: Xóa lịch sử session chatbot (demo/debug)
   *     tags: [AI Chatbot]
   */
  router.post('/session/clear', aiController.clearSession);
  router.post('/session/register', aiController.registerSession);
  router.get('/session/:sessionId/messages', aiController.getSessionMessages);

  return router;
};
