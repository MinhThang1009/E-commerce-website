/**
 * cleanup.mutation-kill.test.js
 *
 * Kill mutant cleanup.js: cron.schedule (cron expr), runDailyCleanup (7 op WHERE/dates/logs),
 * cleanupTempFiles (fs maxAge), runWeeklyCleanup (imageService).
 */

const mockSchedule = jest.fn();
jest.mock('node-cron', () => ({ schedule: (...a) => mockSchedule(...a) }));
jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockReaddir = jest.fn();
const mockStat = jest.fn();
const mockUnlink = jest.fn();
jest.mock('fs', () => ({
  promises: {
    readdir: (...a) => mockReaddir(...a),
    stat: (...a) => mockStat(...a),
    unlink: (...a) => mockUnlink(...a),
  },
}));

const mockModels = {
  Cart: { destroy: jest.fn().mockResolvedValue(0) },
  User: { update: jest.fn().mockResolvedValue([0, 0]) },
  DiscountCode: { update: jest.fn().mockResolvedValue([0, 0]) },
  ChatMessage: { update: jest.fn().mockResolvedValue([0, 0]) },
  RecentlyViewed: { destroy: jest.fn().mockResolvedValue(0) },
  SearchHistory: {},
  sequelize: { query: jest.fn().mockResolvedValue([[], { affectedRows: 0 }]) },
};
jest.mock('@models', () => mockModels);

const mockCleanupOrphaned = jest.fn().mockResolvedValue();
jest.mock('@modules/image/services/image-service', () => ({
  cleanupOrphanedFiles: (...a) => mockCleanupOrphaned(...a),
}));

const { Op } = require('sequelize');
const logger = require('@utils/logger');
const cleanup = require('@jobs/cleanup');

beforeEach(() => {
  jest.clearAllMocks();
  mockModels.Cart.destroy.mockResolvedValue(0);
  mockModels.User.update.mockResolvedValue([0, 0]);
  mockModels.DiscountCode.update.mockResolvedValue([0, 0]);
  mockModels.ChatMessage.update.mockResolvedValue([0, 0]);
  mockModels.RecentlyViewed.destroy.mockResolvedValue(0);
  mockModels.sequelize.query.mockResolvedValue([[], { affectedRows: 0 }]);
  mockReaddir.mockResolvedValue([]);
});

afterEach(() => jest.useRealTimers());

// ══════════════════════════════════════════════════════════════════════════════
// cron registration
// ══════════════════════════════════════════════════════════════════════════════

describe('cron schedule', () => {
  it('đăng ký daily 2AM "0 2 * * *" + weekly CN 3AM "0 3 * * 0"', () => {
    // require lại fresh để bắt schedule calls (beforeEach clearAllMocks đã xoá calls lúc load đầu)
    jest.isolateModules(() => require('@jobs/cleanup'));
    const exprs = mockSchedule.mock.calls.map((c) => c[0]);
    expect(exprs).toContain('0 2 * * *');
    expect(exprs).toContain('0 3 * * 0');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// runDailyCleanup — WHERE clauses + dates
// ══════════════════════════════════════════════════════════════════════════════

describe('runDailyCleanup', () => {
  it('xóa abandoned carts cũ hơn 30 ngày (Op.lt thirtyDaysAgo)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T00:00:00Z'));
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await cleanup.runDailyCleanup();
    expect(mockModels.Cart.destroy).toHaveBeenCalledWith({
      where: { status: 'abandoned', updatedAt: { [Op.lt]: thirtyDaysAgo } },
    });
  });

  it('OTP: null-out khi otpExpires < now AND otpCode != null', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T00:00:00Z'));
    await cleanup.runDailyCleanup();
    expect(mockModels.User.update).toHaveBeenCalledWith(
      { otpCode: null, otpExpires: null },
      { where: { otpExpires: { [Op.lt]: new Date() }, otpCode: { [Op.ne]: null } } },
    );
  });

  it('DiscountCode: deactivate endDate < now AND isActive true', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T00:00:00Z'));
    await cleanup.runDailyCleanup();
    expect(mockModels.DiscountCode.update).toHaveBeenCalledWith(
      { isActive: false },
      { where: { endDate: { [Op.lt]: new Date() }, isActive: true } },
    );
  });

  it('ChatMessage: archive createdAt cũ hơn 90 ngày', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T00:00:00Z'));
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await cleanup.runDailyCleanup();
    expect(mockModels.ChatMessage.update).toHaveBeenCalledWith(
      { isArchived: true },
      { where: { createdAt: { [Op.lt]: ninetyDaysAgo }, isArchived: { [Op.or]: [false, null] } } },
    );
  });

  it('RecentlyViewed: xóa viewedAt cũ hơn 90 ngày', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T00:00:00Z'));
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await cleanup.runDailyCleanup();
    expect(mockModels.RecentlyViewed.destroy).toHaveBeenCalledWith({
      where: { viewedAt: { [Op.lt]: ninetyDaysAgo } },
    });
  });

  it('log số bản ghi khi op > 0', async () => {
    mockModels.Cart.destroy.mockResolvedValue(5);
    await cleanup.runDailyCleanup();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('5 abandoned carts'));
  });

  it('op lỗi → log warn, không throw (tiếp tục op khác)', async () => {
    mockModels.Cart.destroy.mockRejectedValue(new Error('db down'));
    await expect(cleanup.runDailyCleanup()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('abandoned carts'), 'db down');
    expect(mockModels.DiscountCode.update).toHaveBeenCalled(); // op sau vẫn chạy
  });

  it('completed log cuối', async () => {
    await cleanup.runDailyCleanup();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Daily cleanup completed'));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// cleanupTempFiles (qua runDailyCleanup) — fs maxAge
// ══════════════════════════════════════════════════════════════════════════════

describe('cleanupTempFiles', () => {
  it('xóa file cũ hơn 24h, giữ file mới', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T00:00:00Z'));
    mockReaddir.mockResolvedValue(['old.tmp', 'new.tmp']);
    mockStat.mockImplementation((p) =>
      Promise.resolve({ mtimeMs: p.includes('old') ? Date.now() - 25 * 3600 * 1000 : Date.now() }),
    );
    await cleanup.runDailyCleanup();
    expect(mockUnlink).toHaveBeenCalledTimes(1);
    expect(mockUnlink.mock.calls[0][0]).toContain('old.tmp');
  });

  it('readdir lỗi (tempDir chưa tồn tại) → bỏ qua, không throw', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT'));
    await expect(cleanup.runDailyCleanup()).resolves.toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// runWeeklyCleanup
// ══════════════════════════════════════════════════════════════════════════════

describe('runWeeklyCleanup', () => {
  it('gọi imageService.cleanupOrphanedFiles', async () => {
    await cleanup.runWeeklyCleanup();
    expect(mockCleanupOrphaned).toHaveBeenCalled();
  });

  it('lỗi → log warn, không throw', async () => {
    mockCleanupOrphaned.mockRejectedValueOnce(new Error('weekly fail'));
    await expect(cleanup.runWeeklyCleanup()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('weekly'), 'weekly fail');
  });
});
