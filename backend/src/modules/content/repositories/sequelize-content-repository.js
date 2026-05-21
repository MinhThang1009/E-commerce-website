/**
 * @file SequelizeContentRepository.js
 * @layer Repository
 * @module content
 * @description Data access layer cho content
 */
const { Op } = require('sequelize');
const IContentRepository = require('@modules/content/repositories/i-content-repository');

class SequelizeContentRepository extends IContentRepository {
  constructor({ Banner, News, Feedback, User }) {
    super();
    this.Banner = Banner;
    this.News = News;
    this.Feedback = Feedback;
    this.User = User;
  }

  // -------- Banner --------

  async findAllBanners(where = {}) {
    return this.Banner.findAll({
      where,
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'DESC'],
      ],
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
    if (filter.search) where.titleVi = { [Op.like]: `%${filter.search}%` };
    if (filter.isPublished !== undefined) where.isPublished = filter.isPublished;
    if (filter.category) where.categoryVi = filter.category;

    return this.News.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: this.User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'avatar', 'email'],
        },
      ],
    });
  }

  async findNewsBySlug(slug, { withAuthor = true } = {}) {
    return this.News.findOne({
      where: { slug },
      ...(withAuthor && {
        include: [
          {
            model: this.User,
            as: 'author',
            attributes: ['id', 'firstName', 'lastName', 'avatar'],
          },
        ],
      }),
    });
  }

  async findNewsBySlugMin(slug) {
    return this.News.findOne({ where: { slug }, attributes: ['id', 'categoryVi'] });
  }

  async findNewsById(id, { withAuthor = true } = {}) {
    return this.News.findByPk(id, {
      ...(withAuthor && {
        include: [
          {
            model: this.User,
            as: 'author',
            attributes: ['id', 'firstName', 'lastName', 'avatar'],
          },
        ],
      }),
    });
  }

  async findNewsByCategory(category, excludeId, attributes) {
    return this.News.findAll({
      where: {
        categoryVi: category,
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

  // -------- Feedback --------

  async createFeedback(payload) {
    return this.Feedback.create(payload);
  }
}

module.exports = SequelizeContentRepository;
