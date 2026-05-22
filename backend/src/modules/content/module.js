/**
 * @file module.js
 * @layer Module
 * @module content
 * @description Entry point content module — khởi tạo dependencies và đăng ký routes
 */
const ContentController = require('@modules/content/controllers/content-controller');
const ContentService = require('@modules/content/services/content-service');
const SequelizeContentRepository = require('@modules/content/repositories/sequelize-content-repository');
const buildRoutes = require('@modules/content/routes');

// Content module — chỉ còn contact/feedback. Banner và News đã bị xóa.
module.exports = ({ Feedback, emailService, eventBus, logger, adminEmail }) => {
  if (!Feedback) throw new Error('content module: Feedback model bắt buộc');

  const contentRepository = new SequelizeContentRepository({
    Feedback,
  });

  // Adapter: nodemailer-based email service → IEmailGateway port.
  const emailGateway = {
    sendAdminFeedbackNotification: (...args) => emailService.sendAdminFeedbackNotification(...args),
  };

  const contentService = new ContentService({
    contentRepository,
    emailGateway,
    eventBus,
    logger,
    adminEmail: adminEmail || process.env.ADMIN_EMAIL,
  });
  const contentController = new ContentController({ contentService });
  const routes = buildRoutes({ contentController });

  return {
    basePath: '/contact',
    router: routes.contact,
    subscribeEvents() {},
  };
};
