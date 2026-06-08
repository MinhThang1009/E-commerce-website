/**
 * Coverage gaps batch 4 — statements/functions/lines còn thiếu.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// rate-limiter: L65, L121, L134 (handler callbacks khi vượt limit)
// Dùng jest.doMock để capture handler options từ express-rate-limit
// ═══════════════════════════════════════════════════════════════════════════════
describe('rate-limiter handler callbacks (L65, L121, L134)', () => {
  let capturedOptions;
  let mockLogger;

  beforeAll(() => {
    jest.resetModules();
    capturedOptions = [];
    mockLogger = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

    jest.doMock('express-rate-limit', () =>
      jest.fn().mockImplementation((options) => {
        capturedOptions.push(options);
        if (options?.store?.init) options.store.init({ windowMs: options.windowMs || 60000 });
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        return mw;
      }),
    );
    jest.doMock('@utils/logger', () => mockLogger);
    jest.doMock('@utils/i18n', () => ({ t: (key) => key }));

    require('@middlewares/rate-limiter');
  });

  afterAll(() => jest.resetModules());

  function findByWindowAndMax(windowMs, max) {
    return capturedOptions.find((o) => o.windowMs === windowMs && o.max === max);
  }

  function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  }

  test('apiLimiter handler → 429 (L65)', () => {
    const opts = findByWindowAndMax(
      15 * 60 * 1000,
      process.env.NODE_ENV === 'development' ? 1000 : 100,
    );
    expect(opts?.handler).toBeDefined();
    const res = makeRes();
    opts.handler({ locale: 'vi' }, res, jest.fn(), { statusCode: 429 });
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('destructiveLimiter handler → 429 (L121)', () => {
    const opts = findByWindowAndMax(15 * 60 * 1000, 10);
    expect(opts?.handler).toBeDefined();
    const res = makeRes();
    opts.handler({ locale: 'vi' }, res, jest.fn(), { statusCode: 429 });
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('chatLimiter handler → 429 (L134)', () => {
    const opts = findByWindowAndMax(5 * 60 * 1000, 30);
    expect(opts?.handler).toBeDefined();
    const res = makeRes();
    opts.handler({ locale: 'vi' }, res, jest.fn(), { statusCode: 429 });
    expect(res.status).toHaveBeenCalledWith(429);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ai-service: L113 (.catch analytics error)
// ═══════════════════════════════════════════════════════════════════════════════
describe('ai-service: addToCart analytics catch (L113)', () => {
  beforeAll(() => jest.resetModules());

  test('analytics event fails → warn logged, no throw', async () => {
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    }));
    const logger = require('@utils/logger');
    const AIService = require('@modules/ai/services/core/ai-service');
    const repo = {
      addToCart: jest.fn().mockResolvedValue({ id: 1, quantity: 1 }),
      createAnalyticsEvent: jest.fn().mockRejectedValue(new Error('analytics fail')),
    };
    const svc = new AIService({ aiRepository: repo, logger });
    await svc.addToCart({ userId: 1, productId: 1, sessionId: 's1', quantity: 1 });
    await new Promise((r) => setTimeout(r, 50));
    expect(logger.warn).toHaveBeenCalledWith(
      '[Analytics] addToCart event thất bại:',
      'analytics fail',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// reviews-repository: L103 (runInTransaction)
// ═══════════════════════════════════════════════════════════════════════════════
describe('reviews-repository: runInTransaction (L103)', () => {
  test('runInTransaction gọi sequelize.transaction', async () => {
    const ReviewsRepo = require('@modules/reviews/repositories/sequelize-reviews-repository');
    const txMock = jest.fn(async (cb) => cb('tx'));
    const repo = new ReviewsRepo({
      Review: { sequelize: { transaction: txMock } },
      Product: {},
      Order: {},
    });
    const result = await repo.runInTransaction((t) => t);
    expect(txMock).toHaveBeenCalled();
    expect(result).toBe('tx');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// upload-service: processMultipleUpload happy path (function coverage)
// ═══════════════════════════════════════════════════════════════════════════════
describe('upload-service: processMultipleUpload', () => {
  const logger = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

  test('processSingleUpload: invalid uploadType + deleteFile fails → still throw (L62 catch)', async () => {
    const UploadService = require('@modules/upload/services/upload-service');
    const svc = new UploadService({
      uploadRepository: { deleteFile: jest.fn().mockRejectedValue(new Error('disk')) },
      uploadDirs: { product: '/uploads/product' },
      logger,
    });
    await expect(
      svc.processSingleUpload({ file: { path: '/tmp/x.jpg' }, uploadType: 'INVALID' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('no files → throw upload.noFile', async () => {
    const UploadService = require('@modules/upload/services/upload-service');
    const svc = new UploadService({ uploadRepository: {}, uploadDirs: {}, logger });
    await expect(
      svc.processMultipleUpload({ files: [], uploadType: 'product' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('invalid uploadType → delete all + throw', async () => {
    const UploadService = require('@modules/upload/services/upload-service');
    const deleteFn = jest.fn().mockResolvedValue();
    const svc = new UploadService({
      uploadRepository: { deleteFile: deleteFn },
      uploadDirs: { product: '/uploads/product' },
      logger,
    });
    await expect(
      svc.processMultipleUpload({
        files: [{ path: '/tmp/a.jpg' }],
        uploadType: 'INVALID',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(deleteFn).toHaveBeenCalledWith('/tmp/a.jpg');
  });

  test('valid files → returns validFiles with URLs', async () => {
    const UploadService = require('@modules/upload/services/upload-service');
    const pngHeader = Buffer.alloc(12);
    pngHeader.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const svc = new UploadService({
      uploadRepository: {
        readFileHeader: jest.fn().mockResolvedValue(pngHeader),
        deleteFile: jest.fn(),
      },
      uploadDirs: { product: '/uploads/product' },
      logger,
    });
    const result = await svc.processMultipleUpload({
      files: [{ path: '/tmp/a.png', filename: 'a.png' }],
      uploadType: 'product',
    });
    expect(result).toHaveLength(1);
    expect(result[0].url).toContain('product');
  });
});
