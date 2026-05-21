/**
 * @file contentController.js
 * @layer Controller
 * @module content
 * @description Xử lý HTTP request/response cho content
 */
const { t } = require('@utils/i18n');

// Content Controller — gộp 3 sub-domain (banner, news, feedback). Trả
// response shape giữ nguyên cũ (banner trả {status,results,data}; news trả
// {success,...}) để không break FE/test.
class ContentController {
  constructor({ contentService }) {
    this.contentService = contentService;
  }

  // ---------- Banner ----------

  getAllBanners = async (req, res, next) => {
    try {
      const payload = await this.contentService.getAllBanners(req.query);
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  };

  getBannerById = async (req, res, next) => {
    try {
      const banner = await this.contentService.getBannerById({ id: req.params.id });
      res.status(200).json({ status: 'success', data: banner });
    } catch (err) {
      next(err);
    }
  };

  createBanner = async (req, res, next) => {
    try {
      const banner = await this.contentService.createBanner({ payload: req.body });
      res.status(201).json({ status: 'success', data: banner });
    } catch (err) {
      next(err);
    }
  };

  updateBanner = async (req, res, next) => {
    try {
      const banner = await this.contentService.updateBanner({ id: req.params.id, patch: req.body });
      res.status(200).json({ status: 'success', data: banner });
    } catch (err) {
      next(err);
    }
  };

  deleteBanner = async (req, res, next) => {
    try {
      await this.contentService.deleteBanner({ id: req.params.id });
      res.status(204).json({ status: 'success', data: null });
    } catch (err) {
      next(err);
    }
  };

  // ---------- News ----------

  getAllNews = async (req, res) => {
    try {
      const data = await this.contentService.getAllNews(req.query);
      res.json({ status: 'success', ...data });
    } catch (error) {
      // Match legacy: log + 500 (không dùng next vì legacy controller cũng vậy)
      res.status(500).json({ status: 'error', message: t('content.serverError', req.locale) });
    }
  };

  getNewsBySlug = async (req, res) => {
    try {
      const news = await this.contentService.getNewsBySlug({ slug: req.params.slug });
      if (!news)
        return res
          .status(404)
          .json({ status: 'error', message: t('content.newsNotFound', req.locale) });
      res.json({ status: 'success', news });
    } catch (error) {
      res.status(500).json({ status: 'error', message: t('content.serverError', req.locale) });
    }
  };

  getRelatedNews = async (req, res) => {
    try {
      const news = await this.contentService.getRelatedNews({ slug: req.params.slug });
      if (news === null)
        return res
          .status(404)
          .json({ status: 'error', message: t('content.newsNotFound', req.locale) });
      res.json({ status: 'success', news });
    } catch (error) {
      res.status(500).json({ status: 'error', message: t('content.serverError', req.locale) });
    }
  };

  getNewsById = async (req, res) => {
    try {
      const news = await this.contentService.getNewsById({ id: req.params.id });
      if (!news)
        return res
          .status(404)
          .json({ status: 'error', message: t('content.newsNotFound', req.locale) });
      res.json({ status: 'success', news });
    } catch (error) {
      res.status(500).json({ status: 'error', message: t('content.serverError', req.locale) });
    }
  };

  createNews = async (req, res) => {
    try {
      const news = await this.contentService.createNews({ userId: req.user.id, payload: req.body });
      res.status(201).json({ status: 'success', news });
    } catch (error) {
      if (error.statusCode === 400) {
        return res.status(400).json({ status: 'error', message: error.message });
      }
      res.status(500).json({ status: 'error', message: t('content.serverError', req.locale) });
    }
  };

  updateNews = async (req, res) => {
    try {
      const news = await this.contentService.updateNews({ id: req.params.id, patch: req.body });
      if (!news)
        return res
          .status(404)
          .json({ status: 'error', message: t('content.newsNotFound', req.locale) });
      res.json({ status: 'success', news });
    } catch (error) {
      if (error.statusCode === 400) {
        return res.status(400).json({ status: 'error', message: error.message });
      }
      res.status(500).json({ status: 'error', message: t('content.serverError', req.locale) });
    }
  };

  deleteNews = async (req, res) => {
    try {
      const result = await this.contentService.deleteNews({ id: req.params.id });
      if (!result)
        return res
          .status(404)
          .json({ status: 'error', message: t('content.newsNotFound', req.locale) });
      res.json({ status: 'success', message: t('content.newsDeleted', req.locale) });
    } catch (error) {
      res.status(500).json({ status: 'error', message: t('content.serverError', req.locale) });
    }
  };

  // ---------- Feedback ----------

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
