// Content Controller — gộp 5 sub-domain. Trả response shape giữ nguyên cũ
// (banner trả {status,results,data}; news trả {success,...}; campaign trả
// {status,data}) để không break FE/test.
class ContentController {
  constructor({ contentService }) {
    this.contentService = contentService;
  }

  // ---------- Banner ----------

  getAllBanners = async (req, res, next) => {
    try {
      const payload = await this.contentService.getAllBanners(req.query);
      res.status(200).json(payload);
    } catch (err) { next(err); }
  };

  getBannerById = async (req, res, next) => {
    try {
      const banner = await this.contentService.getBannerById({ id: req.params.id });
      res.status(200).json({ status: 'success', data: banner });
    } catch (err) { next(err); }
  };

  createBanner = async (req, res, next) => {
    try {
      const banner = await this.contentService.createBanner({ payload: req.body });
      res.status(201).json({ status: 'success', data: banner });
    } catch (err) { next(err); }
  };

  updateBanner = async (req, res, next) => {
    try {
      const banner = await this.contentService.updateBanner({ id: req.params.id, patch: req.body });
      res.status(200).json({ status: 'success', data: banner });
    } catch (err) { next(err); }
  };

  deleteBanner = async (req, res, next) => {
    try {
      await this.contentService.deleteBanner({ id: req.params.id });
      res.status(204).json({ status: 'success', data: null });
    } catch (err) { next(err); }
  };

  // ---------- News ----------

  getAllNews = async (req, res) => {
    try {
      const data = await this.contentService.getAllNews(req.query);
      res.json({ status: 'success', ...data });
    } catch (error) {
      // Match legacy: log + 500 (không dùng next vì legacy controller cũng vậy)
      res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
    }
  };

  getNewsBySlug = async (req, res) => {
    try {
      const news = await this.contentService.getNewsBySlug({ slug: req.params.slug });
      if (!news) return res.status(404).json({ status: 'error', message: 'Không tìm thấy tin tức' });
      res.json({ status: 'success', news });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
    }
  };

  getRelatedNews = async (req, res) => {
    try {
      const news = await this.contentService.getRelatedNews({ slug: req.params.slug });
      if (news === null) return res.status(404).json({ status: 'error', message: 'Không tìm thấy tin tức' });
      res.json({ status: 'success', news });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
    }
  };

  getNewsById = async (req, res) => {
    try {
      const news = await this.contentService.getNewsById({ id: req.params.id });
      if (!news) return res.status(404).json({ status: 'error', message: 'Không tìm thấy tin tức' });
      res.json({ status: 'success', news });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
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
      res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
    }
  };

  updateNews = async (req, res) => {
    try {
      const news = await this.contentService.updateNews({ id: req.params.id, patch: req.body });
      if (!news) return res.status(404).json({ status: 'error', message: 'Không tìm thấy tin tức' });
      res.json({ status: 'success', news });
    } catch (error) {
      if (error.statusCode === 400) {
        return res.status(400).json({ status: 'error', message: error.message });
      }
      res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
    }
  };

  deleteNews = async (req, res) => {
    try {
      const result = await this.contentService.deleteNews({ id: req.params.id });
      if (!result) return res.status(404).json({ status: 'error', message: 'Không tìm thấy tin tức' });
      res.json({ status: 'success', message: 'Tin tức đã được xóa thành công' });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
    }
  };

  // ---------- Email Campaign ----------

  getAllCampaigns = async (req, res, next) => {
    try {
      const campaigns = await this.contentService.getAllCampaigns();
      res.status(200).json({ status: 'success', results: campaigns.length, data: campaigns });
    } catch (err) { next(err); }
  };

  createCampaign = async (req, res, next) => {
    try {
      const campaign = await this.contentService.createCampaign({ payload: req.body });
      res.status(201).json({ status: 'success', data: campaign });
    } catch (err) { next(err); }
  };

  sendCampaign = async (req, res, next) => {
    try {
      const { campaign, recipientCount } = await this.contentService.sendCampaign({ id: req.params.id });
      res.status(200).json({
        status: 'success',
        message: `Đã gửi thành công chiến dịch tới ${recipientCount} người nhận`,
        data: campaign,
      });
    } catch (err) { next(err); }
  };

  deleteCampaign = async (req, res, next) => {
    try {
      await this.contentService.deleteCampaign({ id: req.params.id });
      res.status(204).json({ status: 'success', data: null });
    } catch (err) { next(err); }
  };

  // ---------- Newsletter ----------

  subscribeNewsletter = async (req, res, next) => {
    try {
      const result = await this.contentService.subscribeNewsletter({ email: req.body.email });
      res.status(result.statusCode).json({ status: 'success', message: result.message });
    } catch (err) { next(err); }
  };

  // ---------- Feedback ----------

  sendFeedback = async (req, res, next) => {
    try {
      const feedback = await this.contentService.sendFeedback({ payload: req.body });
      res.status(201).json({
        status: 'success',
        message: 'Cảm ơn bạn đã gửi phản hồi. Chúng tôi sẽ xem xét sớm!',
        data: feedback,
      });
    } catch (err) { next(err); }
  };
}

module.exports = ContentController;
