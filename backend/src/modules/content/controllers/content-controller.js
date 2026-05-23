/**
 * @file contentController.js
 * @layer Controller
 * @module content
 * @description Xử lý HTTP request/response cho contact/feedback
 */
const { t } = require('@utils/i18n');

class ContentController {
  constructor({ contentService }) {
    this.contentService = contentService;
  }

  sendFeedback = async (req, res, next) => {
    try {
      const feedback = await this.contentService.sendFeedback({ payload: req.body });
      res.status(201).json({
        status: 'success',
        message: t('content.feedbackReceived', req.locale),
        data: feedback,
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ContentController;
