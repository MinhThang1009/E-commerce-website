// Tests bổ sung cho ContentController — phủ các catch block còn lại
// Nhắm vào:
// - line 29:  createBanner catch → next(err)
// - line 43:  deleteBanner catch → next(err)
// - line 74:  getRelatedNews catch → res.status(500)
// - line 136: createCampaign catch → next(err)
// - line 154: deleteCampaign catch → next(err)

const ContentController = require('./contentController');

// ---------- Helpers ----------

function makeRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
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
    getAllCampaigns: jest.fn(),
    createCampaign: jest.fn(),
    sendCampaign: jest.fn(),
    deleteCampaign: jest.fn(),
    subscribeNewsletter: jest.fn(),
    sendFeedback: jest.fn(),
  };
  controller = new ContentController({ contentService });
});

// ─── createBanner catch → next(err) (line 29) ────────────────────────────────

describe('ContentController.createBanner — catch block (line 29)', () => {
  it('gọi next(err) khi service ném lỗi validation', async () => {
    const err = Object.assign(new Error('imageUrl là bắt buộc'), { statusCode: 422 });
    contentService.createBanner.mockRejectedValue(err);

    const next = jest.fn();
    await controller.createBanner(
      makeReq({ body: { title: 'Banner' } }),
      makeRes(),
      next
    );

    expect(next).toHaveBeenCalledWith(err);
  });

  it('gọi next(err) khi service ném lỗi DB', async () => {
    const err = new Error('DB insert failed');
    contentService.createBanner.mockRejectedValue(err);

    const next = jest.fn();
    await controller.createBanner(makeReq({ body: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─── deleteBanner catch → next(err) (line 43) ────────────────────────────────

describe('ContentController.deleteBanner — catch block (line 43)', () => {
  it('gọi next(err) khi banner không tồn tại → service throw 404', async () => {
    const err = Object.assign(new Error('Banner không tồn tại'), { statusCode: 404 });
    contentService.deleteBanner.mockRejectedValue(err);

    const next = jest.fn();
    await controller.deleteBanner(
      makeReq({ params: { id: '999' } }),
      makeRes(),
      next
    );

    expect(next).toHaveBeenCalledWith(err);
  });

  it('gọi next(err) khi service ném lỗi DB', async () => {
    const err = new Error('foreign key constraint');
    contentService.deleteBanner.mockRejectedValue(err);

    const next = jest.fn();
    await controller.deleteBanner(makeReq({ params: { id: '1' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─── getRelatedNews catch → res.status(500) (line 74) ────────────────────────

describe('ContentController.getRelatedNews — catch block (line 74)', () => {
  it('trả 500 khi service ném lỗi không dự kiến', async () => {
    contentService.getRelatedNews.mockRejectedValue(new Error('query failed'));

    const res = makeRes();
    // getRelatedNews không nhận next — error handling nội bộ
    await controller.getRelatedNews(makeReq({ params: { slug: 'tin-hien-tai' } }), res);

    expect(res._status).toBe(500);
    expect(res._body).toEqual({ status: 'error', message: 'Lỗi máy chủ' });
  });

  it('trả 500 khi service ném DB timeout', async () => {
    contentService.getRelatedNews.mockRejectedValue(new Error('SequelizeConnectionTimedOutError'));

    const res = makeRes();
    await controller.getRelatedNews(makeReq({ params: { slug: 'test-slug' } }), res);

    expect(res._status).toBe(500);
    expect(res._body.status).toBe('error');
  });
});

// ─── createCampaign catch → next(err) (line 136) ─────────────────────────────

describe('ContentController.createCampaign — catch block (line 136)', () => {
  it('gọi next(err) khi service ném lỗi validation 422', async () => {
    const err = Object.assign(new Error('subject là bắt buộc'), { statusCode: 422 });
    contentService.createCampaign.mockRejectedValue(err);

    const next = jest.fn();
    await controller.createCampaign(makeReq({ body: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('gọi next(err) khi service ném lỗi DB', async () => {
    const err = new Error('campaign DB error');
    contentService.createCampaign.mockRejectedValue(err);

    const next = jest.fn();
    await controller.createCampaign(makeReq({ body: { name: 'Test' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─── deleteCampaign catch → next(err) (line 154) ─────────────────────────────

describe('ContentController.deleteCampaign — catch block (line 154)', () => {
  it('gọi next(err) khi campaign không tồn tại → service throw 404', async () => {
    const err = Object.assign(new Error('Campaign không tồn tại'), { statusCode: 404 });
    contentService.deleteCampaign.mockRejectedValue(err);

    const next = jest.fn();
    await controller.deleteCampaign(
      makeReq({ params: { id: '999' } }),
      makeRes(),
      next
    );

    expect(next).toHaveBeenCalledWith(err);
  });

  it('gọi next(err) khi service ném lỗi DB', async () => {
    const err = new Error('campaign delete constraint');
    contentService.deleteCampaign.mockRejectedValue(err);

    const next = jest.fn();
    await controller.deleteCampaign(makeReq({ params: { id: '5' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
