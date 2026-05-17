/**
 * Phase 44 — Unit tests cho VNPayService (services/payment/vnpay.js)
 * Cover: createPaymentUrl HMAC signing, verifyReturnUrl signature check, refund payload assembly.
 * Mock: axios (refund HTTP), env vars (TMN_CODE, HASH_SECRET).
 */

// Set env trước require
process.env.VNP_TMN_CODE = 'TESTTMN';
process.env.VNP_HASH_SECRET = 'test-secret-key-for-hmac-512';
process.env.VNP_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
process.env.VNP_RETURN_URL = 'http://localhost:8888/api/payments/vnpay/return';
process.env.VNP_API = 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';

// Mock axios cho refund (HTTP call)
jest.mock('axios', () => ({
  post: jest.fn(),
}));

const axios = require('axios');
const crypto = require('crypto');
const querystring = require('qs');

const vnpayService = require('../modules/payment/services/vnpayService');

beforeEach(() => {
  axios.post.mockReset();
});

describe('VNPayService.createPaymentUrl', () => {
  test('Trả về URL chứa vnp_SecureHash + vnp_Amount nhân 100 (cent of dong)', () => {
    const url = vnpayService.createPaymentUrl({
      orderId: 'ORD-123',
      amount: 50000,
      ipAddr: '127.0.0.1',
      orderInfo: 'Thanh toan don hang',
    });

    expect(url).toMatch(/^https:\/\/sandbox\.vnpayment\.vn\/paymentv2\/vpcpay\.html\?/);
    expect(url).toContain('vnp_TmnCode=TESTTMN');
    expect(url).toContain('vnp_TxnRef=ORD-123');
    expect(url).toContain('vnp_Amount=5000000'); // 50000 * 100
    expect(url).toContain('vnp_IpAddr=127.0.0.1');
    expect(url).toMatch(/vnp_SecureHash=[a-f0-9]{128}/); // SHA-512 = 128 hex chars
  });

  test('Default locale = "vn" khi không truyền', () => {
    const url = vnpayService.createPaymentUrl({
      orderId: 'X',
      amount: 1000,
      ipAddr: '1.1.1.1',
    });
    expect(url).toContain('vnp_Locale=vn');
  });

  test('Custom locale "en" được pass đúng', () => {
    const url = vnpayService.createPaymentUrl({
      orderId: 'X',
      amount: 1000,
      ipAddr: '1.1.1.1',
      locale: 'en',
    });
    expect(url).toContain('vnp_Locale=en');
  });

  test('orderInfo default = "Thanh toan cho ma GD:" + orderId khi rỗng', () => {
    const url = vnpayService.createPaymentUrl({
      orderId: 'XYZ',
      amount: 100,
      ipAddr: '1.1.1.1',
    });
    // sortObject replace space → '+' nên decode '+' về space thủ công
    const orderInfo = decodeURIComponent(url).replace(/\+/g, ' ');
    expect(orderInfo).toContain('Thanh toan cho ma GD:XYZ');
  });

  test('vnp_Amount round half-up cho số lẻ', () => {
    const url = vnpayService.createPaymentUrl({
      orderId: 'R',
      amount: 12345.678,
      ipAddr: '1.1.1.1',
    });
    // 12345.678 * 100 = 1234567.8 → Math.round → 1234568
    expect(url).toContain('vnp_Amount=1234568');
  });
});

