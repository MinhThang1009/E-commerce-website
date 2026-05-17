const express = require('express');
const { optionalAuthenticate, authenticate } = require('../../shared/http/middlewares/authenticate');
const { chatbotLimiter } = require('../../shared/http/middlewares/rateLimiter');

// AI module routes — basePath '/chatbot'. Đã migrate đầy đủ từ routes/chatbot.js.
module.exports = ({ aiController }) => {
  const router = express.Router();

  router.post('/message',          chatbotLimiter, optionalAuthenticate, aiController.handleMessage);
  router.post('/products/search',  aiController.productSearch);
  router.get('/recommendations',   optionalAuthenticate, aiController.getRecommendations);
  router.post('/analytics',        authenticate, aiController.trackAnalytics);
  router.post('/cart/add',         authenticate, aiController.addToCart);

  return router;
};
