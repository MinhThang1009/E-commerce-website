/**
 * @file routes.js
 * @layer Route
 * @module ai
 * @description HTTP endpoints của ai
 */
const express = require('express');
const { optionalAuthenticate, authenticate } = require('@middlewares/authenticate');
const { chatbotLimiter, chatLimiter } = require('@middlewares/rate-limiter');
const { validateRequest } = require('@middlewares/validate-request');
const {
  chatMessageSchema,
  cartAddSchema,
  sessionSchema,
} = require('@modules/ai/validators/ai-validator');

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
  router.post(
    '/message/stream',
    chatbotLimiter,
    optionalAuthenticate,
    validateRequest(chatMessageSchema),
    aiController.streamMessage,
  );
  // SSE: terminal kết nối để nhận pipeline events real-time khi UI gửi query
  router.get('/events', optionalAuthenticate, aiController.subscribeEvents);
  /**
   * @swagger
   * /api/chatbot/cart/add:
   *   post:
   *     summary: Thêm sản phẩm vào giỏ hàng qua chatbot
   *     tags: [AI Chatbot]
   *     security:
   *       - bearerAuth: []
   */
  // authenticate trước validateRequest: unauthenticated request nhận 401 trước khi parse body
  router.post(
    '/cart/add',
    chatbotLimiter,
    authenticate,
    validateRequest(cartAddSchema),
    aiController.addToCart,
  );

  /**
   * @swagger
   * /api/chatbot/session/clear:
   *   post:
   *     summary: Xóa lịch sử session chatbot (demo/debug)
   *     tags: [AI Chatbot]
   */
  // SECURITY MODEL (capability-based): sessionId là opaque UUID do client sinh — đây là access token
  // cho session đó. Guest và authenticated user đều dùng sessionId làm credential truy cập session
  // của mình. Không cần ownership check bổ sung vì sessionId không thể đoán (UUID v4, entropy 122 bit).
  // sessionSchema bắt buộc sessionId min(1) để ngăn clearSession(null) xóa toàn bộ server Map.
  router.post(
    '/session/clear',
    chatbotLimiter,
    optionalAuthenticate,
    validateRequest(sessionSchema),
    aiController.clearSession,
  );
  router.post(
    '/session/register',
    chatbotLimiter,
    optionalAuthenticate,
    validateRequest(sessionSchema),
    aiController.registerSession,
  );
  // chatLimiter (30 req/5 min) chuyên chống brute-force enumeration sessionId.
  // sessionSchema validate path param max(128) — ngăn oversized input tới DB query.
  router.get(
    '/session/:sessionId/messages',
    chatLimiter,
    optionalAuthenticate,
    validateRequest(sessionSchema, 400, 'params'),
    aiController.getSessionMessages,
  );

  return router;
};
