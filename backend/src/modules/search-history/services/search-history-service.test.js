/**
 * Unit tests cho SearchHistoryService
 * Pattern: mock repo module (singleton), test từng exported function trực tiếp.
 */

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock toàn bộ repo — service import trực tiếp module này
jest.mock('@modules/search-history/repositories/sequelize-search-history-repository', () => ({
  findDuplicate: jest.fn(),
  create: jest.fn(),
  findByUser: jest.fn(),
  findOneByUserAndId: jest.fn(),
  destroyByUser: jest.fn(),
}));

const service = require('./search-history-service');
const repo = require('@modules/search-history/repositories/sequelize-search-history-repository');
const { AppError } = require('@shared/errors');

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── saveSearch ───────────────────────────────────────────────────────────────

describe('saveSearch', () => {
  test('lưu mới khi chưa có duplicate trong 1 giờ', async () => {
    const newEntry = { id: 1, keyword: 'laptop', userId: 10, resultsCount: 5 };
    repo.findDuplicate.mockResolvedValue(null);
    repo.create.mockResolvedValue(newEntry);

    const result = await service.saveSearch({
      keyword: 'laptop',
      resultsCount: 5,
      userId: 10,
      sessionId: null,
    });

    expect(repo.findDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'laptop', userId: 10 }),
    );
    expect(repo.create).toHaveBeenCalledWith({
      userId: 10,
      keyword: 'laptop',
      resultsCount: 5,
      sessionId: null,
    });
    expect(result).toEqual({ created: true, data: newEntry });
  });

  test('không lưu khi đã có entry trong 1 giờ (dedup logic)', async () => {
    const existing = { id: 5, keyword: 'laptop', userId: 10 };
    repo.findDuplicate.mockResolvedValue(existing);

    const result = await service.saveSearch({
      keyword: 'laptop',
      resultsCount: 3,
      userId: 10,
      sessionId: null,
    });

    expect(repo.create).not.toHaveBeenCalled();
    expect(result).toEqual({ created: false, data: existing });
  });

  test('guest user: dùng sessionId thay vì userId', async () => {
    const newEntry = { id: 2, keyword: 'phone', sessionId: 'sess-abc' };
    repo.findDuplicate.mockResolvedValue(null);
    repo.create.mockResolvedValue(newEntry);

    const result = await service.saveSearch({
      keyword: 'phone',
      resultsCount: 8,
      userId: null,
      sessionId: 'sess-abc',
    });

    // findDuplicate nhận đúng args với sessionId
    expect(repo.findDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'phone', userId: null, sessionId: 'sess-abc' }),
    );
    expect(repo.create).toHaveBeenCalledWith({
      userId: null,
      keyword: 'phone',
      resultsCount: 8,
      sessionId: 'sess-abc',
    });
    expect(result.created).toBe(true);
  });

  test('userId và sessionId đều null → vẫn gọi findDuplicate và create', async () => {
    const newEntry = { id: 3, keyword: 'tv' };
    repo.findDuplicate.mockResolvedValue(null);
    repo.create.mockResolvedValue(newEntry);

    const result = await service.saveSearch({
      keyword: 'tv',
      resultsCount: 0,
      userId: null,
      sessionId: null,
    });

    expect(repo.findDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'tv', userId: null, sessionId: null }),
    );
    expect(result.created).toBe(true);
  });

  test('keyword rỗng → vẫn gọi repo (validation là tầng trên)', async () => {
    repo.findDuplicate.mockResolvedValue(null);
    repo.create.mockResolvedValue({ id: 4, keyword: '' });

    const result = await service.saveSearch({
      keyword: '',
      resultsCount: 0,
      userId: 7,
      sessionId: null,
    });

    expect(repo.findDuplicate).toHaveBeenCalled();
    expect(result.created).toBe(true);
  });
});

// ─── getHistory ───────────────────────────────────────────────────────────────

describe('getHistory', () => {
  test('lấy lịch sử với phân trang đúng — limit mặc định 10', async () => {
    const rows = [
      { id: 1, keyword: 'laptop' },
      { id: 2, keyword: 'phone' },
    ];
    repo.findByUser.mockResolvedValue(rows);

    const result = await service.getHistory({ userId: 5 });

    expect(repo.findByUser).toHaveBeenCalledWith({ userId: 5, limit: 10 });
    expect(result).toBe(rows);
  });

  test('truyền limit custom → parse sang integer', async () => {
    repo.findByUser.mockResolvedValue([]);

    await service.getHistory({ userId: 3, limit: '5' });

    expect(repo.findByUser).toHaveBeenCalledWith({ userId: 3, limit: 5 });
  });

  test('limit = 0 → parse sang 0', async () => {
    repo.findByUser.mockResolvedValue([]);

    await service.getHistory({ userId: 3, limit: '0' });

    expect(repo.findByUser).toHaveBeenCalledWith({ userId: 3, limit: 0 });
  });
});

// ─── deleteOne ────────────────────────────────────────────────────────────────

describe('deleteOne', () => {
  test('xóa đúng entry theo id + userId', async () => {
    const item = { id: 10, userId: 5, destroy: jest.fn().mockResolvedValue(undefined) };
    repo.findOneByUserAndId.mockResolvedValue(item);

    await service.deleteOne({ id: 10, userId: 5 });

    expect(repo.findOneByUserAndId).toHaveBeenCalledWith({ id: 10, userId: 5 });
    expect(item.destroy).toHaveBeenCalled();
  });

  test('entry không tồn tại → throw AppError 404', async () => {
    repo.findOneByUserAndId.mockResolvedValue(null);

    await expect(service.deleteOne({ id: 99, userId: 5 })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(service.deleteOne({ id: 99, userId: 5 })).rejects.toBeInstanceOf(AppError);
  });

  test('entry thuộc user khác → không tìm thấy (repository filter theo userId)', async () => {
    // Repository đã filter theo userId — nếu id không khớp userId → trả null
    repo.findOneByUserAndId.mockResolvedValue(null);

    await expect(service.deleteOne({ id: 10, userId: 999 })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ─── clearAll ─────────────────────────────────────────────────────────────────

describe('clearAll', () => {
  test('xóa hết history của user', async () => {
    repo.destroyByUser.mockResolvedValue(3); // 3 rows deleted

    const result = await service.clearAll({ userId: 7 });

    expect(repo.destroyByUser).toHaveBeenCalledWith({ userId: 7 });
    expect(result).toBe(3);
  });

  test('user không có history → trả 0', async () => {
    repo.destroyByUser.mockResolvedValue(0);

    const result = await service.clearAll({ userId: 99 });

    expect(repo.destroyByUser).toHaveBeenCalledWith({ userId: 99 });
    expect(result).toBe(0);
  });
});
