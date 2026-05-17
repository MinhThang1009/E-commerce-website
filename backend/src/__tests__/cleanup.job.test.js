// Unit tests cho runDailyCleanup và runWeeklyCleanup (src/jobs/cleanup.js)
// Mock: models, fs, node-cron, logger, imageService — không chạm DB hay disk thật

jest.mock('node-cron', () => ({ schedule: jest.fn() }));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// ─── Mock models ──────────────────────────────────────────────────────────────

const mockCartDestroy = jest.fn();
const mockSequelizeQuery = jest.fn();
const mockUserUpdate = jest.fn();
const mockDiscountCodeUpdate = jest.fn();
const mockChatMessageUpdate = jest.fn();
const mockRecentlyViewedDestroy = jest.fn();

jest.mock('../models', () => ({
  Cart: { destroy: (...args) => mockCartDestroy(...args) },
  SearchHistory: {},
  User: { update: (...args) => mockUserUpdate(...args) },
  DiscountCode: { update: (...args) => mockDiscountCodeUpdate(...args) },
  ChatMessage: { update: (...args) => mockChatMessageUpdate(...args) },
  RecentlyViewed: { destroy: (...args) => mockRecentlyViewedDestroy(...args) },
  sequelize: { query: (...args) => mockSequelizeQuery(...args) },
}));

// ─── Mock fs để kiểm soát file operations ─────────────────────────────────────

const mockReaddir = jest.fn();
const mockStat = jest.fn();
const mockUnlink = jest.fn();

jest.mock('fs', () => ({
  promises: {
    readdir: (...args) => mockReaddir(...args),
    stat: (...args) => mockStat(...args),
    unlink: (...args) => mockUnlink(...args),
  },
}));

// ─── Mock imageService ────────────────────────────────────────────────────────

const mockCleanupOrphanedFiles = jest.fn();
jest.mock('../modules/image/services/imageService', () => ({
  cleanupOrphanedFiles: (...args) => mockCleanupOrphanedFiles(...args),
}));

const logger = require('../utils/logger');
const { runDailyCleanup, runWeeklyCleanup } = require('../jobs/cleanup');

// ════════════════════════════════════════════════════════════════════════════
// runDailyCleanup — các bước cleanup
// ════════════════════════════════════════════════════════════════════════════

