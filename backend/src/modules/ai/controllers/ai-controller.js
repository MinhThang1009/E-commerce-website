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
      const { message, sessionId } = req.body;
      const userId = req.user?.id ?? null; // chỉ trust JWT, không nhận userId từ body
      const returnTrace = req.query?.trace === 'true';
      this.logger.info('Chatbot', { messageLength: message.length, userId, sessionId });
      const data = await this.aiService.handleMessage({
        message,
        userId,
        sessionId,
        enableTrace: true,
      });
      if (!returnTrace) delete data.trace;
      res.json({ status: 'success', data });
    } catch (err) {
      // 400 = expected user error (validation) → WARN; 5xx = unexpected → ERROR
      if (err.statusCode) {
        const level = err.statusCode < 500 ? 'warn' : 'error';
        this.logger[level]('Chatbot error:', { statusCode: err.statusCode, message: err.message });
        return res.status(err.statusCode).json({
          status: 'error',
          message: t(err.message, req.locale) ?? t('ai.messageFailed', req.locale),
        });
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

  clearSession = async (req, res, next) => {
    try {
      const { sessionId } = req.body;
      // Idempotent: always clear (DB + Map). 404 chỉ dùng cho session không tồn tại thật sự,
      // không dùng cho Map miss sau restart (DB rows vẫn được xóa bất kể Map state).
      await this.aiService.clearSession(sessionId);
      res.json({ status: 'success', message: t('ai.sessionCleared', req.locale) });
    } catch (err) {
      next(err);
    }
  };

  registerSession = async (req, res, next) => {
    try {
      const { sessionId } = req.body;
      this.aiService.registerSession(sessionId);
      // Ghi file tạm để demo script --watch detect session UI ngay lập tức
      try {
        const path = require('path');
        require('fs').writeFileSync(
          path.join(__dirname, '..', '..', '..', 'data', '.last-session-id'),
          sessionId,
          'utf8',
        );
      } catch {
        /* ignore — chỉ ảnh hưởng demo script */
      }
      res.json({ status: 'success' });
    } catch (err) {
      next(err);
    }
  };

  getSessionMessages = async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      // userId scope: authenticated users chỉ thấy messages của session mình; guest (null) không filter
      const userId = req.user?.id ?? null;
      const messages = await this.aiService.getSessionMessages(sessionId, userId);
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
