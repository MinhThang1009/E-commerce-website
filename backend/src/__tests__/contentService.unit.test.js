// Phase 42.7 — Unit tests cho ContentService (modules/content gộp 5 sub-domain).
const ContentService = require('../modules/content/services/contentService');

describe('ContentService', () => {
  let contentRepository;
  let emailGateway;
  let cacheStore;
  let service;

  beforeEach(() => {
    contentRepository = {
      findAllBanners: jest.fn(),
      findBannerById: jest.fn(),
      createBanner: jest.fn(),
      saveBanner: jest.fn((b) => Promise.resolve(b)),
      deleteBanner: jest.fn().mockResolvedValue(),
      findAllNews: jest.fn(),
      findNewsBySlug: jest.fn(),
      findNewsBySlugMin: jest.fn(),
      findNewsById: jest.fn(),
      findNewsByCategory: jest.fn(),
      findLatestNews: jest.fn(),
      createNews: jest.fn(),
      saveNews: jest.fn((n) => Promise.resolve(n)),
      deleteNews: jest.fn().mockResolvedValue(),
      incrementNewsView: jest.fn().mockResolvedValue(),
      findAllCampaigns: jest.fn(),
      findCampaignById: jest.fn(),
      createCampaign: jest.fn(),
      saveCampaign: jest.fn((c) => Promise.resolve(c)),
      deleteCampaign: jest.fn().mockResolvedValue(),
      findActiveSubscriberEmails: jest.fn().mockResolvedValue([]),
      findAllUserEmails: jest.fn().mockResolvedValue([]),
      findOrCreateSubscriber: jest.fn(),
      saveSubscriber: jest.fn((s) => Promise.resolve(s)),
      createFeedback: jest.fn(),
    };
    emailGateway = {
      sendBulkCampaignEmail: jest.fn().mockResolvedValue(),
      sendNewsletterWelcomeEmail: jest.fn().mockResolvedValue(),
      sendAdminFeedbackNotification: jest.fn().mockResolvedValue(),
    };
    cacheStore = {
      get: jest.fn().mockResolvedValue(null),
      setEx: jest.fn().mockResolvedValue(),
      del: jest.fn().mockResolvedValue(),
    };
    service = new ContentService({
      contentRepository, emailGateway, cacheStore,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      adminEmail: 'admin@test.com',
    });
  });

  describe('Banner', () => {
    test('getAllBanners cache hit → trả từ cache', async () => {
      cacheStore.get.mockResolvedValue(JSON.stringify({ status: 'success', data: ['cached'] }));
      const result = await service.getAllBanners({ isActive: 'true' });
      expect(result.data).toEqual(['cached']);
      expect(contentRepository.findAllBanners).not.toHaveBeenCalled();
    });

    test('getAllBanners cache miss → query + setEx cache', async () => {
      contentRepository.findAllBanners.mockResolvedValue([{ id: 1 }]);
      const result = await service.getAllBanners({ isActive: 'true' });
      expect(result.results).toBe(1);
      expect(cacheStore.setEx).toHaveBeenCalledWith('banners:active', 3600, expect.any(String));
    });

    test('getAllBanners có position filter → KHÔNG cache', async () => {
      contentRepository.findAllBanners.mockResolvedValue([]);
      await service.getAllBanners({ isActive: 'true', position: 'home_hero' });
      expect(cacheStore.get).not.toHaveBeenCalled();
      expect(cacheStore.setEx).not.toHaveBeenCalled();
    });

    test('getBannerById không tồn tại → 404', async () => {
      contentRepository.findBannerById.mockResolvedValue(null);
      await expect(service.getBannerById({ id: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('createBanner → invalidate cache', async () => {
      contentRepository.createBanner.mockResolvedValue({ id: 1 });
      await service.createBanner({ payload: { title: 'B' } });
      expect(cacheStore.del).toHaveBeenCalledWith('banners:active');
    });

    test('updateBanner không tìm thấy → 404', async () => {
      contentRepository.findBannerById.mockResolvedValue(null);
      await expect(
        service.updateBanner({ id: 1, patch: {} })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('deleteBanner không tìm thấy → 404', async () => {
      contentRepository.findBannerById.mockResolvedValue(null);
      await expect(
        service.deleteBanner({ id: 1 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('News', () => {
    test('getAllNews phân trang + filter search/category', async () => {
      contentRepository.findAllNews.mockResolvedValue({ count: 25, rows: [] });
      const result = await service.getAllNews({ page: 2, limit: 10, search: 'iphone' });
      expect(result.count).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(contentRepository.findAllNews).toHaveBeenCalledWith(expect.objectContaining({
        limit: 10, offset: 10,
      }));
    });

    test('getNewsBySlug → tăng viewCount', async () => {
      const news = { id: 1 };
      contentRepository.findNewsBySlug.mockResolvedValue(news);
      const result = await service.getNewsBySlug({ slug: 'foo' });
      expect(result).toBe(news);
      expect(contentRepository.incrementNewsView).toHaveBeenCalledWith(news);
    });

    test('getNewsBySlug không tồn tại → null', async () => {
      contentRepository.findNewsBySlug.mockResolvedValue(null);
      const result = await service.getNewsBySlug({ slug: 'x' });
      expect(result).toBeNull();
      expect(contentRepository.incrementNewsView).not.toHaveBeenCalled();
    });

    test('getRelatedNews dùng category + fallback latest', async () => {
      contentRepository.findNewsBySlugMin.mockResolvedValue({ id: 1, category: 'Tech' });
      contentRepository.findNewsByCategory.mockResolvedValue([{ id: 2 }]);  // chỉ 1 → cần fallback 2 nữa
      contentRepository.findLatestNews.mockResolvedValue([{ id: 3 }, { id: 4 }]);

      const result = await service.getRelatedNews({ slug: 'foo' });

      expect(result).toHaveLength(3);
      expect(contentRepository.findLatestNews).toHaveBeenCalledWith([1, 2], expect.any(Array), 2);
    });

    test('createNews slug đã tồn tại → 400', async () => {
      contentRepository.findNewsBySlug.mockResolvedValue({ id: 99 });
      await expect(
        service.createNews({ userId: 1, payload: { title: 'A', slug: 'taken' } })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Slug') });
    });

    test('createNews default category="Tin tức" + isPublished=true', async () => {
      contentRepository.findNewsBySlug.mockResolvedValue(null);
      contentRepository.createNews.mockResolvedValue({ id: 5 });
      await service.createNews({ userId: 1, payload: { title: 'A', slug: 'a', content: 'c' } });
      expect(contentRepository.createNews).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'Tin tức', isPublished: true, userId: 1 })
      );
    });

    test('updateNews đổi slug sang slug đã tồn tại → 400', async () => {
      contentRepository.findNewsById.mockResolvedValue({ slug: 'old' });
      contentRepository.findNewsBySlug.mockResolvedValue({ id: 99 });
      await expect(
        service.updateNews({ id: 1, patch: { slug: 'taken' } })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('updateNews không tìm thấy → null', async () => {
      contentRepository.findNewsById.mockResolvedValue(null);
      const result = await service.updateNews({ id: 99, patch: {} });
      expect(result).toBeNull();
    });
  });

  describe('Email Campaign', () => {
    test('sendCampaign không tồn tại → 404', async () => {
      contentRepository.findCampaignById.mockResolvedValue(null);
      await expect(
        service.sendCampaign({ id: 99 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('sendCampaign đã sent → 400', async () => {
      contentRepository.findCampaignById.mockResolvedValue({ status: 'sent' });
      await expect(
        service.sendCampaign({ id: 1 })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('đã được gửi') });
    });

    test('sendCampaign dedupe email subscriber + user', async () => {
      const campaign = { id: 1, status: 'draft', subject: 'S', content: 'C' };
      contentRepository.findCampaignById.mockResolvedValue(campaign);
      contentRepository.findActiveSubscriberEmails.mockResolvedValue([
        { email: 'A@test.com' }, { email: 'b@test.com' },
      ]);
      contentRepository.findAllUserEmails.mockResolvedValue([
        { email: 'a@test.com' }, { email: 'c@test.com' },
      ]);

      const result = await service.sendCampaign({ id: 1 });

      // Dedupe: a@test.com (case-insensitive lowercase) + b + c = 3
      expect(result.recipientCount).toBe(3);
      expect(emailGateway.sendBulkCampaignEmail).toHaveBeenCalledWith(
        expect.arrayContaining(['a@test.com', 'b@test.com', 'c@test.com']),
        'S', 'C'
      );
      expect(campaign.status).toBe('sent');
    });

    test('sendCampaign 0 recipients → vẫn mark sent, KHÔNG gọi email', async () => {
      const campaign = { id: 1, status: 'draft' };
      contentRepository.findCampaignById.mockResolvedValue(campaign);

      const result = await service.sendCampaign({ id: 1 });

      expect(result.recipientCount).toBe(0);
      expect(emailGateway.sendBulkCampaignEmail).not.toHaveBeenCalled();
      expect(campaign.status).toBe('sent');
    });
  });

  describe('Newsletter', () => {
    test('email rỗng → 400', async () => {
      await expect(
        service.subscribeNewsletter({ email: '' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('subscriber mới → 201', async () => {
      contentRepository.findOrCreateSubscriber.mockResolvedValue({
        subscriber: { status: 'active' }, created: true,
      });
      const result = await service.subscribeNewsletter({ email: 'new@x.y' });
      expect(result.statusCode).toBe(201);
    });

    test('subscriber đã active → 200 không gọi welcome email', async () => {
      contentRepository.findOrCreateSubscriber.mockResolvedValue({
        subscriber: { status: 'active' }, created: false,
      });
      const result = await service.subscribeNewsletter({ email: 'old@x.y' });
      expect(result.statusCode).toBe(200);
      expect(result.message).toMatch(/đã đăng ký/);
    });

    test('subscriber unsubscribed → reactivate + 200', async () => {
      const subscriber = { status: 'unsubscribed' };
      contentRepository.findOrCreateSubscriber.mockResolvedValue({ subscriber, created: false });
      await service.subscribeNewsletter({ email: 'x@y.z' });
      expect(subscriber.status).toBe('active');
      expect(contentRepository.saveSubscriber).toHaveBeenCalledWith(subscriber);
    });
  });

  describe('Feedback', () => {
    test('thiếu field → 400', async () => {
      await expect(
        service.sendFeedback({ payload: { name: 'A', email: 'a@b' } })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('hợp lệ → tạo feedback + gửi admin notification', async () => {
      contentRepository.createFeedback.mockResolvedValue({ id: 1 });
      const result = await service.sendFeedback({
        payload: {
          name: 'A', email: 'a@b.c', subject: 's', content: 'c',
        },
      });
      expect(result.id).toBe(1);
      expect(contentRepository.createFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'A', status: 'pending' })
      );
      expect(emailGateway.sendAdminFeedbackNotification).toHaveBeenCalledWith(
        'admin@test.com',
        expect.objectContaining({ name: 'A' })
      );
    });
  });
});