describe('VNPayService.verifyReturnUrl', () => {
  // Helper: tạo signed params (giống logic VNPay) để test verify
  function buildSignedParams(rawParams) {
    const params = { ...rawParams };
    // Sort + encode giống VNPayService.sortObject
    const sorted = {};
    const keys = Object.keys(params).map(encodeURIComponent).sort();
    for (const k of keys) {
      sorted[k] = encodeURIComponent(params[k]).replace(/%20/g, '+');
    }
    const signData = querystring.stringify(sorted, { encode: false });
    const hmac = crypto.createHmac('sha512', process.env.VNP_HASH_SECRET);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    return { ...rawParams, vnp_SecureHash: signed };
  }

  test('Signature đúng → return true', () => {
    const params = buildSignedParams({
      vnp_TmnCode: 'TESTTMN',
      vnp_TxnRef: 'ORD-1',
      vnp_Amount: '5000000',
      vnp_ResponseCode: '00',
    });

    expect(vnpayService.verifyReturnUrl(params)).toBe(true);
  });

  test('Signature sai (tampered amount) → return false', () => {
    const params = buildSignedParams({
      vnp_TmnCode: 'TESTTMN',
      vnp_TxnRef: 'ORD-1',
      vnp_Amount: '5000000',
      vnp_ResponseCode: '00',
    });

    // Hacker đổi amount sau khi sign
    params.vnp_Amount = '1';

    expect(vnpayService.verifyReturnUrl(params)).toBe(false);
  });

  test('Drop vnp_SecureHashType khi compute signature (theo spec VNPay)', () => {
    const params = buildSignedParams({
      vnp_TmnCode: 'TESTTMN',
      vnp_TxnRef: 'ORD-2',
      vnp_Amount: '100',
    });

    // Inject vnp_SecureHashType vào params — service phải drop trước khi sign
    params.vnp_SecureHashType = 'SHA512';

    expect(vnpayService.verifyReturnUrl(params)).toBe(true);
  });
});

describe('VNPayService.refund', () => {
  test('POST đến VNP_API với payload + signature SHA-512', async () => {
    axios.post.mockResolvedValue({
      data: { vnp_ResponseCode: '00', vnp_Message: 'Success' },
    });

    const result = await vnpayService.refund({
      orderId: 'ORD-99',
      amount: 25000,
      transDate: '20260505100000',
      ipAddr: '127.0.0.1',
    });

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [calledUrl, calledBody] = axios.post.mock.calls[0];
    expect(calledUrl).toBe(process.env.VNP_API);
    expect(calledBody).toMatchObject({
      vnp_Version: '2.1.0',
      vnp_Command: 'refund',
      vnp_TmnCode: 'TESTTMN',
      vnp_TxnRef: 'ORD-99',
      vnp_Amount: 2500000, // 25000 * 100
      vnp_TransactionDate: '20260505100000',
      vnp_IpAddr: '127.0.0.1',
      vnp_CreateBy: 'Admin', // default
    });
    expect(calledBody.vnp_SecureHash).toMatch(/^[a-f0-9]{128}$/); // SHA-512
    expect(result).toEqual({ vnp_ResponseCode: '00', vnp_Message: 'Success' });
  });

  test('Custom transType + user', async () => {
    axios.post.mockResolvedValue({ data: { ok: true } });

    await vnpayService.refund({
      orderId: 'ORD-1',
      amount: 100,
      transDate: '20260505100000',
      transType: '03', // partial refund
      user: 'CustomerService',
      ipAddr: '10.0.0.1',
    });

    const [, calledBody] = axios.post.mock.calls[0];
    expect(calledBody.vnp_TransactionType).toBe('03');
    expect(calledBody.vnp_CreateBy).toBe('CustomerService');
  });
});

describe('VNPayService.sortObject', () => {
  test('Encode key + value, sort alphabet, replace %20 → +', () => {
    const sorted = vnpayService.sortObject({
      vnp_Z: 'last',
      vnp_A: 'hello world',
    });

    const keys = Object.keys(sorted);
    expect(keys).toEqual(['vnp_A', 'vnp_Z']); // sorted alphabet
    expect(sorted.vnp_A).toBe('hello+world'); // %20 → +
  });

  test('Bỏ qua inherited property — hasOwnProperty false branch (line 138)', () => {
    // Tạo object có inherited enumerable property → for..in sẽ iterate nó
    // nhưng hasOwnProperty trả false → bị bỏ qua (false branch)
    const proto = { inheritedKey: 'should-be-ignored' };
    const obj = Object.create(proto);
    obj.vnp_OwnKey = 'owned-value';

    const sorted = vnpayService.sortObject(obj);

    // Chỉ own property được giữ lại
    expect(Object.keys(sorted)).not.toContain('inheritedKey');
    expect(sorted).toHaveProperty('vnp_OwnKey');
  });

  test('Object rỗng → trả về object rỗng', () => {
    expect(vnpayService.sortObject({})).toEqual({});
  });
});
