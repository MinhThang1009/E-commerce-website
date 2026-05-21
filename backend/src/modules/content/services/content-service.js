/**
 * @file contentService.js
 * @layer Service
 * @module content
 * @description Business logic layer cho content
 */
const { AppError } = require('@shared/errors');

// Content Service — gộp 3 sub-domain (banner, news, feedback). Cache busting
// cho banner public list, fire-and-forget email cho feedback.
class ContentService {
  constructor({ contentRepository, emailGateway, cacheStore, eventBus, logger, adminEmail }) {
    this.contentRepository = contentRepository;
    this.emailGateway = emailGateway;
    this.cacheStore = cacheStore;
    this.eventBus = eventBus;
    this.logger = logger;
    this.adminEmail = adminEmail;
    this.CACHE_TTL_BANNERS = 60 * 60;
    this.CACHE_TTL_NEWS_LIST = 15 * 60;
    this.CACHE_TTL_NEWS_DETAIL = 30 * 60;
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
    const cacheKey = `news:list:${page}:${lim}:${isPublished ?? ''}:${category || ''}:${search || ''}`;
    if (this.cacheStore && !search) {
      const cached = await this.cacheStore.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    const filter = {};
    if (search) filter.search = search;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
    if (category && category !== 'Tất cả') filter.category = category;

    const { count, rows } = await this.contentRepository.findAllNews({
      filter,
      limit: lim,
      offset: off,
    });
    const data = {
      count,
      totalPages: Math.ceil(count / lim),
      currentPage: parseInt(page, 10),
      news: rows,
    };
    if (this.cacheStore && !search) {
      await this.cacheStore.setEx(cacheKey, this.CACHE_TTL_NEWS_LIST, JSON.stringify(data));
    }
    return data;
  }

  async getNewsBySlug({ slug }) {
    const cacheKey = `news:detail:${slug}`;
    if (this.cacheStore) {
      const cached = await this.cacheStore.get(cacheKey);
      if (cached) {
        // Vẫn increment view kể cả khi trả cache
        const news = await this.contentRepository.findNewsById(JSON.parse(cached).id, {
          withAuthor: false,
        });
        if (news) this.contentRepository.incrementNewsView(news).catch(() => {});
        return JSON.parse(cached);
      }
    }
    const news = await this.contentRepository.findNewsBySlug(slug);
    if (!news) return null;
    await this.contentRepository.incrementNewsView(news);
    if (this.cacheStore) {
      await this.cacheStore.setEx(cacheKey, this.CACHE_TTL_NEWS_DETAIL, JSON.stringify(news));
    }
    return news;
  }

  async getRelatedNews({ slug }) {
    const currentNews = await this.contentRepository.findNewsBySlugMin(slug);
    if (!currentNews) return null;

    const attributes = [
      'id',
      'titleVi',
      'titleEn',
      'slug',
      'thumbnail',
      'categoryVi',
      'categoryEn',
      'createdAt',
      'viewCount',
    ];
    let related = await this.contentRepository.findNewsByCategory(
      currentNews.categoryVi,
      currentNews.id,
      attributes,
    );

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
    const { slug: rawSlug, title } = payload;
    // Auto-generate slug từ title nếu không truyền
    const baseSlug =
      rawSlug ||
      (title || '')
        .toLowerCase()
        .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
        .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
        .replace(/[ìíịỉĩ]/g, 'i')
        .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
        .replace(/[ùúụủũưừứựửữ]/g, 'u')
        .replace(/[ỳýỵỷỹ]/g, 'y')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 90);
    const slug = baseSlug + (rawSlug ? '' : `-${Date.now().toString(36)}`);

    if (rawSlug) {
      const existing = await this.contentRepository.findNewsBySlug(slug, { withAuthor: false });
      if (existing) throw new AppError('content.slugExists', 400);
    }
    const created = await this.contentRepository.createNews({
      ...payload,
      slug,
      category: payload.category || 'Tin tức',
      isPublished: payload.isPublished === undefined ? true : payload.isPublished,
      userId,
    });
    await this._invalidateNewsCache();
    return created;
  }

  async updateNews({ id, patch }) {
    const news = await this.contentRepository.findNewsById(id, { withAuthor: false });
    if (!news) return null;

    if (patch.slug && patch.slug !== news.slug) {
      const existing = await this.contentRepository.findNewsBySlug(patch.slug, {
        withAuthor: false,
      });
      if (existing) throw new AppError('content.slugExists', 400);
    }

    Object.assign(news, patch);
    await this.contentRepository.saveNews(news);
    await this._invalidateNewsCache(news.slug);
    return news;
  }

  async deleteNews({ id }) {
    const news = await this.contentRepository.findNewsById(id, { withAuthor: false });
    if (!news) return null;
    await this.contentRepository.deleteNews(news);
    await this._invalidateNewsCache(news.slug);
    return true;
  }

  async _invalidateNewsCache(slug) {
    if (!this.cacheStore) return;
    try {
      if (this.cacheStore.delPattern) await this.cacheStore.delPattern('news:list:*');
      if (slug) await this.cacheStore.del(`news:detail:${slug}`);
    } catch (err) {
      this.logger.warn('Xóa cache news thất bại:', err.message);
    }
  }

  // ---------- Feedback ----------

  async sendFeedback({ payload }) {
    const { name, email, phone, subject, content } = payload;
    if (!name || !email || !subject || !content) {
      throw new AppError('content.requiredFieldsMissing', 400);
    }

    const feedback = await this.contentRepository.createFeedback({
      name,
      email,
      phone,
      subject,
      content,
      status: 'pending',
    });

    if (this.adminEmail) {
      this.emailGateway
        .sendAdminFeedbackNotification(this.adminEmail, {
          name,
          email,
          subject,
          content,
        })
        .catch((err) => {
          this.logger.error('Lỗi gửi email thông báo phản hồi cho admin:', err.message);
        });
    }

    return feedback;
  }
}

module.exports = ContentService;
