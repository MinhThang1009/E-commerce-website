const { AppError } = require('../../../shared/errors');

// Content Service — gộp 5 sub-domain. Cache busting cho banner public list,
// fire-and-forget email cho newsletter + feedback, batch send cho campaign.
class ContentService {
  constructor({ contentRepository, emailGateway, cacheStore, eventBus, logger, adminEmail }) {
    this.contentRepository = contentRepository;
    this.emailGateway = emailGateway;
    this.cacheStore = cacheStore;
    this.eventBus = eventBus;
    this.logger = logger;
    this.adminEmail = adminEmail;
    this.CACHE_TTL_BANNERS = 60 * 60;
  }

  // ---------- Banner ----------

  async getAllBanners({ position, isActive }) {
    const where = {};
    if (position) where.position = position;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const isActiveOnlyQuery = isActive === 'true' && !position;
    const cacheKey = isActiveOnlyQuery ? 'banners:active' : null;

    if (cacheKey && this.cacheStore) {
      const cached = await this.cacheStore.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    const banners = await this.contentRepository.findAllBanners(where);
    const payload = { status: 'success', results: banners.length, data: banners };

    if (cacheKey && this.cacheStore) {
      await this.cacheStore.setEx(cacheKey, this.CACHE_TTL_BANNERS, JSON.stringify(payload));
    }
    return payload;
  }

  async getBannerById({ id }) {
    const banner = await this.contentRepository.findBannerById(id);
    if (!banner) throw new AppError('content.bannerNotFound', 404);
    return banner;
  }

  async createBanner({ payload }) {
    const banner = await this.contentRepository.createBanner(payload);
    await this._invalidateBannerCache();
    return banner;
  }

  async updateBanner({ id, patch }) {
    const banner = await this.contentRepository.findBannerById(id);
    if (!banner) throw new AppError('content.bannerNotFound', 404);
    Object.assign(banner, patch);
    await this.contentRepository.saveBanner(banner);
    await this._invalidateBannerCache();
    return banner;
  }

  async deleteBanner({ id }) {
    const banner = await this.contentRepository.findBannerById(id);
    if (!banner) throw new AppError('content.bannerNotFound', 404);
    await this.contentRepository.deleteBanner(banner);
    await this._invalidateBannerCache();
  }

  async _invalidateBannerCache() {
    if (!this.cacheStore) return;
    try {
      await this.cacheStore.del('banners:active');
    } catch (err) {
      this.logger.warn('Xóa cache banners:active thất bại:', err.message);
    }
  }

  // ---------- News ----------

  async getAllNews({ page = 1, limit = 10, search, isPublished, category }) {
    const lim = parseInt(limit, 10);
    const off = (parseInt(page, 10) - 1) * lim;

    // Service truyền filter plain (search/isPublished/category); repo build
    // Op.like internal — service không phụ thuộc Sequelize Op.
    const filter = {};
    if (search) filter.search = search;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
    if (category && category !== 'Tất cả') filter.category = category;

    const { count, rows } = await this.contentRepository.findAllNews({
      filter, limit: lim, offset: off,
    });
    return {
      count, totalPages: Math.ceil(count / lim),
      currentPage: parseInt(page, 10), news: rows,
    };
  }

  async getNewsBySlug({ slug }) {
    const news = await this.contentRepository.findNewsBySlug(slug);
    if (!news) return null;
    await this.contentRepository.incrementNewsView(news);
    return news;
  }

  async getRelatedNews({ slug }) {
    const currentNews = await this.contentRepository.findNewsBySlugMin(slug);
    if (!currentNews) return null;

    const attributes = ['id', 'title', 'slug', 'thumbnail', 'category', 'createdAt', 'viewCount'];
    let related = await this.contentRepository.findNewsByCategory(currentNews.category, currentNews.id, attributes);

    if (related.length < 3) {
      const needed = 3 - related.length;
      const existingIds = [currentNews.id, ...related.map((n) => n.id)];
      const more = await this.contentRepository.findLatestNews(existingIds, attributes, needed);
      related = [...related, ...more];
    }
    return related;
  }

  async getNewsById({ id }) {
    return this.contentRepository.findNewsById(id);
  }

  async createNews({ userId, payload }) {
    const { slug } = payload;
    if (slug) {
      const existing = await this.contentRepository.findNewsBySlug(slug, { withAuthor: false });
      if (existing) {
        throw new AppError('content.slugExists', 400);
      }
    }
    return this.contentRepository.createNews({
      ...payload,
      category: payload.category || 'Tin tức',
      isPublished: payload.isPublished === undefined ? true : payload.isPublished,
      userId,
    });
  }

  async updateNews({ id, patch }) {
    const news = await this.contentRepository.findNewsById(id, { withAuthor: false });
    if (!news) return null;

    if (patch.slug && patch.slug !== news.slug) {
      const existing = await this.contentRepository.findNewsBySlug(patch.slug, { withAuthor: false });
      if (existing) throw new AppError('content.slugExists', 400);
    }

    Object.assign(news, patch);
    await this.contentRepository.saveNews(news);
    return news;
  }

  async deleteNews({ id }) {
    const news = await this.contentRepository.findNewsById(id, { withAuthor: false });
    if (!news) return null;
    await this.contentRepository.deleteNews(news);
    return true;
  }

  // ---------- Email Campaign ----------

  async getAllCampaigns() {
    return this.contentRepository.findAllCampaigns();
  }

  async createCampaign({ payload }) {
    return this.contentRepository.createCampaign(payload);
  }

  // Gửi campaign tới subscribers + users (dedupe email).
  async sendCampaign({ id }) {
    const campaign = await this.contentRepository.findCampaignById(id);
    if (!campaign) throw new AppError('content.campaignNotFound', 404);

    if (campaign.status === 'sent') {
      throw new AppError('content.campaignAlreadySent', 400);
    }

    this.logger.info(`[EmailCampaign] Đang xử lý chiến dịch #${campaign.id}: ${campaign.subject}`);

    const [subscribers, users] = await Promise.all([
      this.contentRepository.findActiveSubscriberEmails(),
      this.contentRepository.findAllUserEmails(),
    ]);

    const subscriberEmails = subscribers.map((s) => s.email.toLowerCase().trim());
    const userEmails = users.map((u) => u.email.toLowerCase().trim());
    const uniqueEmails = [...new Set([...subscriberEmails, ...userEmails])];

    this.logger.info(`[EmailCampaign] Tổng người nhận duy nhất: ${uniqueEmails.length}`);

    if (uniqueEmails.length > 0) {
      try {
        await this.emailGateway.sendBulkCampaignEmail(uniqueEmails, campaign.subject, campaign.content);
      } catch (err) {
        this.logger.error(`[EmailCampaign] Lỗi gửi: ${err.message}`);
        throw new AppError('content.emailSendFailed', 500, { details: err.message });
      }
    }

    campaign.status = 'sent';
    campaign.sentAt = new Date();
    await this.contentRepository.saveCampaign(campaign);

    return { campaign, recipientCount: uniqueEmails.length };
  }

  async deleteCampaign({ id }) {
    const campaign = await this.contentRepository.findCampaignById(id);
    if (!campaign) throw new AppError('content.campaignNotFound', 404);
    await this.contentRepository.deleteCampaign(campaign);
  }

  // ---------- Newsletter ----------

  async subscribeNewsletter({ email }) {
    if (!email) throw new AppError('content.emailRequired', 400);

    const { subscriber, created } = await this.contentRepository.findOrCreateSubscriber(email);

    if (!created && subscriber.status === 'active') {
      return {
        statusCode: 200,
        message: 'content.alreadySubscribed',
      };
    }

    if (!created && subscriber.status === 'unsubscribed') {
      subscriber.status = 'active';
      await this.contentRepository.saveSubscriber(subscriber);
    }

    // Fire-and-forget welcome email
    this.emailGateway.sendNewsletterWelcomeEmail(email).catch((err) => {
      this.logger.error('Lỗi gửi email chào mừng:', err.message);
    });

    return {
      statusCode: created ? 201 : 200,
      message: 'content.subscribedSuccess',
    };
  }

  // ---------- Feedback ----------

  async sendFeedback({ payload }) {
    const { name, email, phone, subject, content } = payload;
    if (!name || !email || !subject || !content) {
      throw new AppError('content.requiredFieldsMissing', 400);
    }

    const feedback = await this.contentRepository.createFeedback({
      name, email, phone, subject, content, status: 'pending',
    });

    if (this.adminEmail) {
      this.emailGateway.sendAdminFeedbackNotification(this.adminEmail, {
        name, email, subject, content,
      }).catch((err) => {
        this.logger.error('Lỗi gửi email thông báo phản hồi cho admin:', err.message);
      });
    }

    return feedback;
  }
}

module.exports = ContentService;
