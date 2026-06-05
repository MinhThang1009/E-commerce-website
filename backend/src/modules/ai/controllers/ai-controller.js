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

  clearSession = async (req, res) => {
    const { sessionId } = req.body;
    const cleared = this.aiService.clearSession(sessionId);
    res.json({ status: 'success', message: cleared ? 'Session đã xóa' : 'Session không tồn tại' });
  };

  registerSession = async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.json({ status: 'fail', message: 'sessionId required' });
    this.aiService.registerSession(sessionId);
    res.json({ status: 'success' });
  };

  getSessionMessages = async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const messages = await this.aiService.getSessionMessages(sessionId);
      res.json({ status: 'success', data: { sessionId, messages } });
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