describe('runDailyCleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: mọi operation thành công, không có rows bị ảnh hưởng
    mockCartDestroy.mockResolvedValue(0);
    mockSequelizeQuery.mockResolvedValue([null, { affectedRows: 0 }]);
    mockUserUpdate.mockResolvedValue([null, 0]);
    mockDiscountCodeUpdate.mockResolvedValue([null, 0]);
    mockChatMessageUpdate.mockResolvedValue([null, 0]);
    mockRecentlyViewedDestroy.mockResolvedValue(0);
    // fs — tempDir không tồn tại
    mockReaddir.mockRejectedValue(new Error('ENOENT'));
  });

  test('step 1: xóa abandoned carts cũ hơn 30 ngày — gọi Cart.destroy', async () => {
    mockCartDestroy.mockResolvedValue(3);

    await runDailyCleanup();

    expect(mockCartDestroy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'abandoned' }),
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('3 abandoned carts'));
  });

  test('step 1: không log khi deletedCarts = 0', async () => {
    mockCartDestroy.mockResolvedValue(0);

    await runDailyCleanup();

    const infoCalls = logger.info.mock.calls.map((c) => c[0]);
    expect(infoCalls.some((msg) => msg.includes('abandoned carts'))).toBe(false);
  });

  test('step 1: log warn khi Cart.destroy ném lỗi (không throw ra ngoài)', async () => {
    mockCartDestroy.mockRejectedValue(new Error('DB timeout'));

    await expect(runDailyCleanup()).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi xóa abandoned carts'),
      expect.any(String),
    );
  });

  test('step 2: trim search history — gọi sequelize.query', async () => {
    mockSequelizeQuery.mockResolvedValue([null, { affectedRows: 12 }]);

    await runDailyCleanup();

    expect(mockSequelizeQuery).toHaveBeenCalledWith(expect.stringContaining('search_histories'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('12 search history records'));
  });

  test('step 2: log warn khi sequelize.query ném lỗi', async () => {
    mockSequelizeQuery.mockRejectedValue(new Error('Query fail'));

    await expect(runDailyCleanup()).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi trim search history'),
      expect.any(String),
    );
  });

  test('step 3: xóa expired OTP — gọi User.update với otpCode=null', async () => {
    mockUserUpdate.mockResolvedValueOnce([null, 5]); // OTP step
    mockUserUpdate.mockResolvedValueOnce([null, 0]); // token step

    await runDailyCleanup();

    const [firstUpdateArgs] = mockUserUpdate.mock.calls;
    expect(firstUpdateArgs[0]).toMatchObject({ otpCode: null, otpExpires: null });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('5 expired OTP'));
  });

  test('step 3: log warn khi User.update (OTP) ném lỗi', async () => {
    mockUserUpdate.mockRejectedValueOnce(new Error('OTP update fail'));
    mockUserUpdate.mockResolvedValueOnce([null, 0]);

    await expect(runDailyCleanup()).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi xóa expired OTP'),
      expect.any(String),
    );
  });

  test('step 4: xóa expired reset tokens — gọi User.update với resetPasswordToken=null', async () => {
    mockUserUpdate.mockResolvedValueOnce([null, 0]); // OTP step
    mockUserUpdate.mockResolvedValueOnce([null, 2]); // token step

    await runDailyCleanup();

    const [, secondUpdateArgs] = mockUserUpdate.mock.calls;
    expect(secondUpdateArgs[0]).toMatchObject({
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('2 expired reset tokens'));
  });

  test('step 5: deactivate expired discount codes', async () => {
    mockDiscountCodeUpdate.mockResolvedValue([null, 4]);

    await runDailyCleanup();

    expect(mockDiscountCodeUpdate).toHaveBeenCalledWith(
      { isActive: false },
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('4 expired discount codes'));
  });

  test('step 5: log warn khi DiscountCode.update ném lỗi', async () => {
    mockDiscountCodeUpdate.mockRejectedValue(new Error('fail'));

    await expect(runDailyCleanup()).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi deactivate expired discount codes'),
      expect.any(String),
    );
  });

  test('step 6: archive chat messages cũ hơn 90 ngày', async () => {
    mockChatMessageUpdate.mockResolvedValue([null, 7]);

    await runDailyCleanup();

    expect(mockChatMessageUpdate).toHaveBeenCalledWith({ isArchived: true }, expect.any(Object));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('7 chat messages cũ'));
  });

  test('step 7: xóa recently viewed cũ hơn 90 ngày', async () => {
    mockRecentlyViewedDestroy.mockResolvedValue(15);

    await runDailyCleanup();

    expect(mockRecentlyViewedDestroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.any(Object) }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('15 recently viewed records cũ'),
    );
  });

  test('step 7: log warn khi RecentlyViewed.destroy ném lỗi', async () => {
    mockRecentlyViewedDestroy.mockRejectedValue(new Error('fail'));

    await expect(runDailyCleanup()).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi xóa recently viewed cũ'),
      expect.any(String),
    );
  });

  test('step 8: dọn temp files — xóa file cũ hơn 24 giờ', async () => {
    const oldTime = Date.now() - 25 * 60 * 60 * 1000; // 25 giờ trước
    mockReaddir.mockResolvedValue(['old_file.tmp', 'new_file.tmp']);
    mockStat.mockImplementation((filePath) => {
      if (filePath.includes('old_file')) return Promise.resolve({ mtimeMs: oldTime });
      return Promise.resolve({ mtimeMs: Date.now() - 1000 }); // còn mới
    });
    mockUnlink.mockResolvedValue(undefined);

    await runDailyCleanup();

    // old_file.tmp phải bị xóa, new_file.tmp không
    const unlinkedPaths = mockUnlink.mock.calls.map(([p]) => p);
    expect(unlinkedPaths.some((p) => p.includes('old_file'))).toBe(true);
    expect(unlinkedPaths.some((p) => p.includes('new_file'))).toBe(false);
  });

  test('step 8: bỏ qua khi tempDir không tồn tại (không throw)', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT: no such file'));

    await expect(runDailyCleanup()).resolves.not.toThrow();
  });

  test('log "Daily cleanup completed" ở cuối', async () => {
    await runDailyCleanup();

    expect(logger.info).toHaveBeenCalledWith('[Cleanup] Daily cleanup completed');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// runWeeklyCleanup
// ════════════════════════════════════════════════════════════════════════════

describe('runWeeklyCleanup', () => {
  beforeEach(() => jest.clearAllMocks());

  test('gọi imageService.cleanupOrphanedFiles() và log success', async () => {
    mockCleanupOrphanedFiles.mockResolvedValue(undefined);

    await runWeeklyCleanup();

    expect(mockCleanupOrphanedFiles).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Weekly orphaned file cleanup completed'),
    );
  });

  test('log warn khi imageService ném lỗi (không throw)', async () => {
    mockCleanupOrphanedFiles.mockRejectedValue(new Error('disk error'));

    await expect(runWeeklyCleanup()).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi weekly cleanup'),
      expect.any(String),
    );
  });
});
