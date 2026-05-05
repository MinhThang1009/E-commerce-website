const express = require('express');
const { authenticate } = require('../../shared/http/middlewares/authenticate');
const { authorize } = require('../../shared/http/middlewares/authorize');
const { validateRequest } = require('../../shared/http/middlewares/validateRequest');
const { httpCacheHeaders } = require('../../shared/http/middlewares/cache');
const {
  createBannerSchema, updateBannerSchema,
  createNewsSchema, updateNewsSchema,
  newsletterSchema, feedbackSchema,
} = require('./validators/contentValidator');

// Content module: 5 sub-domain với URL prefix khác nhau (/banners, /news,
// /email-campaigns, /newsletter, /contact). Module.js wire 5 router riêng,
// app.js mount mỗi router tại đúng path tương ứng (như legacy routes/index).
module.exports = ({ contentController }) => {
  const banner = express.Router();
  banner.get('/', httpCacheHeaders(900), contentController.getAllBanners);
  banner.get('/:id', httpCacheHeaders(900), contentController.getBannerById);
  banner.use(authenticate);
  banner.use(authorize('admin'));
  banner.post('/', validateRequest(createBannerSchema, 422), contentController.createBanner);
  banner.patch('/:id', validateRequest(updateBannerSchema, 422), contentController.updateBanner);
  banner.delete('/:id', contentController.deleteBanner);

  const news = express.Router();
  news.get('/', contentController.getAllNews);
  news.get('/slug/:slug', contentController.getNewsBySlug);
  news.get('/slug/:slug/related', contentController.getRelatedNews);
  news.get('/:id', contentController.getNewsById);
  news.post(
    '/',
    authenticate,
    authorize('admin'),
    validateRequest(createNewsSchema, 422),
    contentController.createNews
  );
  news.put(
    '/:id',
    authenticate,
    authorize('admin'),
    validateRequest(updateNewsSchema, 422),
    contentController.updateNews
  );
  news.delete(
    '/:id',
    authenticate,
    authorize('admin'),
    contentController.deleteNews
  );

  const campaigns = express.Router();
  campaigns.use(authenticate);
  campaigns.use(authorize('admin'));
  campaigns.get('/', contentController.getAllCampaigns);
  campaigns.post('/', contentController.createCampaign);
  campaigns.post('/:id/send', contentController.sendCampaign);
  campaigns.delete('/:id', contentController.deleteCampaign);

  const newsletter = express.Router();
  newsletter.post('/subscribe', validateRequest(newsletterSchema, 422), contentController.subscribeNewsletter);

  const contact = express.Router();
  contact.post('/newsletter', validateRequest(newsletterSchema, 422), contentController.subscribeNewsletter);
  contact.post('/feedback', validateRequest(feedbackSchema, 422), contentController.sendFeedback);

  return { banner, news, campaigns, newsletter, contact };
};
