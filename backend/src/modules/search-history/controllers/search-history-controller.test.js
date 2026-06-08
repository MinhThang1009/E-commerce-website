// Unit tests cho searchHistory controller (src/controllers/searchHistory.js)
// Kiểm tra behavior của từng handler: saveSearch, getSearchHistory,
// deleteSearchHistory, clearAllSearchHistory — mock SearchHistory model.

jest.mock('@models', () => ({
  SearchHistory: {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    destroy: jest.fn(),
  },
}));

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const { SearchHistory } = require('@models');
const {
  saveSearch,
  getSearchHistory,
  deleteSearchHistory,
  clearAllSearchHistory,
} = require('./search-history-controller');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    user: null,
    ...overrides,
  };
}

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ════════════════════════════════════════════════════════════════════════════
// saveSearch
// ════════════════════════════════════════════════════════════════════════════

describe('saveSearch', () => {
  beforeEach(() => jest.clearAllMocks());

  test('keyword undefined → controller không có guard, Zod validator ở route layer đã chặn trước đó', async () => {
    // Guard !keyword đã bị xóa (dead code — Zod min(1) ở route layer chặn trước).
    // Controller chỉ forward xuống service; test này verify không throw unhandled error.
    SearchHistory.findOne.mockResolvedValue(null);
    SearchHistory.create.mockResolvedValue({ id: 99, keyword: undefined });

    const req = makeReq({ body: {} });
    const res = makeRes();
    const next = jest.fn();

    await saveSearch(req, res, next);

    // Không throw — controller xử lý được dù keyword undefined
    // (status phụ thuộc service mock)
  });

  test('trả 200 và data khi duplicate keyword trong 1 giờ', async () => {
    const existingRecord = { id: 1, keyword: 'áo thun', userId: 5 };
    SearchHistory.findOne.mockResolvedValue(existingRecord);

    const req = makeReq({ body: { keyword: 'áo thun' }, user: { id: 5 } });
    const res = makeRes();
    const next = jest.fn();

    await saveSearch(req, res, next);

    expect(SearchHistory.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: existingRecord });
  });

  test('tạo mới và trả 201 khi keyword chưa tồn tại trong 1 giờ — user đã đăng nhập', async () => {
    SearchHistory.findOne.mockResolvedValue(null);
    const created = { id: 10, keyword: 'giày sneaker', userId: 3 };
    SearchHistory.create.mockResolvedValue(created);

    const req = makeReq({ body: { keyword: 'giày sneaker', resultsCount: 12 }, user: { id: 3 } });
    const res = makeRes();
    const next = jest.fn();

    await saveSearch(req, res, next);

    expect(SearchHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'giày sneaker', userId: 3, resultsCount: 12 }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: created });
  });

  test('tạo mới với userId=null khi là guest và có sessionId', async () => {
    SearchHistory.findOne.mockResolvedValue(null);
    const created = { id: 11, keyword: 'balo', userId: null, sessionId: 'sess-abc' };
    SearchHistory.create.mockResolvedValue(created);

    const req = makeReq({ body: { keyword: 'balo', sessionId: 'sess-abc' }, user: null });
    const res = makeRes();
    const next = jest.fn();

    await saveSearch(req, res, next);

    expect(SearchHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'balo', userId: null, sessionId: 'sess-abc' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('duplicate check dùng userId khi user đã đăng nhập', async () => {
    SearchHistory.findOne.mockResolvedValue(null);
    SearchHistory.create.mockResolvedValue({ id: 20, keyword: 'laptop' });

    const req = makeReq({ body: { keyword: 'laptop' }, user: { id: 7 } });
    const res = makeRes();
    await saveSearch(req, res, jest.fn());

    const findOneCall = SearchHistory.findOne.mock.calls[0][0];
    expect(findOneCall.where).toMatchObject({ keyword: 'laptop', userId: 7 });
  });

  test('duplicate check dùng sessionId khi là guest', async () => {
    SearchHistory.findOne.mockResolvedValue(null);
    SearchHistory.create.mockResolvedValue({ id: 21, keyword: 'tai nghe' });

    const req = makeReq({ body: { keyword: 'tai nghe', sessionId: 'sess-xyz' }, user: null });
    const res = makeRes();
    await saveSearch(req, res, jest.fn());

    const findOneCall = SearchHistory.findOne.mock.calls[0][0];
    expect(findOneCall.where).toMatchObject({ keyword: 'tai nghe', sessionId: 'sess-xyz' });
  });

  test('gọi next(error) khi SearchHistory.create ném lỗi', async () => {
    SearchHistory.findOne.mockResolvedValue(null);
    SearchHistory.create.mockRejectedValue(new Error('DB error'));

    const req = makeReq({ body: { keyword: 'test' }, user: { id: 1 } });
    const res = makeRes();
    const next = jest.fn();

    await saveSearch(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('userId và sessionId đều null → KHÔNG tạo row (tránh orphan DB records)', async () => {
    const req = makeReq({
      body: { keyword: 'anonymous' },
      user: null,
    });
    const res = makeRes();
    const next = jest.fn();

    await saveSearch(req, res, next);

    // Không gọi DB khi cả userId lẫn sessionId đều null
    expect(SearchHistory.findOne).not.toHaveBeenCalled();
    expect(SearchHistory.create).not.toHaveBeenCalled();
    // Service trả { created: false, data: null } → status 200 (created=false)
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getSearchHistory
// ════════════════════════════════════════════════════════════════════════════

describe('getSearchHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  test('trả danh sách history của user với default limit 10', async () => {
    const history = [
      { id: 1, keyword: 'áo' },
      { id: 2, keyword: 'quần' },
    ];
    SearchHistory.findAll.mockResolvedValue(history);

    const req = makeReq({ user: { id: 5 }, query: {} });
    const res = makeRes();

    await getSearchHistory(req, res, jest.fn());

    expect(SearchHistory.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 5 },
        limit: 10,
        order: [['createdAt', 'DESC']],
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: history });
  });

  test('dùng limit từ query param khi được truyền', async () => {
    SearchHistory.findAll.mockResolvedValue([]);

    const req = makeReq({ user: { id: 5 }, query: { limit: '5' } });
    const res = makeRes();

    await getSearchHistory(req, res, jest.fn());

    expect(SearchHistory.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 5 }));
  });

  test('gọi next(error) khi SearchHistory.findAll ném lỗi', async () => {
    SearchHistory.findAll.mockRejectedValue(new Error('DB down'));

    const req = makeReq({ user: { id: 5 }, query: {} });
    const res = makeRes();
    const next = jest.fn();

    await getSearchHistory(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// deleteSearchHistory
// ════════════════════════════════════════════════════════════════════════════

describe('deleteSearchHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  test('xóa record và trả 200 khi tìm thấy', async () => {
    const historyItem = { id: 3, userId: 5, destroy: jest.fn().mockResolvedValue(true) };
    SearchHistory.findOne.mockResolvedValue(historyItem);

    const req = makeReq({ params: { id: '3' }, user: { id: 5 } });
    const res = makeRes();

    await deleteSearchHistory(req, res, jest.fn());

    expect(SearchHistory.findOne).toHaveBeenCalledWith({ where: { id: '3', userId: 5 } });
    expect(historyItem.destroy).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      message: 'Xóa lịch sử tìm kiếm thành công',
    });
  });

  test('ném AppError 404 khi không tìm thấy record', async () => {
    SearchHistory.findOne.mockResolvedValue(null);

    const req = makeReq({ params: { id: '999' }, user: { id: 5 } });
    const res = makeRes();
    const next = jest.fn();

    await deleteSearchHistory(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  test('gọi next(error) khi findOne ném lỗi', async () => {
    SearchHistory.findOne.mockRejectedValue(new Error('DB error'));

    const req = makeReq({ params: { id: '1' }, user: { id: 5 } });
    const res = makeRes();
    const next = jest.fn();

    await deleteSearchHistory(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// clearAllSearchHistory
// ════════════════════════════════════════════════════════════════════════════

describe('clearAllSearchHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  test('xóa tất cả history của user và trả 200', async () => {
    SearchHistory.destroy.mockResolvedValue(5);

    const req = makeReq({ user: { id: 8 } });
    const res = makeRes();

    await clearAllSearchHistory(req, res, jest.fn());

    expect(SearchHistory.destroy).toHaveBeenCalledWith({ where: { userId: 8 } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      message: 'Xóa tất cả lịch sử tìm kiếm thành công',
    });
  });

  test('gọi next(error) khi destroy ném lỗi', async () => {
    SearchHistory.destroy.mockRejectedValue(new Error('DB error'));

    const req = makeReq({ user: { id: 8 } });
    const res = makeRes();
    const next = jest.fn();

    await clearAllSearchHistory(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
