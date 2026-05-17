/**
 * @file module.js
 * @layer Module
 * @module content
 * @description Entry point content module — khởi tạo dependencies và đăng ký routes
 */
const ContentController = require('./controllers/contentController');
const ContentService = require('./services/contentService');
const SequelizeContentRepository = require('./repositories/SequelizeContentRepository');
const buildRoutes = require('./routes');

// Content module — gộp 5 sub-domain. Trả `mounts` array để app.js mount nhiều
// path khác nhau (banner/news/email-campaigns/newsletter/contact).
module.exports = ({
  Banner, News, EmailCampaign, NewsletterSubscriber, Feedback, User,
  emailService, redisClient, eventBus, logger, adminEmail,
}) => {
  if (!Banner) throw new Error('content module: Banner model bắt buộc');
  if (!News) throw new Error('content module: News model bắt buộc');
  if (!EmailCampaign) throw new Error('content module: EmailCampaign model bắt buộc');
  if (!NewsletterSubscriber) throw new Error('content module: NewsletterSubscriber bắt buộc');
  if (!Feedback) throw new Error('content module: Feedback model bắt buộc');
  if (!User) throw new Error('content module: User model bắt buộc');

  const contentRepository = new SequelizeContentRepository({
    Banner, News, EmailCampaign, NewsletterSubscriber, Feedback, User,
  });

  // Adapter: nodemailer-based email service → IEmailGateway port (4 method dùng).
  const emailGateway = {
    sendBulkCampaignEmail: (...args) => emailService.sendBulkCampaignEmail(...args),
    sendNewsletterWelcomeEmail: (...args) => emailService.sendNewsletterWelcomeEmail(...args),
    sendAdminFeedbackNotification: (...args) => emailService.sendAdminFeedbackNotification(...args),
  };

  // Adapter: Redis (cache store cho banner public list) — async factory; method
  // resolve client mỗi call để follow reconnect.
  const cacheStore = redisClient
    ? {
      async get(key) {
        const c = await redisClient();
        return c?.get?.(key) ?? null;
      },
      async setEx(key, ttl, val) {
        const c = await redisClient();
        if (c?.setEx) await c.setEx(key, ttl, val);
      },
      async del(key) {
        const c = await redisClient();
        if (c?.del) await c.del(key);
      },
    }
    : null;

  const contentService = new ContentService({
    contentRepository, emailGateway, cacheStore,
    eventBus, logger,
    adminEmail: adminEmail || process.env.ADMIN_EMAIL,
  });
  const contentController = new ContentController({ contentService });
  const routes = buildRoutes({ contentController });

  return {
    mounts: [
      { basePath: '/banners', router: routes.banner },
      { basePath: '/news', router: routes.news },
      { basePath: '/email-campaigns', router: routes.campaigns },
      { basePath: '/newsletter', router: routes.newsletter },
      { basePath: '/contact', router: routes.contact },
    ],
    subscribeEvents() {},
  };
};
