/**
 * @file aiController.js
 * @layer Controller
 * @module ai
 * @description Xử lý HTTP request/response cho ai
 */
const { t } = require('@utils/i18n');

class AIController {
  constructor({ aiService, logger }) {
    this.aiService = aiService;
    this.logger = logger;
  }

  handleMessage = async (req, res) => {
    try {
      const { message, userId, sessionId } = req.body;
      if (!message || typeof message !== 'string') {
        return res
          .status(400)
          .json({ status: 'error', message: t('ai.messageInvalid', req.locale) });
      }
      this.logger.info('Chatbot', { messageLength: message.length, userId, sessionId });
      const data = await this.aiService.handleMessage({ message, userId, sessionId });
      res.json({ status: 'success', data });
    } catch (err) {
      // 400 = expected user error (validation) → WARN; 5xx = unexpected → ERROR
      if (err.statusCode === 400) {
        this.logger.warn('Chatbot input không hợp lệ:', { message: err.message });
        return res.status(400).json({ status: 'error', message: err.message });
      }
      this.logger.error('Lỗi chatbot:', err);
      res.status(500).json({
        status: 'error',
        message: t('ai.messageFailed', req.locale),
        data: {
          response: t('ai.fallbackResponse', req.locale),
          suggestions: [
            t('ai.suggestionsHot', req.locale),
            t('ai.suggestionsDeals', req.locale),
            t('ai.suggestionsSupport', req.locale),
          ],
        },
      });
    }
  };

  getRecommendations = async (req, res, next) => {
    try {
      const data = await this.aiService.getRecommendations(req.query);
      res.json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  trackAnalytics = async (req, res, next) => {
    try {
      const { event, userId, sessionId, productId, value, metadata } = req.body;
      await this.aiService.trackAnalytics({
        event,
        userId,
        sessionId,
        productId,
        value,
        metadata,
        timestamp: new Date(),
      });
      res.json({ status: 'success', message: t('ai.analyticsSaved', req.locale) });
    } catch (err) {
      next(err);
    }
  };

  addToCart = async (req, res, next) => {
    try {
      const { productId, variantId, quantity = 1, sessionId } = req.body;
      const data = await this.aiService.addToCart({
        productId,
        variantId,
        quantity,
        sessionId,
        userId: req.user.id,
      });
      res.json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AIController;
