const express = require('express');
const { optionalAuthenticate } = require('../../shared/http/middlewares/authenticate');
const { chatbotLimiter } = require('../../shared/http/middlewares/rateLimiter');

// AI module routes — basePath '/chatbot'. URL không đổi so với routes/chatbot.js cũ.
//
// Note: /analytics + /cart/add giữ ở legacy routes/chatbot.js. Module routes
// dùng authenticate per-route + KHÔNG router.use authenticate để fall-through
// legacy không bị block.
module.exports = ({ aiController }) => {
  const router = express.Router();

  router.post('/message', chatbotLimiter, optionalAuthenticate, aiController.handleMessage);
  router.post('/products/search', aiController.productSearch);
  router.get('/recommendations', optionalAuthenticate, aiController.getRecommendations);

  return router;
};
