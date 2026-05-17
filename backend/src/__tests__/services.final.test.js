/**
 * services.final.test.js
 *
 * Targeted tests for uncovered branches in:
 *   1. src/services/payment/momo.js — verifySignature early-return + createPaymentUrl error
 *   3. src/services/payment/vnpay.js — verifyReturnUrl early-return when secureHash missing
 *   4. src/jobs/cleanup.js          — runDailyCleanup step 4 warn + step 6 warn
 *
 * Each group mocks only the external boundary it needs, nothing else.
 */

process.env.NODE_ENV = 'test';

// ─── Shared logger mock ───────────────────────────────────────────────────────

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ════════════════════════════════════════════════════════════════════════════
// GROUP 1 — services/payment/momo.js
//
// Uncovered branches:
//   - verifySignature: early return false when signature is missing or length mismatch
//   - createPaymentUrl: catch branch when axios.post rejects
// ════════════════════════════════════════════════════════════════════════════

describe('MoMoService.verifySignature — early return branches', () => {
  let momoService;

  beforeAll(() => {
    jest.isolateModules(() => {
      process.env.DEV_PARTNER_CODE = 'PARTNER';
      process.env.DEV_ACCESS_KEY = 'ACCESS';
      process.env.DEV_SECRET_KEY = 'supersecretkey';
      jest.mock('axios', () => ({ post: jest.fn() }));
      momoService = require('../services/payment/momo');
    });
  });

  test('trả về false khi signature là undefined', () => {
    const params = {
      partnerCode: 'PARTNER',
      orderId: 'ORD-1',
      requestId: 'REQ-1',
      amount: '100000',
      orderInfo: 'Test',
      orderType: 'momo_wallet',
      transId: 'TXN-1',
      resultCode: '0',
      message: 'Success',
      payType: 'wallet',
      responseTime: '1234567890',
      extraData: '',
      signature: undefined,
    };
    expect(momoService.verifySignature(params)).toBe(false);
  });

  test('trả về false khi signature có độ dài khác checkSignature', () => {
    const params = {
      partnerCode: 'PARTNER',
      orderId: 'ORD-1',
      requestId: 'REQ-1',
      amount: '100000',
      orderInfo: 'Test',
      orderType: 'momo_wallet',
      transId: 'TXN-1',
      resultCode: '0',
      message: 'Success',
      payType: 'wallet',
      responseTime: '1234567890',
      extraData: '',
      // Deliberately wrong length (too short)
      signature: 'tooshort',
    };
    expect(momoService.verifySignature(params)).toBe(false);
  });
});

