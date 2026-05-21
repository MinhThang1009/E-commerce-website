// Unit tests cho ContentController.
// Chiến lược: mock contentService hoàn toàn, kiểm tra response shape + status code.
// Note: News/getNewsBySlug/getNewsById dùng pattern try/catch tự handle (không next),
// nên error path trả 500 JSON, không gọi next.

const ContentController = require('./content-controller');

// ---------- Helper tạo req/res/next giả ----------

function makeRes() {
  const res = {
    _status: 200, // express default
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  return res;
}

function makeReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: undefined,
    ...overrides,
  };
}

// ---------- Setup ----------

let contentService;
let controller;

beforeEach(() => {
  contentService = {
    getAllBanners: jest.fn(),
    getBannerById: jest.fn(),
    createBanner: jest.fn(),
    updateBanner: jest.fn(),
    deleteBanner: jest.fn(),
    getAllNews: jest.fn(),
    getNewsBySlug: jest.fn(),
    getRelatedNews: jest.fn(),
    getNewsById: jest.fn(),
    createNews: jest.fn(),
    updateNews: jest.fn(),
    deleteNews: jest.fn(),
    sendFeedback: jest.fn(),
  };
  controller = new ContentController({ contentService });
});

// ============================================================
// Banner
// ============================================================

describe('ContentController — Banner', () => {
  describe('getAllBanners', () => {
    it('trả payload trực tiếp từ service với status 200', async () => {
      // getAllBanners trả payload thô (legacy shape: {status, results, data})
      const servicePayload = { status: 'success', results: 2, data: [{ id: 1 }, { id: 2 }] };
      contentService.getAllBanners.mockResolvedValue(servicePayload);

      const req = makeReq({ query: { position: 'home_top' } });
      const res = makeRes();
      const next = jest.fn();

      await controller.getAllBanners(req, res, next);

      expect(contentService.getAllBanners).toHaveBeenCalledWith({ position: 'home_top' });
      expect(res._status).toBe(200);
      expect(res._body).toEqual(servicePayload);
      expect(next).not.toHaveBeenCalled();
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      contentService.getAllBanners.mockRejectedValue(new Error('DB lỗi'));

      const next = jest.fn();
      await controller.getAllBanners(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getBannerById', () => {
    it('trả 200 với { status, data: banner }', async () => {
      const bannerData = { id: '3', title: 'Banner Tết', imageUrl: 'tet.jpg' };
      contentService.getBannerById.mockResolvedValue(bannerData);

      const req = makeReq({ params: { id: '3' } });
      const res = makeRes();
      const next = jest.fn();

      await controller.getBannerById(req, res, next);

      expect(contentService.getBannerById).toHaveBeenCalledWith({ id: '3' });
      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', data: bannerData });
      expect(next).not.toHaveBeenCalled();
    });

    it('gọi next(err) khi service ném lỗi 404', async () => {
      const notFound = Object.assign(new Error('không tìm thấy banner'), { statusCode: 404 });
      contentService.getBannerById.mockRejectedValue(notFound);

      const next = jest.fn();
      await controller.getBannerById(makeReq({ params: { id: '99' } }), makeRes(), next);

      expect(next).toHaveBeenCalledWith(notFound);
    });
  });

  describe('createBanner', () => {
    it('trả 201 với banner vừa tạo', async () => {
      const newBanner = { id: 10, title: 'Banner Mới', position: 'home_top' };
      contentService.createBanner.mockResolvedValue(newBanner);

      const req = makeReq({
        body: { title: 'Banner Mới', position: 'home_top', imageUrl: 'new.jpg' },
      });
      const res = makeRes();
      const next = jest.fn();

      await controller.createBanner(req, res, next);

      expect(contentService.createBanner).toHaveBeenCalledWith({ payload: req.body });
      expect(res._status).toBe(201);
      expect(res._body).toEqual({ status: 'success', data: newBanner });
      expect(next).not.toHaveBeenCalled();
    });

    it('gọi next(err) khi service throw lỗi', async () => {
      contentService.createBanner.mockRejectedValue(new Error('lỗi tạo'));
      const next = jest.fn();
      await controller.createBanner(makeReq({ body: {} }), makeRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('updateBanner', () => {
    it('truyền id và patch, trả 200', async () => {
      const updatedBanner = { id: '5', title: 'Updated Banner' };
      contentService.updateBanner.mockResolvedValue(updatedBanner);

      const req = makeReq({ params: { id: '5' }, body: { title: 'Updated Banner' } });
      const res = makeRes();

      await controller.updateBanner(req, res, jest.fn());

      expect(contentService.updateBanner).toHaveBeenCalledWith({
        id: '5',
        patch: { title: 'Updated Banner' },
      });
      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', data: updatedBanner });
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      contentService.updateBanner.mockRejectedValue(new Error('cập nhật thất bại'));

      const next = jest.fn();
      await controller.updateBanner(makeReq({ params: { id: '1' } }), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('deleteBanner', () => {
    it('gọi next(err) khi service throw lỗi', async () => {
      contentService.deleteBanner.mockRejectedValue(new Error('lỗi xóa'));
      const next = jest.fn();
      await controller.deleteBanner(makeReq({ params: { id: '1' } }), makeRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('trả 204 với { status, data: null }', async () => {
      contentService.deleteBanner.mockResolvedValue();

      const req = makeReq({ params: { id: '2' } });
      const res = makeRes();
      const next = jest.fn();

      await controller.deleteBanner(req, res, next);

      expect(contentService.deleteBanner).toHaveBeenCalledWith({ id: '2' });
      expect(res._status).toBe(204);
      expect(res._body).toEqual({ status: 'success', data: null });
      expect(next).not.toHaveBeenCalled();
    });
  });
});

// ============================================================
// News
// ============================================================

describe('ContentController — News', () => {
  describe('getAllNews', () => {
    it('trả { status: success, ...data } khi thành công', async () => {
      const serviceData = { news: [{ id: 1 }], total: 1, page: 1 };
      contentService.getAllNews.mockResolvedValue(serviceData);

      const req = makeReq({ query: { page: '1', limit: '10' } });
      const res = makeRes();

      await controller.getAllNews(req, res);

      expect(contentService.getAllNews).toHaveBeenCalledWith({ page: '1', limit: '10' });
      expect(res._body.status).toBe('success');
      expect(res._body.news).toEqual(serviceData.news);
      expect(res._body.total).toBe(1);
    });

    it('trả 500 khi service ném lỗi (không dùng next)', async () => {
      contentService.getAllNews.mockRejectedValue(new Error('DB timeout'));

      const res = makeRes();
      // getAllNews không nhận next — error handling nội bộ
      await controller.getAllNews(makeReq(), res);

      expect(res._status).toBe(500);
      expect(res._body).toEqual({ status: 'error', message: 'Lỗi máy chủ' });
    });
  });

  describe('getNewsBySlug', () => {
    it('trả { status: success, news } khi tìm thấy', async () => {
      const newsItem = { id: 5, slug: 'tin-tuc-moi', title: 'Tin tức mới' };
      contentService.getNewsBySlug.mockResolvedValue(newsItem);

      const req = makeReq({ params: { slug: 'tin-tuc-moi' } });
      const res = makeRes();

      await controller.getNewsBySlug(req, res);

      expect(contentService.getNewsBySlug).toHaveBeenCalledWith({ slug: 'tin-tuc-moi' });
      expect(res._body).toEqual({ status: 'success', news: newsItem });
    });

    it('trả 404 khi service trả null', async () => {
      contentService.getNewsBySlug.mockResolvedValue(null);

      const res = makeRes();
      await controller.getNewsBySlug(makeReq({ params: { slug: 'khong-ton-tai' } }), res);

      expect(res._status).toBe(404);
      expect(res._body).toEqual({ status: 'error', message: 'Không tìm thấy tin tức' });
    });

    it('trả 500 khi service ném lỗi', async () => {
      contentService.getNewsBySlug.mockRejectedValue(new Error('lỗi'));

      const res = makeRes();
      await controller.getNewsBySlug(makeReq({ params: { slug: 'slug' } }), res);

      expect(res._status).toBe(500);
      expect(res._body.status).toBe('error');
    });
  });

  describe('getRelatedNews', () => {
    it('trả { status: success, news } khi tìm thấy', async () => {
      const relatedList = [{ id: 2 }, { id: 3 }];
      contentService.getRelatedNews.mockResolvedValue(relatedList);

      const req = makeReq({ params: { slug: 'tin-hien-tai' } });
      const res = makeRes();

      await controller.getRelatedNews(req, res);

      expect(contentService.getRelatedNews).toHaveBeenCalledWith({ slug: 'tin-hien-tai' });
      expect(res._body).toEqual({ status: 'success', news: relatedList });
    });

    it('trả 404 khi service trả null (null là sentinel không tìm thấy)', async () => {
      contentService.getRelatedNews.mockResolvedValue(null);

      const res = makeRes();
      await controller.getRelatedNews(makeReq({ params: { slug: 'ko-co' } }), res);

      expect(res._status).toBe(404);
      expect(res._body.status).toBe('error');
    });

    it('trả [] (không 404) khi service trả mảng rỗng vì related có thể là rỗng', async () => {
      // Mảng rỗng !== null — controller không 404 với mảng rỗng
      contentService.getRelatedNews.mockResolvedValue([]);

      const res = makeRes();
      await controller.getRelatedNews(makeReq({ params: { slug: 'slug' } }), res);

      expect(res._status).toBe(200);
      expect(res._body.news).toEqual([]);
    });

    it('trả 500 khi service throw lỗi', async () => {
      contentService.getRelatedNews.mockRejectedValue(new Error('DB lỗi'));
      const res = makeRes();
      await controller.getRelatedNews(makeReq({ params: { slug: 'test' } }), res);
      expect(res._status).toBe(500);
      expect(res._body.status).toBe('error');
    });
  });

  describe('getNewsById', () => {
    it('trả { status: success, news } khi tìm thấy', async () => {
      const newsItem = { id: '10', title: 'Bài viết 10' };
      contentService.getNewsById.mockResolvedValue(newsItem);

      const req = makeReq({ params: { id: '10' } });
      const res = makeRes();

      await controller.getNewsById(req, res);

      expect(contentService.getNewsById).toHaveBeenCalledWith({ id: '10' });
      expect(res._body).toEqual({ status: 'success', news: newsItem });
    });

    it('trả 404 khi service trả null', async () => {
      contentService.getNewsById.mockResolvedValue(null);

      const res = makeRes();
      await controller.getNewsById(makeReq({ params: { id: '999' } }), res);

      expect(res._status).toBe(404);
      expect(res._body.message).toBe('Không tìm thấy tin tức');
    });

    it('trả 500 khi service ném lỗi', async () => {
      contentService.getNewsById.mockRejectedValue(new Error('DB fail'));

      const res = makeRes();
      await controller.getNewsById(makeReq({ params: { id: '1' } }), res);

      expect(res._status).toBe(500);
    });
  });

  describe('createNews', () => {
    it('trả 201 với news vừa tạo khi thành công', async () => {
      const createdNews = { id: 20, title: 'Bài viết mới' };
      contentService.createNews.mockResolvedValue(createdNews);

      const req = makeReq({
        user: { id: 3 },
        body: { title: 'Bài viết mới', content: 'Nội dung...' },
      });
      const res = makeRes();

      await controller.createNews(req, res);

      expect(contentService.createNews).toHaveBeenCalledWith({
        userId: 3,
        payload: { title: 'Bài viết mới', content: 'Nội dung...' },
      });
      expect(res._status).toBe(201);
      expect(res._body).toEqual({ status: 'success', news: createdNews });
    });

    it('trả 400 khi service ném lỗi có statusCode 400', async () => {
      const validationErr = Object.assign(new Error('Tiêu đề đã tồn tại'), { statusCode: 400 });
      contentService.createNews.mockRejectedValue(validationErr);

      const req = makeReq({ user: { id: 1 }, body: { title: 'Duplicate' } });
      const res = makeRes();

      await controller.createNews(req, res);

      expect(res._status).toBe(400);
      expect(res._body).toEqual({ status: 'error', message: 'Tiêu đề đã tồn tại' });
    });

    it('trả 500 khi service ném lỗi không phải 400', async () => {
      contentService.createNews.mockRejectedValue(new Error('unexpected error'));

      const req = makeReq({ user: { id: 1 }, body: {} });
      const res = makeRes();

      await controller.createNews(req, res);

      expect(res._status).toBe(500);
      expect(res._body.status).toBe('error');
    });
  });

  describe('updateNews', () => {
    it('trả { status: success, news } khi cập nhật thành công', async () => {
      const updatedNews = { id: '7', title: 'Updated Title' };
      contentService.updateNews.mockResolvedValue(updatedNews);

      const req = makeReq({ params: { id: '7' }, body: { title: 'Updated Title' } });
      const res = makeRes();

      await controller.updateNews(req, res);

      expect(contentService.updateNews).toHaveBeenCalledWith({
        id: '7',
        patch: { title: 'Updated Title' },
      });
      expect(res._body).toEqual({ status: 'success', news: updatedNews });
    });

    it('trả 404 khi service trả null', async () => {
      contentService.updateNews.mockResolvedValue(null);

      const res = makeRes();
      await controller.updateNews(makeReq({ params: { id: '404' }, body: {} }), res);

      expect(res._status).toBe(404);
      expect(res._body.message).toBe('Không tìm thấy tin tức');
    });

    it('trả 400 khi service ném lỗi có statusCode 400', async () => {
      const err400 = Object.assign(new Error('Slug đã tồn tại'), { statusCode: 400 });
      contentService.updateNews.mockRejectedValue(err400);

      const res = makeRes();
      await controller.updateNews(makeReq({ params: { id: '1' }, body: {} }), res);

      expect(res._status).toBe(400);
      expect(res._body.message).toBe('Slug đã tồn tại');
    });

    it('trả 500 khi service ném lỗi không phải 400', async () => {
      contentService.updateNews.mockRejectedValue(new Error('DB crash'));

      const res = makeRes();
      await controller.updateNews(makeReq({ params: { id: '1' }, body: {} }), res);

      expect(res._status).toBe(500);
    });
  });

  describe('deleteNews', () => {
    it('trả { status: success, message } khi xóa thành công', async () => {
      contentService.deleteNews.mockResolvedValue(true);

      const req = makeReq({ params: { id: '5' } });
      const res = makeRes();

      await controller.deleteNews(req, res);

      expect(contentService.deleteNews).toHaveBeenCalledWith({ id: '5' });
      expect(res._body).toEqual({ status: 'success', message: 'Tin tức đã được xóa thành công' });
    });

    it('trả 404 khi service trả null/falsy', async () => {
      contentService.deleteNews.mockResolvedValue(null);

      const res = makeRes();
      await controller.deleteNews(makeReq({ params: { id: '99' } }), res);

      expect(res._status).toBe(404);
      expect(res._body.message).toBe('Không tìm thấy tin tức');
    });

    it('trả 500 khi service ném lỗi', async () => {
      contentService.deleteNews.mockRejectedValue(new Error('xóa thất bại'));

      const res = makeRes();
      await controller.deleteNews(makeReq({ params: { id: '1' } }), res);

      expect(res._status).toBe(500);
    });
  });
});

// ============================================================
// Feedback
// ============================================================

describe('ContentController — Feedback', () => {
  describe('sendFeedback', () => {
    it('trả 201 với message cảm ơn và data feedback', async () => {
      const feedbackRecord = { id: 1, name: 'Nguyễn Văn A', message: 'Sản phẩm tốt' };
      contentService.sendFeedback.mockResolvedValue(feedbackRecord);

      const req = makeReq({
        body: { name: 'Nguyễn Văn A', email: 'a@test.com', message: 'Sản phẩm tốt' },
      });
      const res = makeRes();
      const next = jest.fn();

      await controller.sendFeedback(req, res, next);

      expect(contentService.sendFeedback).toHaveBeenCalledWith({ payload: req.body });
      expect(res._status).toBe(201);
      expect(res._body.status).toBe('success');
      expect(res._body.message).toContain('Cảm ơn');
      expect(res._body.data).toEqual(feedbackRecord);
      expect(next).not.toHaveBeenCalled();
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      contentService.sendFeedback.mockRejectedValue(new Error('lưu thất bại'));

      const next = jest.fn();
      await controller.sendFeedback(makeReq({ body: {} }), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });
  });
});
