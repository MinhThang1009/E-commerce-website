/**
 * momo-service.test.js
 * Covers: constructor warning (line 18), createPaymentUrl error (line 67),
 *         verifySignature timingSafeEqual (line 99)
 */
process.env.NODE_ENV = 'test';

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('axios');

const logger = require('@utils/logger');
const axios = require('axios');

// ─── Constructor — credentials không được set (line 18) ────────────────────────

describe('MoMoService constructor — thiếu credentials', () => {
  let originalPartner, originalAccess, originalSecret;

  beforeEach(() => {
    originalPartner = process.env.DEV_PARTNER_CODE;
    originalAccess = process.env.DEV_ACCESS_KEY;
    originalSecret = process.env.DEV_SECRET_KEY;
    delete process.env.DEV_PARTNER_CODE;
    delete process.env.DEV_ACCESS_KEY;
    delete process.env.DEV_SECRET_KEY;
    delete process.env.MOMO_PARTNER_CODE;
    delete process.env.MOMO_ACCESS_KEY;
    delete process.env.MOMO_SECRET_KEY;
  });

  afterEach(() => {
    if (originalPartner !== undefined) process.env.DEV_PARTNER_CODE = originalPartner;
    if (originalAccess !== undefined) process.env.DEV_ACCESS_KEY = originalAccess;
    if (originalSecret !== undefined) process.env.DEV_SECRET_KEY = originalSecret;
  });

  it('log warn khi thiếu credentials', () => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));
    jest.mock('axios');
    require('./momo-service');
    const warnLogger = require('@utils/logger');
    expect(warnLogger.warn).toHaveBeenCalledWith(expect.stringContaining('MOMO_PARTNER_CODE'));
  });
});

// ─── createPaymentUrl — axios throw lỗi (line 67) ─────────────────────────────

describe('MoMoService.createPaymentUrl — axios throw', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DEV_PARTNER_CODE = 'TEST_PARTNER';
    process.env.DEV_ACCESS_KEY = 'TEST_ACCESS';
    process.env.DEV_SECRET_KEY = 'TEST_SECRET';
    process.env.MOMO_REDIRECT_URL = 'http://localhost/redirect';
    process.env.MOMO_IPN_URL = 'http://localhost/ipn';
  });

  it('throw khi axios.post thất bại', async () => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));
    const axiosMock = require('axios');
    axiosMock.post = jest.fn().mockRejectedValue({ message: 'timeout', response: null });

    const momoService = require('./momo-service');
    await expect(
      momoService.createPaymentUrl({ orderId: 'ORD-001', amount: 100000, orderInfo: 'Test' }),
    ).rejects.toThrow();
  });

  it('trả về response.data khi axios.post thành công (line 67)', async () => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));
    const axiosMock = require('axios');
    axiosMock.post = jest
      .fn()
      .mockResolvedValue({ data: { payUrl: 'https://momo.test/pay', resultCode: 0 } });

    const momoService = require('./momo-service');
    const result = await momoService.createPaymentUrl({
      orderId: 'ORD-002',
      amount: 50000,
      orderInfo: 'Test',
    });
    expect(result.payUrl).toBe('https://momo.test/pay');
  });
});

// ─── verifySignature — timingSafeEqual (line 99) ──────────────────────────────

describe('MoMoService.verifySignature — timingSafeEqual', () => {
  let momoService;
  const crypto = require('crypto');

  beforeEach(() => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));
    process.env.DEV_PARTNER_CODE = 'TEST';
    process.env.DEV_ACCESS_KEY = 'testAccess';
    process.env.DEV_SECRET_KEY = 'testSecret';
    momoService = require('./momo-service');
  });

  it('trả về false khi chữ ký không khớp (đúng độ dài)', () => {
    const params = {
      partnerCode: 'TEST',
      orderId: 'ORD-001',
      requestId: 'REQ-001',
      amount: 100000,
      orderInfo: 'Test',
      orderType: 'momo_wallet',
      transId: '12345678',
      resultCode: '0',
      message: 'Success',
      payType: 'qr',
      responseTime: '1000000',
      extraData: '',
      signature: 'a'.repeat(64), // cùng độ dài hex SHA256 nhưng giá trị sai
    };
    const result = momoService.verifySignature(params);
    expect(result).toBe(false);
  });

  it('trả về true khi chữ ký đúng', () => {
    const params = {
      partnerCode: 'TEST',
      orderId: 'ORD-001',
      requestId: 'REQ-001',
      amount: 100000,
      orderInfo: 'Test',
      orderType: 'momo_wallet',
      transId: '12345678',
      resultCode: '0',
      message: 'Success',
      payType: 'qr',
      responseTime: '1000000',
      extraData: '',
    };
    // Tính signature đúng
    const raw = `accessKey=testAccess&amount=${params.amount}&extraData=${params.extraData}&message=${params.message}&orderId=${params.orderId}&orderInfo=${params.orderInfo}&orderType=${params.orderType}&partnerCode=${params.partnerCode}&payType=${params.payType}&requestId=${params.requestId}&responseTime=${params.responseTime}&resultCode=${params.resultCode}&transId=${params.transId}`;
    const correctSig = crypto.createHmac('sha256', 'testSecret').update(raw).digest('hex');
    const result = momoService.verifySignature({ ...params, signature: correctSig });
    expect(result).toBe(true);
  });

  it('trả về false khi signature null', () => {
    const result = momoService.verifySignature({ signature: null });
    expect(result).toBe(false);
  });
});
