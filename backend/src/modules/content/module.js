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

// Content module — gộp 3 sub-domain. Trả `mounts` array để app.js mount nhiều
// path khác nhau (banner/news/contact).
module.exports = ({
  Banner,
  News,
  Feedback,
  User,
  emailService,
  redisClient,
  eventBus,
  logger,
  adminEmail,
}) => {
  if (!Banner) throw new Error('content module: Banner model bắt buộc');
  if (!News) throw new Error('content module: News model bắt buộc');
  if (!Feedback) throw new Error('content module: Feedback model bắt buộc');
  if (!User) throw new Error('content module: User model bắt buộc');

  const contentRepository = new SequelizeContentRepository({
    Banner,
    News,
    Feedback,
    User,
  });

  // Adapter: nodemailer-based email service → IEmailGateway port.
  const emailGateway = {
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
    contentRepository,
    emailGateway,
    cacheStore,
    eventBus,
    logger,
    adminEmail: adminEmail || process.env.ADMIN_EMAIL,
  });
  const contentController = new ContentController({ contentService });
  const routes = buildRoutes({ contentController });

  return {
    mounts: [
      { basePath: '/banners', router: routes.banner },
      { basePath: '/news', router: routes.news },
      { basePath: '/contact', router: routes.contact },
    ],
    subscribeEvents() {},
  };
};
