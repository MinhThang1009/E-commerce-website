/**
 * @file routes.js
 * @layer Route
 * @module ai
 * @description HTTP endpoints của ai
 */
const express = require('express');
const { optionalAuthenticate, authenticate } = require('@middlewares/authenticate');
const { chatbotLimiter } = require('@middlewares/rate-limiter');

// AI module routes — basePath '/chatbot'. Đã migrate đầy đủ từ routes/chatbot.js.
module.exports = ({ aiController }) => {
  const router = express.Router();

  router.post('/message', chatbotLimiter, optionalAuthenticate, aiController.handleMessage);
  router.get('/recommendations', optionalAuthenticate, aiController.getRecommendations);
  router.post('/analytics', authenticate, aiController.trackAnalytics);
  router.post('/cart/add', authenticate, aiController.addToCart);

  return router;
};
