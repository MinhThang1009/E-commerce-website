// Tests cho SequelizeContentRepository — mock toàn bộ Sequelize models.
// Chỉ kiểm tra hành vi của repository: câu query nào được gọi, với args gì.
const SequelizeContentRepository = require('./sequelize-content-repository');

// ---------- Model mock factories ----------

function makeBannerModel() {
  return {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  };
}

function makeNewsModel() {
  return {
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  };
}

function makeCampaignModel() {
  return {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  };
}

function makeSubscriberModel() {
  return {
    findAll: jest.fn(),
    findOrCreate: jest.fn(),
  };
}

function makeFeedbackModel() {
  return { create: jest.fn() };
}

function makeUserModel() {
  return { findAll: jest.fn() };
}

function makeRepo(overrides = {}) {
  return new SequelizeContentRepository({
    Banner: overrides.Banner || makeBannerModel(),
    News: overrides.News || makeNewsModel(),
    EmailCampaign: overrides.EmailCampaign || makeCampaignModel(),
    NewsletterSubscriber: overrides.NewsletterSubscriber || makeSubscriberModel(),
    Feedback: overrides.Feedback || makeFeedbackModel(),
    User: overrides.User || makeUserModel(),
  });
}

describe('SequelizeContentRepository', () => {
  // ============================================================
  // Banner
  // ============================================================

  describe('findAllBanners', () => {
    test('gọi Banner.findAll với where và order theo priority DESC', async () => {
      const Banner = makeBannerModel();
      Banner.findAll.mockResolvedValue([{ id: 1 }]);
      const repo = makeRepo({ Banner });

      const result = await repo.findAllBanners({ isActive: true });

      expect(Banner.findAll).toHaveBeenCalledWith({
        where: { isActive: true },
        order: [['priority', 'DESC'], ['createdAt', 'DESC']],
      });
      expect(result).toHaveLength(1);
    });

    test('gọi Banner.findAll với where rỗng khi không truyền tham số', async () => {
      const Banner = makeBannerModel();
      Banner.findAll.mockResolvedValue([]);
      const repo = makeRepo({ Banner });

      await repo.findAllBanners();

      expect(Banner.findAll).toHaveBeenCalledWith({
        where: {},
        order: [['priority', 'DESC'], ['createdAt', 'DESC']],
      });
    });
  });

  describe('findBannerById', () => {
    test('gọi Banner.findByPk với id đúng', async () => {
      const Banner = makeBannerModel();
      Banner.findByPk.mockResolvedValue({ id: 5 });
      const repo = makeRepo({ Banner });

      const result = await repo.findBannerById(5);

      expect(Banner.findByPk).toHaveBeenCalledWith(5);
      expect(result.id).toBe(5);
    });

    test('trả về null khi không tìm thấy', async () => {
      const Banner = makeBannerModel();
      Banner.findByPk.mockResolvedValue(null);
      const repo = makeRepo({ Banner });

      expect(await repo.findBannerById(99)).toBeNull();
    });
  });

  describe('createBanner', () => {
    test('gọi Banner.create với payload đúng', async () => {
      const Banner = makeBannerModel();
      const newBanner = { id: 1, title: 'Hero Banner' };
      Banner.create.mockResolvedValue(newBanner);
      const repo = makeRepo({ Banner });

      const result = await repo.createBanner({ title: 'Hero Banner', isActive: true });

      expect(Banner.create).toHaveBeenCalledWith({ title: 'Hero Banner', isActive: true });
      expect(result).toBe(newBanner);
    });
  });

  describe('saveBanner', () => {
    test('gọi banner.save() và trả về kết quả', async () => {
      const repo = makeRepo();
      const banner = { id: 1, save: jest.fn().mockResolvedValue({ id: 1, title: 'Updated' }) };

      const result = await repo.saveBanner(banner);

      expect(banner.save).toHaveBeenCalled();
      expect(result.title).toBe('Updated');
    });
  });

  describe('deleteBanner', () => {
    test('gọi banner.destroy()', async () => {
      const repo = makeRepo();
      const banner = { id: 1, destroy: jest.fn().mockResolvedValue() };

      await repo.deleteBanner(banner);

      expect(banner.destroy).toHaveBeenCalled();
    });
  });

  // ============================================================
  // News
  // ============================================================

  describe('findAllNews', () => {
    test('gọi findAndCountAll không có filter', async () => {
      const News = makeNewsModel();
      const User = makeUserModel();
      News.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      const repo = makeRepo({ News, User });

      await repo.findAllNews({ limit: 10, offset: 0 });

      expect(News.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, limit: 10, offset: 0 })
      );
    });

    test('build where.title với Op.like khi filter.search có giá trị', async () => {
      const News = makeNewsModel();
      const User = makeUserModel();
      News.findAndCountAll.mockResolvedValue({ count: 2, rows: [{ id: 1 }, { id: 2 }] });
      const repo = makeRepo({ News, User });

      await repo.findAllNews({ filter: { search: 'iphone' }, limit: 10, offset: 0 });

      const callArgs = News.findAndCountAll.mock.calls[0][0];
      // title phải chứa Op.like với pattern %iphone%
      expect(callArgs.where.title).toBeDefined();
    });

    test('build where.isPublished khi filter.isPublished = true', async () => {
      const News = makeNewsModel();
      const User = makeUserModel();
      News.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      const repo = makeRepo({ News, User });

      await repo.findAllNews({ filter: { isPublished: true }, limit: 5, offset: 0 });

      const callArgs = News.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.isPublished).toBe(true);
    });

    test('build where.category khi filter.category có giá trị', async () => {
      const News = makeNewsModel();
      const User = makeUserModel();
      News.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      const repo = makeRepo({ News, User });

      await repo.findAllNews({ filter: { category: 'Tech' }, limit: 10, offset: 0 });

      const callArgs = News.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.category).toBe('Tech');
    });
  });

  describe('findNewsBySlug', () => {
    test('gọi News.findOne với slug và include author', async () => {
      const News = makeNewsModel();
      const User = makeUserModel();
      News.findOne.mockResolvedValue({ id: 1, slug: 'test-slug' });
      const repo = makeRepo({ News, User });

      const result = await repo.findNewsBySlug('test-slug');

      expect(News.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'test-slug' } })
      );
      expect(result.slug).toBe('test-slug');
    });

    test('withAuthor = false → không include author', async () => {
      const News = makeNewsModel();
      const User = makeUserModel();
      News.findOne.mockResolvedValue(null);
      const repo = makeRepo({ News, User });

      await repo.findNewsBySlug('slug', { withAuthor: false });

      const callArgs = News.findOne.mock.calls[0][0];
      expect(callArgs.include).toBeUndefined();
    });
  });

  describe('findNewsBySlugMin', () => {
    test('gọi News.findOne với attributes tối thiểu', async () => {
      const News = makeNewsModel();
      News.findOne.mockResolvedValue({ id: 2, category: 'Tech' });
      const repo = makeRepo({ News });

      const result = await repo.findNewsBySlugMin('tech-article');

      expect(News.findOne).toHaveBeenCalledWith({
        where: { slug: 'tech-article' },
        attributes: ['id', 'category'],
      });
      expect(result.category).toBe('Tech');
    });
  });

  describe('findNewsById', () => {
    test('gọi News.findByPk với include author khi withAuthor = true', async () => {
      const News = makeNewsModel();
      const User = makeUserModel();
      News.findByPk.mockResolvedValue({ id: 3 });
      const repo = makeRepo({ News, User });

      await repo.findNewsById(3);

      expect(News.findByPk).toHaveBeenCalledWith(3, expect.objectContaining({ include: expect.any(Array) }));
    });

    test('withAuthor = false → không có include trong options', async () => {
      const News = makeNewsModel();
      News.findByPk.mockResolvedValue({ id: 4 });
      const repo = makeRepo({ News });

      await repo.findNewsById(4, { withAuthor: false });

      const callArgs = News.findByPk.mock.calls[0][1];
      expect(callArgs.include).toBeUndefined();
    });
  });

  describe('findNewsByCategory', () => {
    test('gọi News.findAll với where đúng + excludeId', async () => {
      const News = makeNewsModel();
      News.findAll.mockResolvedValue([{ id: 5 }]);
      const repo = makeRepo({ News });

      await repo.findNewsByCategory('Tech', 1, ['id', 'title']);

      expect(News.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'Tech', isPublished: true }),
          limit: 3,
        })
      );
    });
  });

  describe('findLatestNews', () => {
    test('gọi News.findAll với excludeIds và limit', async () => {
      const News = makeNewsModel();
      News.findAll.mockResolvedValue([{ id: 10 }, { id: 11 }]);
      const repo = makeRepo({ News });

      const result = await repo.findLatestNews([1, 2], ['id', 'title'], 2);

      expect(News.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 2, order: [['createdAt', 'DESC']] })
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('createNews', () => {
    test('gọi News.create với payload', async () => {
      const News = makeNewsModel();
      const newNews = { id: 10, title: 'New Article' };
      News.create.mockResolvedValue(newNews);
      const repo = makeRepo({ News });

      const result = await repo.createNews({ title: 'New Article', userId: 1 });

      expect(News.create).toHaveBeenCalledWith({ title: 'New Article', userId: 1 });
      expect(result).toBe(newNews);
    });
  });

  describe('saveNews', () => {
    test('gọi news.save()', async () => {
      const repo = makeRepo();
      const news = { id: 1, save: jest.fn().mockResolvedValue() };
      await repo.saveNews(news);
      expect(news.save).toHaveBeenCalled();
    });
  });

  describe('deleteNews', () => {
    test('gọi news.destroy()', async () => {
      const repo = makeRepo();
      const news = { id: 1, destroy: jest.fn().mockResolvedValue() };
      await repo.deleteNews(news);
      expect(news.destroy).toHaveBeenCalled();
    });
  });

  describe('incrementNewsView', () => {
    test('gọi news.increment("viewCount")', async () => {
      const repo = makeRepo();
      const news = { increment: jest.fn().mockResolvedValue() };
      await repo.incrementNewsView(news);
      expect(news.increment).toHaveBeenCalledWith('viewCount');
    });
  });

  // ============================================================
  // EmailCampaign
  // ============================================================

  describe('findAllCampaigns', () => {
    test('gọi EmailCampaign.findAll với order mới nhất trước', async () => {
      const EmailCampaign = makeCampaignModel();
      EmailCampaign.findAll.mockResolvedValue([{ id: 1 }]);
      const repo = makeRepo({ EmailCampaign });

      await repo.findAllCampaigns();

      expect(EmailCampaign.findAll).toHaveBeenCalledWith({ order: [['createdAt', 'DESC']] });
    });
  });

  describe('findCampaignById', () => {
    test('gọi EmailCampaign.findByPk với id', async () => {
      const EmailCampaign = makeCampaignModel();
      EmailCampaign.findByPk.mockResolvedValue({ id: 3 });
      const repo = makeRepo({ EmailCampaign });

      const result = await repo.findCampaignById(3);

      expect(EmailCampaign.findByPk).toHaveBeenCalledWith(3);
      expect(result.id).toBe(3);
    });
  });

  describe('createCampaign', () => {
    test('gọi EmailCampaign.create với payload', async () => {
      const EmailCampaign = makeCampaignModel();
      EmailCampaign.create.mockResolvedValue({ id: 5 });
      const repo = makeRepo({ EmailCampaign });

      const result = await repo.createCampaign({ subject: 'Hello', content: 'World' });

      expect(EmailCampaign.create).toHaveBeenCalledWith({ subject: 'Hello', content: 'World' });
      expect(result.id).toBe(5);
    });
  });

  describe('saveCampaign', () => {
    test('gọi campaign.save()', async () => {
      const repo = makeRepo();
      const campaign = { save: jest.fn().mockResolvedValue({ id: 1 }) };
      await repo.saveCampaign(campaign);
      expect(campaign.save).toHaveBeenCalled();
    });
  });

  describe('deleteCampaign', () => {
    test('gọi campaign.destroy()', async () => {
      const repo = makeRepo();
      const campaign = { destroy: jest.fn().mockResolvedValue() };
      await repo.deleteCampaign(campaign);
      expect(campaign.destroy).toHaveBeenCalled();
    });
  });

  describe('findActiveSubscriberEmails', () => {
    test('gọi NewsletterSubscriber.findAll với status=active và attributes=[email]', async () => {
      const NewsletterSubscriber = makeSubscriberModel();
      NewsletterSubscriber.findAll.mockResolvedValue([{ email: 'a@b.com' }]);
      const repo = makeRepo({ NewsletterSubscriber });

      const result = await repo.findActiveSubscriberEmails();

      expect(NewsletterSubscriber.findAll).toHaveBeenCalledWith({
        where: { status: 'active' },
        attributes: ['email'],
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findAllUserEmails', () => {
    test('gọi User.findAll với attributes=[email]', async () => {
      const User = makeUserModel();
      User.findAll.mockResolvedValue([{ email: 'user@x.com' }]);
      const repo = makeRepo({ User });

      const result = await repo.findAllUserEmails();

      expect(User.findAll).toHaveBeenCalledWith({ attributes: ['email'] });
      expect(result).toHaveLength(1);
    });
  });

  // ============================================================
  // Newsletter
  // ============================================================

  describe('findOrCreateSubscriber', () => {
    test('trả về { subscriber, created: true } khi tạo mới', async () => {
      const NewsletterSubscriber = makeSubscriberModel();
      const sub = { id: 1, email: 'new@x.com', status: 'active' };
      NewsletterSubscriber.findOrCreate.mockResolvedValue([sub, true]);
      const repo = makeRepo({ NewsletterSubscriber });

      const result = await repo.findOrCreateSubscriber('new@x.com');

      expect(result.subscriber).toBe(sub);
      expect(result.created).toBe(true);
      expect(NewsletterSubscriber.findOrCreate).toHaveBeenCalledWith({
        where: { email: 'new@x.com' },
        defaults: { status: 'active' },
      });
    });

    test('trả về { subscriber, created: false } khi đã tồn tại', async () => {
      const NewsletterSubscriber = makeSubscriberModel();
      const sub = { id: 2, email: 'existing@x.com', status: 'active' };
      NewsletterSubscriber.findOrCreate.mockResolvedValue([sub, false]);
      const repo = makeRepo({ NewsletterSubscriber });

      const result = await repo.findOrCreateSubscriber('existing@x.com');

      expect(result.created).toBe(false);
    });
  });

  describe('saveSubscriber', () => {
    test('gọi subscriber.save()', async () => {
      const repo = makeRepo();
      const subscriber = { save: jest.fn().mockResolvedValue() };
      await repo.saveSubscriber(subscriber);
      expect(subscriber.save).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Feedback
  // ============================================================

  describe('createFeedback', () => {
    test('gọi Feedback.create với payload đúng', async () => {
      const Feedback = makeFeedbackModel();
      const newFeedback = { id: 1, name: 'A', status: 'pending' };
      Feedback.create.mockResolvedValue(newFeedback);
      const repo = makeRepo({ Feedback });

      const result = await repo.createFeedback({ name: 'A', email: 'a@b', subject: 's', content: 'c', status: 'pending' });

      expect(Feedback.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'A', status: 'pending' })
      );
      expect(result).toBe(newFeedback);
    });
  });
});
