// MoMo service — mutation-kill: assert OUTCOME (requestBody fields, momoOrderId/
// requestId pattern, GOLDEN HMAC-SHA256 signature, verifySignature guard,
// error path, constructor env-fallback + apiEndpoint + warning). Mock axios.
// Golden-sig: dựng rawSignature ĐỘC LẬP (viết tay theo spec MoMo), trích
// orderId/requestId thực tế từ body → tất định theo run.

process.env.NODE_ENV = 'test';
process.env.DEV_PARTNER_CODE = 'PARTNER123';
process.env.DEV_ACCESS_KEY = 'ACCESS123';
process.env.DEV_SECRET_KEY = 'SECRET123';
process.env.MOMO_REDIRECT_URL = 'http://localhost:5175/payment/momo/return';
process.env.MOMO_IPN_URL = 'http://localhost:8888/api/payments/momo/ipn';
process.env.MOMO_API_ENDPOINT = 'https://test-payment.momo.vn/v2/gateway/api/create';
delete process.env.DEV_MOMO_ENDPOINT;

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('axios');

const axios = require('axios');
const crypto = require('crypto');
const logger = require('@utils/logger');
const momoService = require('./momo-service');

const SECRET = 'SECRET123';
const ACCESS = 'ACCESS123';
const PARTNER = 'PARTNER123';
const REDIRECT = 'http://localhost:5175/payment/momo/return';
const IPN = 'http://localhost:8888/api/payments/momo/ipn';

beforeEach(() => {
  axios.post.mockReset();
  logger.error.mockClear();
});

describe('createPaymentUrl — requestBody fields + GOLDEN signature', () => {
  async function call(over = {}) {
    axios.post.mockResolvedValue({ data: { payUrl: 'https://momo/x' } });
    const data = await momoService.createPaymentUrl({
      orderId: 'ORD-50',
      amount: 99999,
      orderInfo: 'Thanh toan ORD-50',
      ...over,
    });
    const [url, body, opts] = axios.post.mock.calls[0];
    return { data, url, body, opts };
  }

  test('requestBody hằng đúng (partnerName/storeId/lang/requestType) + amount round', async () => {
    const { body } = await call({ amount: 99999.7 });
    expect(body.partnerName).toBe('E-commerce Mini');
    expect(body.storeId).toBe('E-commerce-Store');
    expect(body.lang).toBe('vi');
    expect(body.requestType).toBe('captureWallet');
    expect(body.amount).toBe(100000); // Math.round(99999.7)
    expect(body.partnerCode).toBe(PARTNER);
    expect(body.redirectUrl).toBe(REDIRECT);
    expect(body.ipnUrl).toBe(IPN);
  });

  test('momoOrderId = {orderId}-{6 số cuối timestamp}, requestId = {momoOrderId}-{uuid8}', async () => {
    const { body } = await call();
    expect(body.orderId).toMatch(/^ORD-50-\d{6}$/);
    expect(body.requestId).toMatch(/^ORD-50-\d{6}-[0-9a-f]+$/);
  });

  test('extraData default = "" khi không truyền', async () => {
    const { body } = await call();
    expect(body.extraData).toBe('');
  });

  test('axios.post gọi đúng apiEndpoint + timeout 30000', async () => {
    const { url, opts } = await call();
    expect(url).toBe(process.env.MOMO_API_ENDPOINT);
    expect(opts).toEqual({ timeout: 30000 });
  });

  test('GOLDEN signature = HMAC-SHA256 trên rawSignature spec MoMo', async () => {
    const { body } = await call({ extraData: 'eyJvcmRlcklkIjo1MH0=' });

    // rawSignature theo đúng thứ tự field MoMo (viết tay làm oracle độc lập)
    const raw =
      `accessKey=${ACCESS}` +
      `&amount=${body.amount}` +
      `&extraData=${body.extraData}` +
      `&ipnUrl=${IPN}` +
      `&orderId=${body.orderId}` +
      `&orderInfo=${body.orderInfo}` +
      `&partnerCode=${PARTNER}` +
      `&redirectUrl=${REDIRECT}` +
      `&requestId=${body.requestId}` +
      `&requestType=captureWallet`;
    const expected = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');

    expect(body.signature).toBe(expected);
    expect(body.signature).toMatch(/^[a-f0-9]{64}$/); // SHA-256
  });

  test('axios lỗi → logger.error + throw JSON.stringify(error.response.data)', async () => {
    axios.post.mockRejectedValue({ response: { data: { resultCode: 99, message: 'fail' } } });

    await expect(
      momoService.createPaymentUrl({ orderId: 'O', amount: 1, orderInfo: 'x' }),
    ).rejects.toThrow(JSON.stringify({ resultCode: 99, message: 'fail' }));
    expect(logger.error).toHaveBeenCalledWith('Lỗi tạo thanh toán MoMo:', {
      resultCode: 99,
      message: 'fail',
    });
  });

  test('axios lỗi không có response → throw JSON.stringify(error.message) (L69 || branch)', async () => {
    axios.post.mockRejectedValue({ message: 'ECONNREFUSED' });

    await expect(
      momoService.createPaymentUrl({ orderId: 'O', amount: 1, orderInfo: 'x' }),
    ).rejects.toThrow(JSON.stringify('ECONNREFUSED'));
    expect(logger.error).toHaveBeenCalledWith('Lỗi tạo thanh toán MoMo:', 'ECONNREFUSED');
  });
});

