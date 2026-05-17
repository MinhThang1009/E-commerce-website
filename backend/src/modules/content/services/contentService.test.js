// Phase 42.7 — Unit tests cho ContentService (modules/content gộp 5 sub-domain).
const ContentService = require('./contentService');

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

    test('không gọi admin notification khi adminEmail không được cấu hình', async () => {
      const svcNoAdmin = new ContentService({
        contentRepository, emailGateway, cacheStore,
        eventBus: { publish: jest.fn() },
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
        adminEmail: null,
      });
      contentRepository.createFeedback.mockResolvedValue({ id: 2 });
      await svcNoAdmin.sendFeedback({
        payload: { name: 'B', email: 'b@c.d', subject: 'sub', content: 'con' },
      });
      expect(emailGateway.sendAdminFeedbackNotification).not.toHaveBeenCalled();
    });

    test('sendFeedback kèm phone → lưu phone', async () => {
      contentRepository.createFeedback.mockResolvedValue({ id: 3 });
      await service.sendFeedback({
        payload: { name: 'C', email: 'c@d.e', phone: '0901234567', subject: 'sub', content: 'con' },
      });
      expect(contentRepository.createFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '0901234567' })
      );
    });
  });

  // ============================================================
  // Banner — additional paths
  // ============================================================

  describe('Banner — additional paths', () => {
    test('getAllBanners không có position cũng không isActive → KHÔNG cache', async () => {
      contentRepository.findAllBanners.mockResolvedValue([]);
      await service.getAllBanners({});
      expect(cacheStore.setEx).not.toHaveBeenCalled();
    });

    test('getAllBanners isActive=false → KHÔNG cache', async () => {
      contentRepository.findAllBanners.mockResolvedValue([]);
      await service.getAllBanners({ isActive: 'false' });
      expect(cacheStore.setEx).not.toHaveBeenCalled();
    });

    test('updateBanner tìm thấy → merge patch và save', async () => {
      const banner = { id: 1, title: 'Old', isActive: true };
      contentRepository.findBannerById.mockResolvedValue(banner);
      await service.updateBanner({ id: 1, patch: { title: 'New', isActive: false } });
      expect(banner.title).toBe('New');
      expect(banner.isActive).toBe(false);
      expect(contentRepository.saveBanner).toHaveBeenCalledWith(banner);
      expect(cacheStore.del).toHaveBeenCalledWith('banners:active');
    });

    test('deleteBanner tìm thấy → xóa + invalidate cache', async () => {
      const banner = { id: 2 };
      contentRepository.findBannerById.mockResolvedValue(banner);
      await service.deleteBanner({ id: 2 });
      expect(contentRepository.deleteBanner).toHaveBeenCalledWith(banner);
      expect(cacheStore.del).toHaveBeenCalledWith('banners:active');
    });

    test('_invalidateBannerCache log warn khi del throw', async () => {
      const warnSpy = jest.fn();
      const svcWarn = new ContentService({
        contentRepository,
        emailGateway,
        cacheStore: { ...cacheStore, del: jest.fn().mockRejectedValue(new Error('redis fail')) },
        eventBus: { publish: jest.fn() },
        logger: { info: jest.fn(), error: jest.fn(), warn: warnSpy, debug: jest.fn() },
        adminEmail: null,
      });
      contentRepository.createBanner.mockResolvedValue({ id: 5 });
      await svcWarn.createBanner({ payload: {} });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('banners:active'), expect.any(String));
    });
  });

  // ============================================================
  // News — additional paths
  // ============================================================

  describe('News — additional paths', () => {
    test('getNewsById → gọi findNewsById', async () => {
      contentRepository.findNewsById.mockResolvedValue({ id: 5, title: 'Test' });
      const result = await service.getNewsById({ id: 5 });
      expect(result).toMatchObject({ id: 5 });
    });

    test('getAllNews filter isPublished=false → truyền isPublished=false vào repo', async () => {
      contentRepository.findAllNews.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllNews({ page: 1, limit: 5, isPublished: 'false' });
      expect(contentRepository.findAllNews).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expect.objectContaining({ isPublished: false }) })
      );
    });

    test('getAllNews category = "Tất cả" → KHÔNG truyền category filter', async () => {
      contentRepository.findAllNews.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllNews({ category: 'Tất cả' });
      const call = contentRepository.findAllNews.mock.calls[0][0];
      expect(call.filter).not.toHaveProperty('category');
    });

    test('getAllNews có category cụ thể → truyền category vào filter', async () => {
      contentRepository.findAllNews.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllNews({ category: 'Tech' });
      expect(contentRepository.findAllNews).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expect.objectContaining({ category: 'Tech' }) })
      );
    });

    test('getRelatedNews slug không tồn tại → null', async () => {
      contentRepository.findNewsBySlugMin.mockResolvedValue(null);
      const result = await service.getRelatedNews({ slug: 'missing' });
      expect(result).toBeNull();
    });

    test('getRelatedNews đủ 3 từ category → KHÔNG gọi findLatestNews', async () => {
      contentRepository.findNewsBySlugMin.mockResolvedValue({ id: 1, category: 'Tech' });
      contentRepository.findNewsByCategory.mockResolvedValue([{ id: 2 }, { id: 3 }, { id: 4 }]);

      const result = await service.getRelatedNews({ slug: 'foo' });
      expect(contentRepository.findLatestNews).not.toHaveBeenCalled();
      expect(result).toHaveLength(3);
    });

    test('createNews không có slug → không check duplicate slug', async () => {
      contentRepository.createNews.mockResolvedValue({ id: 10 });
      await service.createNews({ userId: 1, payload: { title: 'No slug post', content: 'c' } });
      // findNewsBySlug không được gọi khi không có slug
      expect(contentRepository.findNewsBySlug).not.toHaveBeenCalled();
      expect(contentRepository.createNews).toHaveBeenCalled();
    });

    test('updateNews đổi slug mới không trùng → cập nhật thành công (line 148 false branch)', async () => {
      contentRepository.findNewsById.mockResolvedValue({ id: 1, slug: 'old-slug' });
      contentRepository.findNewsBySlug.mockResolvedValue(null); // slug mới không bị trùng → if(existing) false
      const result = await service.updateNews({ id: 1, patch: { slug: 'new-unique-slug' } });
      // existing = null → if false → không throw → saveNews được gọi
      expect(contentRepository.saveNews).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('updateNews slug giống slug cũ → KHÔNG check duplicate', async () => {
      contentRepository.findNewsById.mockResolvedValue({ id: 1, slug: 'same-slug' });
      contentRepository.saveNews.mockResolvedValue();
      await service.updateNews({ id: 1, patch: { slug: 'same-slug', title: 'Updated' } });
      expect(contentRepository.findNewsBySlug).not.toHaveBeenCalled();
    });

    test('deleteNews không tồn tại → null', async () => {
      contentRepository.findNewsById.mockResolvedValue(null);
      const result = await service.deleteNews({ id: 99 });
      expect(result).toBeNull();
      expect(contentRepository.deleteNews).not.toHaveBeenCalled();
    });

    test('deleteNews tìm thấy → xóa và trả true', async () => {
      const news = { id: 5 };
      contentRepository.findNewsById.mockResolvedValue(news);
      const result = await service.deleteNews({ id: 5 });
      expect(result).toBe(true);
      expect(contentRepository.deleteNews).toHaveBeenCalledWith(news);
    });
  });

  // ============================================================
  // Email Campaign — additional paths
  // ============================================================

  describe('Email Campaign — additional paths', () => {
    test('getAllCampaigns → gọi findAllCampaigns', async () => {
      contentRepository.findAllCampaigns.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const result = await service.getAllCampaigns();
      expect(result).toHaveLength(2);
    });

    test('createCampaign → gọi findOrCreate và trả về campaign', async () => {
      contentRepository.createCampaign.mockResolvedValue({ id: 5, subject: 'Test' });
      const result = await service.createCampaign({ payload: { subject: 'Test', content: 'c' } });
      expect(result.id).toBe(5);
    });

    test('deleteCampaign không tồn tại → 404', async () => {
      contentRepository.findCampaignById.mockResolvedValue(null);
      await expect(service.deleteCampaign({ id: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('deleteCampaign tìm thấy → xóa thành công', async () => {
      const campaign = { id: 1 };
      contentRepository.findCampaignById.mockResolvedValue(campaign);
      await service.deleteCampaign({ id: 1 });
      expect(contentRepository.deleteCampaign).toHaveBeenCalledWith(campaign);
    });

    test('sendCampaign gửi thất bại → throw 500', async () => {
      const campaign = { id: 1, status: 'draft', subject: 'S', content: 'C' };
      contentRepository.findCampaignById.mockResolvedValue(campaign);
      contentRepository.findActiveSubscriberEmails.mockResolvedValue([{ email: 'a@b.com' }]);
      emailGateway.sendBulkCampaignEmail.mockRejectedValue(new Error('SMTP down'));

      await expect(service.sendCampaign({ id: 1 })).rejects.toMatchObject({ statusCode: 500 });
    });

    test('sendCampaign mark sentAt sau khi gửi thành công', async () => {
      const campaign = { id: 1, status: 'draft', subject: 'Sub', content: 'Body', sentAt: null };
      contentRepository.findCampaignById.mockResolvedValue(campaign);
      contentRepository.findActiveSubscriberEmails.mockResolvedValue([{ email: 'a@b.com' }]);

      await service.sendCampaign({ id: 1 });

      expect(campaign.sentAt).toBeInstanceOf(Date);
      expect(contentRepository.saveCampaign).toHaveBeenCalledWith(campaign);
    });
  });

  // ============================================================
  // Newsletter — additional paths
  // ============================================================

  describe('Newsletter — additional paths', () => {
    test('subscribeNewsletter email undefined → 400', async () => {
      await expect(
        service.subscribeNewsletter({ email: undefined })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('subscriber mới → gọi sendNewsletterWelcomeEmail', async () => {
      contentRepository.findOrCreateSubscriber.mockResolvedValue({
        subscriber: { status: 'active' }, created: true,
      });
      await service.subscribeNewsletter({ email: 'new@example.com' });
      expect(emailGateway.sendNewsletterWelcomeEmail).toHaveBeenCalledWith('new@example.com');
    });

    test('subscriber reactivated → gọi sendNewsletterWelcomeEmail', async () => {
      const subscriber = { status: 'unsubscribed' };
      contentRepository.findOrCreateSubscriber.mockResolvedValue({ subscriber, created: false });
      await service.subscribeNewsletter({ email: 'reactivate@example.com' });
      expect(emailGateway.sendNewsletterWelcomeEmail).toHaveBeenCalledWith('reactivate@example.com');
    });

    test('sendNewsletterWelcomeEmail thất bại → không throw (fire-and-forget catch — line 238)', async () => {
      contentRepository.findOrCreateSubscriber.mockResolvedValue({
        subscriber: { status: 'active' }, created: true,
      });
      const logger = service.logger;
      emailGateway.sendNewsletterWelcomeEmail.mockRejectedValue(new Error('mail fail'));

      const result = await service.subscribeNewsletter({ email: 'fail@example.com' });

      expect(result).toHaveProperty('message');
      // Chờ fire-and-forget resolve
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('email chào mừng'),
        expect.any(String)
      );
    });
  });

  // ============================================================
  // _invalidateBannerCache — cacheStore null → return sớm (line 69)
  // ============================================================

  describe('Banner — _invalidateBannerCache khi cacheStore là null (line 69)', () => {
    test('createBanner với cacheStore=null → không throw, không gọi del', async () => {
      const svcNoCacheStore = new ContentService({
        contentRepository,
        emailGateway,
        cacheStore: null, // không có cacheStore
        eventBus: { publish: jest.fn() },
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
        adminEmail: null,
      });
      contentRepository.createBanner.mockResolvedValue({ id: 10 });

      // Không throw — _invalidateBannerCache returns sớm tại line 69
      await expect(
        svcNoCacheStore.createBanner({ payload: { title: 'Test' } })
      ).resolves.toMatchObject({ id: 10 });

      // cacheStore.del không bao giờ được gọi vì cacheStore null
      expect(cacheStore.del).not.toHaveBeenCalled();
    });

    test('deleteBanner với cacheStore=null → không throw', async () => {
      const svcNoCacheStore = new ContentService({
        contentRepository,
        emailGateway,
        cacheStore: null,
        eventBus: { publish: jest.fn() },
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
        adminEmail: null,
      });
      const banner = { id: 3 };
      contentRepository.findBannerById.mockResolvedValue(banner);

      await expect(svcNoCacheStore.deleteBanner({ id: 3 })).resolves.toBeUndefined();
    });
  });

  // ============================================================
  // createNews — isPublished được truyền tường minh (line 137 else branch)
  // ============================================================

  describe('News — createNews với isPublished tường minh (line 137)', () => {
    test('createNews với isPublished=false → truyền false vào repo, không dùng default true', async () => {
      contentRepository.findNewsBySlug.mockResolvedValue(null);
      contentRepository.createNews.mockResolvedValue({ id: 20, isPublished: false });

      await service.createNews({ userId: 1, payload: { title: 'Draft', slug: 'draft', isPublished: false } });

      expect(contentRepository.createNews).toHaveBeenCalledWith(
        expect.objectContaining({ isPublished: false })
      );
    });

    test('createNews với isPublished=true tường minh → truyền true vào repo', async () => {
      contentRepository.findNewsBySlug.mockResolvedValue(null);
      contentRepository.createNews.mockResolvedValue({ id: 21, isPublished: true });

      await service.createNews({ userId: 2, payload: { title: 'Published', slug: 'published', isPublished: true } });

      expect(contentRepository.createNews).toHaveBeenCalledWith(
        expect.objectContaining({ isPublished: true })
      );
    });
  });

  // ============================================================
  // getBannerById — success path (line 43)
  // ============================================================

  describe('Banner — getBannerById success', () => {
    test('getBannerById tồn tại → trả về banner (covers line 43)', async () => {
      const banner = { id: 5, title: 'Summer Sale', isActive: true };
      contentRepository.findBannerById.mockResolvedValue(banner);

      const result = await service.getBannerById({ id: 5 });

      expect(result).toBe(banner);
    });
  });

  // ============================================================
  // sendFeedback — email admin catch (line 266)
  // ============================================================

  describe('Feedback — sendAdminFeedbackNotification catch (line 266)', () => {
    test('sendAdminFeedbackNotification thất bại → không throw (fire-and-forget catch)', async () => {
      contentRepository.createFeedback.mockResolvedValue({ id: 1 });
      emailGateway.sendAdminFeedbackNotification.mockRejectedValue(new Error('smtp error'));

      const result = await service.sendFeedback({
        payload: { name: 'Nguyễn', email: 'ng@test.com', phone: '0123', subject: 'Góp ý', content: 'Nội dung' },
      });

      expect(result).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(service.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('email thông báo phản hồi'),
        expect.any(String)
      );
    });
  });
});
