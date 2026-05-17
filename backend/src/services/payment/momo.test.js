/**
 * Phase 44 — Unit tests cho MoMoService (services/payment/momo.js)
 * Cover: createPaymentUrl signature compute + axios POST, verifySignature valid/invalid.
 * Mock: axios, logger.
 */

// Set env trước require
process.env.MOMO_PARTNER_CODE = 'TESTMOMO';
process.env.MOMO_ACCESS_KEY = 'test-access-key';
process.env.MOMO_SECRET_KEY = 'test-secret-key';
process.env.MOMO_API_ENDPOINT = 'https://test-payment.momo.vn/v2/gateway/api/create';
process.env.MOMO_REDIRECT_URL = 'http://localhost:5175/cart?status=momo-return';
process.env.MOMO_IPN_URL = 'http://localhost:8888/api/payments/momo/ipn';

jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const axios = require('axios');
const crypto = require('crypto');
const momoService = require('./momo');

beforeEach(() => {
  axios.post.mockReset();
});

describe('MoMoService.createPaymentUrl', () => {
  test('POST đến apiEndpoint với requestBody hợp lệ', async () => {
    axios.post.mockResolvedValue({
      data: { payUrl: 'https://test-payment.momo.vn/...', resultCode: 0 },
    });

    const result = await momoService.createPaymentUrl({
      orderId: 'ORD-100',
      amount: 50000,
      orderInfo: 'Thanh toan don hang',
    });

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [calledUrl, calledBody, calledOpts] = axios.post.mock.calls[0];
    expect(calledUrl).toBe(process.env.MOMO_API_ENDPOINT);
    expect(calledBody).toMatchObject({
      partnerCode: 'TESTMOMO',
      amount: 50000,
      orderInfo: 'Thanh toan don hang',
      lang: 'vi',
      requestType: 'captureWallet',
      ipnUrl: process.env.MOMO_IPN_URL,
      redirectUrl: process.env.MOMO_REDIRECT_URL,
    });
    expect(calledBody.signature).toMatch(/^[a-f0-9]{64}$/); // SHA-256 = 64 hex
    expect(calledBody.orderId).toMatch(/^ORD-100-\d{6}$/); // orderId + Date.now() last 6 digits
    expect(calledBody.requestId).toMatch(/^ORD-100-\d{6}-[a-f0-9]+$/);
    expect(calledOpts).toEqual({ timeout: 30000 });
    expect(result).toEqual({ payUrl: expect.any(String), resultCode: 0 });
  });

  test('Amount không nguyên → round (Math.round)', async () => {
    axios.post.mockResolvedValue({ data: { resultCode: 0 } });

    await momoService.createPaymentUrl({
      orderId: 'X',
      amount: 12345.67,
      orderInfo: 'X',
    });

    const [, body] = axios.post.mock.calls[0];
    expect(body.amount).toBe(12346);
  });

  test('Axios error → throw Error với JSON response data', async () => {
    axios.post.mockRejectedValue({
      response: { data: { resultCode: 99, message: 'Invalid' } },
    });

    await expect(
      momoService.createPaymentUrl({
        orderId: 'X',
        amount: 1000,
        orderInfo: 'X',
      })
    ).rejects.toThrow(/resultCode/);
  });

  test('Axios timeout/network error → throw Error với message', async () => {
    axios.post.mockRejectedValue(new Error('ETIMEDOUT'));

    await expect(
      momoService.createPaymentUrl({
        orderId: 'X',
        amount: 1000,
        orderInfo: 'X',
      })
    ).rejects.toThrow();
  });

  test('default extraData = "" khi không truyền', async () => {
    axios.post.mockResolvedValue({ data: { resultCode: 0 } });

    await momoService.createPaymentUrl({
      orderId: 'X',
      amount: 1000,
      orderInfo: 'X',
    });

    const [, body] = axios.post.mock.calls[0];
    expect(body.extraData).toBe('');
  });
});

// ─── Constructor — missing env vars → logger.warn (line 12) ──────────────────

describe('MoMoService constructor — thiếu env vars', () => {
  test('ghi logger.warn khi MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY không được set', () => {
    jest.resetModules();

    // Re-mock logger để capture warn trong module mới load
    const mockWarn = jest.fn();
    jest.mock('../../utils/logger', () => ({
      info: jest.fn(),
      warn: mockWarn,
      error: jest.fn(),
    }));
    jest.mock('axios', () => ({ post: jest.fn() }));

    // Xóa env vars — lưu giá trị cũ để restore
    const saved = {
      MOMO_PARTNER_CODE: process.env.MOMO_PARTNER_CODE,
      MOMO_ACCESS_KEY: process.env.MOMO_ACCESS_KEY,
      MOMO_SECRET_KEY: process.env.MOMO_SECRET_KEY,
      DEV_PARTNER_CODE: process.env.DEV_PARTNER_CODE,
      DEV_ACCESS_KEY: process.env.DEV_ACCESS_KEY,
      DEV_SECRET_KEY: process.env.DEV_SECRET_KEY,
    };
    delete process.env.MOMO_PARTNER_CODE;
    delete process.env.MOMO_ACCESS_KEY;
    delete process.env.MOMO_SECRET_KEY;
    delete process.env.DEV_PARTNER_CODE;
    delete process.env.DEV_ACCESS_KEY;
    delete process.env.DEV_SECRET_KEY;

    // Require fresh — constructor chạy ngay
    require('./momo');

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('MOMO_PARTNER_CODE')
    );

    // Restore
    Object.assign(process.env, saved);
    jest.resetModules();
  });
});

describe('MoMoService.verifySignature', () => {
  // Helper: tạo params có signature đúng
  function buildSignedParams(rawParams) {
    const {
      partnerCode = 'TESTMOMO',
      orderId = 'ORD-100',
      requestId = 'REQ-1',
      amount = 50000,
      orderInfo = 'Test',
      orderType = 'momo_wallet',
      transId = 99999,
      resultCode = 0,
      message = 'Success',
      payType = 'qr',
      responseTime = 1234567890,
      extraData = '',
    } = rawParams || {};

    const accessKey = process.env.MOMO_ACCESS_KEY;
    const rawSig =
      `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}` +
      `&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}` +
      `&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}` +
      `&resultCode=${resultCode}&transId=${transId}`;

    const signature = crypto
      .createHmac('sha256', process.env.MOMO_SECRET_KEY)
      .update(rawSig)
      .digest('hex');

    return {
      partnerCode, orderId, requestId, amount, orderInfo, orderType,
      transId, resultCode, message, payType, responseTime, extraData,
      signature,
    };
  }

  test('Signature hợp lệ → return true', () => {
    const params = buildSignedParams();
    expect(momoService.verifySignature(params)).toBe(true);
  });

  test('Signature sai (tampered amount) → return false', () => {
    const params = buildSignedParams();
    params.amount = 1; // tamper sau khi sign
    expect(momoService.verifySignature(params)).toBe(false);
  });

  test('Signature sai (tampered resultCode) → return false', () => {
    const params = buildSignedParams({ resultCode: 0 });
    params.resultCode = 1; // change result sau sign
    expect(momoService.verifySignature(params)).toBe(false);
  });

  test('Signature sai (tampered orderId) → return false', () => {
    const params = buildSignedParams();
    params.orderId = 'ORD-EVIL';
    expect(momoService.verifySignature(params)).toBe(false);
  });
});
