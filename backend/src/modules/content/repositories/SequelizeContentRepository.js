const { Op } = require('sequelize');
const IContentRepository = require('./IContentRepository');

class SequelizeContentRepository extends IContentRepository {
  constructor({ Banner, News, EmailCampaign, NewsletterSubscriber, Feedback, User }) {
    super();
    this.Banner = Banner;
    this.News = News;
    this.EmailCampaign = EmailCampaign;
    this.NewsletterSubscriber = NewsletterSubscriber;
    this.Feedback = Feedback;
    this.User = User;
  }

  // -------- Banner --------

  async findAllBanners(where = {}) {
    return this.Banner.findAll({
      where,
      order: [['priority', 'DESC'], ['createdAt', 'DESC']],
    });
  }

  async findBannerById(id) {
    return this.Banner.findByPk(id);
  }

  async createBanner(payload) {
    return this.Banner.create(payload);
  }

  async saveBanner(banner) {
    return banner.save();
  }

  async deleteBanner(banner) {
    return banner.destroy();
  }

  // -------- News --------

  // filter: { search?, isPublished?, category? } — repo build Op.like internal
  // để service tránh phụ thuộc sequelize Op trực tiếp.
  async findAllNews({ filter = {}, limit, offset } = {}) {
    const where = {};
    if (filter.search) where.title = { [Op.like]: `%${filter.search}%` };
    if (filter.isPublished !== undefined) where.isPublished = filter.isPublished;
    if (filter.category) where.category = filter.category;

    return this.News.findAndCountAll({
      where,
      limit, offset,
      order: [['createdAt', 'DESC']],
      include: [{
        model: this.User, as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'avatar', 'email'],
      }],
    });
  }

  async findNewsBySlug(slug, { withAuthor = true } = {}) {
    return this.News.findOne({
      where: { slug },
      ...(withAuthor && {
        include: [{
          model: this.User, as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'avatar'],
        }],
      }),
    });
  }

  async findNewsBySlugMin(slug) {
    return this.News.findOne({ where: { slug }, attributes: ['id', 'category'] });
  }

  async findNewsById(id, { withAuthor = true } = {}) {
    return this.News.findByPk(id, {
      ...(withAuthor && {
        include: [{
          model: this.User, as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'avatar'],
        }],
      }),
    });
  }

  async findNewsByCategory(category, excludeId, attributes) {
    return this.News.findAll({
      where: {
        category,
        id: { [Op.ne]: excludeId },
        isPublished: true,
      },
      limit: 3,
      order: [['createdAt', 'DESC']],
      attributes,
    });
  }

  async findLatestNews(excludeIds, attributes, limit = 3) {
    return this.News.findAll({
      where: {
        id: { [Op.notIn]: excludeIds },
        isPublished: true,
      },
      limit,
      order: [['createdAt', 'DESC']],
      attributes,
    });
  }

  async createNews(payload) {
    return this.News.create(payload);
  }

  async saveNews(news) {
    return news.save();
  }

  async deleteNews(news) {
    return news.destroy();
  }

  async incrementNewsView(news) {
    return news.increment('viewCount');
  }

  // -------- EmailCampaign --------

  async findAllCampaigns() {
    return this.EmailCampaign.findAll({ order: [['createdAt', 'DESC']] });
  }

  async findCampaignById(id) {
    return this.EmailCampaign.findByPk(id);
  }

  async createCampaign(payload) {
    return this.EmailCampaign.create(payload);
  }

  async saveCampaign(campaign) {
    return campaign.save();
  }

  async deleteCampaign(campaign) {
    return campaign.destroy();
  }

  async findActiveSubscriberEmails() {
    return this.NewsletterSubscriber.findAll({
      where: { status: 'active' },
      attributes: ['email'],
    });
  }

  async findAllUserEmails() {
    return this.User.findAll({ attributes: ['email'] });
  }

  // -------- Newsletter --------

  async findOrCreateSubscriber(email) {
    const [subscriber, created] = await this.NewsletterSubscriber.findOrCreate({
      where: { email },
      defaults: { status: 'active' },
    });
    return { subscriber, created };
  }

  async saveSubscriber(subscriber) {
    return subscriber.save();
  }

  // -------- Feedback --------

  async createFeedback(payload) {
    return this.Feedback.create(payload);
  }
}

module.exports = SequelizeContentRepository;