describe('verifySignature', () => {
  // Dựng signature đúng theo rawSignature của verifySignature (thứ tự field khác create)
  function sign(params) {
    const raw =
      `accessKey=${ACCESS}` +
      `&amount=${params.amount}` +
      `&extraData=${params.extraData}` +
      `&message=${params.message}` +
      `&orderId=${params.orderId}` +
      `&orderInfo=${params.orderInfo}` +
      `&orderType=${params.orderType}` +
      `&partnerCode=${params.partnerCode}` +
      `&payType=${params.payType}` +
      `&requestId=${params.requestId}` +
      `&responseTime=${params.responseTime}` +
      `&resultCode=${params.resultCode}` +
      `&transId=${params.transId}`;
    return crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  }

  const base = {
    partnerCode: PARTNER,
    orderId: 'ORD-1-123456',
    requestId: 'req-1',
    amount: 50000,
    orderInfo: 'info',
    orderType: 'momo_wallet',
    transId: 999,
    resultCode: 0,
    message: 'Successful',
    payType: 'qr',
    responseTime: 1700000000000,
    extraData: '',
  };

  test('signature đúng → true', () => {
    const params = { ...base, signature: sign(base) };
    expect(momoService.verifySignature(params)).toBe(true);
  });

  test('signature sai nội dung (đúng độ dài) → false', () => {
    const params = { ...base, signature: 'a'.repeat(64) };
    expect(momoService.verifySignature(params)).toBe(false);
  });

  test('thiếu signature → false (guard !signature)', () => {
    expect(momoService.verifySignature({ ...base })).toBe(false);
  });

  test('signature sai độ dài → false (length guard, không gọi timingSafeEqual)', () => {
    expect(momoService.verifySignature({ ...base, signature: 'abc' })).toBe(false);
  });

  test('tamper amount sau khi ký → false', () => {
    const params = { ...base, signature: sign(base) };
    params.amount = 1; // hacker đổi tiền
    expect(momoService.verifySignature(params)).toBe(false);
  });
});

describe('constructor — env fallback + apiEndpoint + warning', () => {
  const ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ENV };
    jest.resetModules();
  });

  function freshService(envOver) {
    jest.resetModules();
    jest.doMock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));
    jest.doMock('axios');
    Object.assign(process.env, envOver);
    const svc = require('./momo-service');
    const log = require('@utils/logger');
    return { svc, log };
  }

  test('DEV_MOMO_ENDPOINT set → apiEndpoint = {DEV}/create', async () => {
    const { svc } = freshService({ DEV_MOMO_ENDPOINT: 'https://custom.momo' });
    const axiosMock = require('axios');
    axiosMock.post.mockResolvedValue({ data: {} });
    await svc.createPaymentUrl({ orderId: 'O', amount: 1, orderInfo: 'x' });
    expect(axiosMock.post.mock.calls[0][0]).toBe('https://custom.momo/create');
  });

  test('thiếu MỘT credential (secretKey) → vẫn logger.warn', () => {
    delete process.env.DEV_SECRET_KEY;
    delete process.env.MOMO_SECRET_KEY;
    const { log } = freshService({ DEV_PARTNER_CODE: 'P', DEV_ACCESS_KEY: 'A' });
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('MoMo'));
  });

  test('đủ 3 credential → KHÔNG warn', () => {
    const { log } = freshService({
      DEV_PARTNER_CODE: 'P',
      DEV_ACCESS_KEY: 'A',
      DEV_SECRET_KEY: 'S',
    });
    expect(log.warn).not.toHaveBeenCalled();
  });

  test('DEV_PARTNER_CODE rỗng → fallback MOMO_PARTNER_CODE (L14 ||)', async () => {
    delete process.env.DEV_PARTNER_CODE;
    const { svc } = freshService({
      MOMO_PARTNER_CODE: 'MOMO-PARTNER',
      DEV_ACCESS_KEY: 'A',
      DEV_SECRET_KEY: 'S',
    });
    const axiosMock = require('axios');
    axiosMock.post.mockResolvedValue({ data: {} });
    await svc.createPaymentUrl({ orderId: 'O', amount: 1, orderInfo: 'x' });
    expect(axiosMock.post.mock.calls[0][1].partnerCode).toBe('MOMO-PARTNER');
  });
});
