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
   * /api/chatbot/recommendations:
   *   get:
   *     summary: Lấy gợi ý sản phẩm từ AI
   *     tags: [AI Chatbot]
   */
  router.get('/recommendations', optionalAuthenticate, aiController.getRecommendations);
  /**
   * @swagger
   * /api/chatbot/analytics:
   *   post:
   *     summary: Ghi nhận sự kiện analytics chatbot
   *     tags: [AI Chatbot]
   *     security:
   *       - bearerAuth: []
   */
  router.post('/analytics', authenticate, aiController.trackAnalytics);
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

  return router;
};