describe('MoMoService.createPaymentUrl — catch branch khi axios.post thất bại', () => {
  let momoService;
  let mockPost;

  beforeAll(() => {
    jest.isolateModules(() => {
      process.env.DEV_PARTNER_CODE = 'PARTNER';
      process.env.DEV_ACCESS_KEY = 'ACCESS';
      process.env.DEV_SECRET_KEY = 'supersecretkey';
      process.env.DEV_MOMO_ENDPOINT = 'http://localhost:9000';
      process.env.MOMO_REDIRECT_URL = 'http://localhost:3000/return';
      process.env.MOMO_IPN_URL = 'http://localhost:8888/ipn';
      mockPost = jest.fn();
      jest.mock('axios', () => ({ post: (...args) => mockPost(...args) }));
      momoService = require('../services/payment/momo');
    });
  });

  test('ném lỗi khi axios.post reject — error message chứa thông tin từ response', async () => {
    const apiError = new Error('connection refused');
    apiError.response = { data: { message: 'Service unavailable' } };
    mockPost.mockRejectedValue(apiError);

    await expect(
      momoService.createPaymentUrl({
        orderId: 'ORD-fail',
        amount: 50000,
        orderInfo: 'Test payment',
      }),
    ).rejects.toThrow(/"message":"Service unavailable"/);
  });

  test('ném lỗi khi axios.post reject và không có response data — sử dụng error message', async () => {
    mockPost.mockRejectedValue(new Error('timeout'));

    await expect(
      momoService.createPaymentUrl({
        orderId: 'ORD-timeout',
        amount: 10000,
        orderInfo: 'Test',
      }),
    ).rejects.toThrow('timeout');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GROUP 3 — services/payment/vnpay.js
//
// Uncovered branch: verifyReturnUrl early-return false when
//   !secureHash || secureHash.length !== signed.length
// (The existing test only tests valid + tampered signatures — never null/missing.)
// ════════════════════════════════════════════════════════════════════════════

describe('VNPayService.verifyReturnUrl — missing/mismatched secureHash', () => {
  // The vnpayService singleton is already loaded by vnpayService.unit.test.js
  // in --runInBand mode. Jest isolates module cache per test file, so we load
  // a fresh instance here with the same env vars.
  let vnpayService;

  beforeAll(() => {
    jest.isolateModules(() => {
      process.env.VNP_TMN_CODE = 'TESTTMN';
      process.env.VNP_HASH_SECRET = 'test-secret-for-vnpay';
      process.env.VNP_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
      process.env.VNP_RETURN_URL = 'http://localhost:8888/return';
      jest.mock('axios', () => ({ post: jest.fn() }));
      vnpayService = require('../services/payment/vnpay');
    });
  });

  test('trả về false khi vnp_SecureHash bị thiếu (undefined)', () => {
    const params = {
      vnp_TmnCode: 'TESTTMN',
      vnp_TxnRef: 'ORD-123',
      vnp_Amount: '5000000',
      vnp_ResponseCode: '00',
      // vnp_SecureHash intentionally absent
    };
    expect(vnpayService.verifyReturnUrl(params)).toBe(false);
  });

  test('trả về false khi vnp_SecureHash có độ dài sai (quá ngắn)', () => {
    const params = {
      vnp_TmnCode: 'TESTTMN',
      vnp_TxnRef: 'ORD-123',
      vnp_Amount: '5000000',
      vnp_ResponseCode: '00',
      vnp_SecureHash: 'abc123', // SHA-512 cần 128 hex chars — đây chỉ 6 chars
    };
    expect(vnpayService.verifyReturnUrl(params)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GROUP 4 — jobs/cleanup.js
//
// The existing cleanup.job.test.js covers most branches.
// Uncovered: step 4 (reset tokens) warn path + step 6 (chat) warn path.
// However, examining cleanup.job.test.js shows it only has tests for OTP warn
// but not the reset-token warn — so we verify that here with isolated mocks.
// ════════════════════════════════════════════════════════════════════════════

describe('runDailyCleanup — step 4 warn when reset token update fails', () => {
  jest.mock('node-cron', () => ({ schedule: jest.fn() }));

  const mockCartDestroy = jest.fn().mockResolvedValue(0);
  const mockSequelizeQuery = jest.fn().mockResolvedValue([null, { affectedRows: 0 }]);
  const mockUserUpdate = jest.fn();
  const mockDiscountCodeUpdate = jest.fn().mockResolvedValue([null, 0]);
  const mockChatMessageUpdate = jest.fn().mockResolvedValue([null, 0]);
  const mockRecentlyViewedDestroy = jest.fn().mockResolvedValue(0);
  const mockReaddir = jest.fn().mockRejectedValue(new Error('ENOENT'));

  let runDailyCleanup;
  let logger;

  beforeAll(() => {
    jest.isolateModules(() => {
      jest.mock('../models', () => ({
        Cart: { destroy: (...a) => mockCartDestroy(...a) },
        SearchHistory: {},
        User: { update: (...a) => mockUserUpdate(...a) },
        DiscountCode: { update: (...a) => mockDiscountCodeUpdate(...a) },
        ChatMessage: { update: (...a) => mockChatMessageUpdate(...a) },
        RecentlyViewed: { destroy: (...a) => mockRecentlyViewedDestroy(...a) },
        sequelize: { query: (...a) => mockSequelizeQuery(...a) },
      }));
      jest.mock('fs', () => ({
        promises: {
          readdir: (...a) => mockReaddir(...a),
          stat: jest.fn(),
          unlink: jest.fn(),
        },
      }));
      jest.mock('../services/image', () => ({ cleanupOrphanedFiles: jest.fn() }));

      logger = require('../utils/logger');
      ({ runDailyCleanup } = require('../jobs/cleanup'));
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCartDestroy.mockResolvedValue(0);
    mockSequelizeQuery.mockResolvedValue([null, { affectedRows: 0 }]);
    mockDiscountCodeUpdate.mockResolvedValue([null, 0]);
    mockChatMessageUpdate.mockResolvedValue([null, 0]);
    mockRecentlyViewedDestroy.mockResolvedValue(0);
    mockReaddir.mockRejectedValue(new Error('ENOENT'));
  });

  test('step 4: log warn khi User.update (reset token) ném lỗi — không throw ra ngoài', async () => {
    // step 3 (OTP) thành công, step 4 (reset token) ném lỗi
    mockUserUpdate
      .mockResolvedValueOnce([null, 0]) // OTP update succeeds
      .mockRejectedValueOnce(new Error('Token update DB error')); // reset token fails

    await expect(runDailyCleanup()).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi xóa expired reset tokens'),
      expect.any(String),
    );
  });

  test('step 6: log warn khi ChatMessage.update ném lỗi — không throw ra ngoài', async () => {
    mockUserUpdate.mockResolvedValue([null, 0]);
    mockChatMessageUpdate.mockRejectedValue(new Error('Chat archive fail'));

    await expect(runDailyCleanup()).resolves.not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi archive chat messages'),
      expect.any(String),
    );
  });

  test('step 8: bỏ qua file không đọc được bên trong temp dir — không throw', async () => {
    mockReaddir.mockResolvedValue(['bad_file.tmp']);
    // stat ném lỗi cho file này
    const fsMod = require('fs');
    fsMod.promises.stat.mockRejectedValue(new Error('EPERM'));

    await expect(runDailyCleanup()).resolves.not.toThrow();
  });
});
