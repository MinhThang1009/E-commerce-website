// VNPay service — mutation-kill: assert OUTCOME (param value/key trong URL,
// vnp_CreateDate dạng 14-digit, refund dataObj fields + GOLDEN secureHash,
// verifyReturnUrl guard). Dùng moment THẬT (kill format string qua pattern
// \d{14}); golden-hash trích date thực tế từ payload → tất định theo run.

process.env.VNP_TMN_CODE = 'TESTTMN';
process.env.VNP_HASH_SECRET = 'test-secret-key-for-hmac-512';
process.env.VNP_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
process.env.VNP_RETURN_URL = 'http://localhost:8888/api/payments/vnpay/return';
process.env.VNP_API = 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';

jest.mock('axios', () => ({ post: jest.fn() }));

const axios = require('axios');
const crypto = require('crypto');
const querystring = require('qs');
const vnpayService = require('./vnpay-service');

const SECRET = 'test-secret-key-for-hmac-512';

beforeEach(() => axios.post.mockReset());

function parseUrlParams(url) {
  return querystring.parse(url.split('?')[1]);
}

describe('createPaymentUrl — param value/key + createDate format', () => {
  function build() {
    return vnpayService.createPaymentUrl({
      orderId: 'ORD-7',
      amount: 50000,
      ipAddr: '9.9.9.9',
      orderInfo: 'GD test',
    });
  }

  test('param hằng đúng giá trị (Version/Command/CurrCode/OrderType)', () => {
    const url = build();
    expect(url).toContain('vnp_Version=2.1.0');
    expect(url).toContain('vnp_Command=pay');
    expect(url).toContain('vnp_CurrCode=VND');
    expect(url).toContain('vnp_OrderType=other');
  });

  test('vnp_CreateDate = 14 chữ số (kill format YYYYMMDDHHmmss → "")', () => {
    const p = parseUrlParams(build());
    expect(p.vnp_CreateDate).toMatch(/^\d{14}$/);
  });

  test('vnp_ReturnUrl = returnUrl từ env', () => {
    const p = parseUrlParams(build());
    expect(decodeURIComponent(p.vnp_ReturnUrl)).toBe(process.env.VNP_RETURN_URL);
  });

  test('vnp_Amount = round(amount*100), vnp_TxnRef = orderId, có KEY vnp_OrderInfo', () => {
    const p = parseUrlParams(build());
    expect(p.vnp_Amount).toBe('5000000');
    expect(p.vnp_TxnRef).toBe('ORD-7');
    expect(p).toHaveProperty('vnp_OrderInfo'); // kill mutant key 'vnp_OrderInfo' → ''
  });

  test('round-trip: verifyReturnUrl(params parse từ URL) = true (kill encode mismatch L39)', () => {
    // create ký bằng {encode:false}; verify cũng {encode:false}. Nếu mutant đổi
    // encode ở 1 bên → signData lệch → verify=false.
    const params = parseUrlParams(build());
    expect(vnpayService.verifyReturnUrl(params)).toBe(true);
  });

  test('orderInfo rỗng → default "Thanh toan cho ma GD:" + orderId', () => {
    const url = vnpayService.createPaymentUrl({ orderId: 'ZZ', amount: 100, ipAddr: '1.1.1.1' });
    const decoded = decodeURIComponent(url).replace(/\+/g, ' ');
    expect(decoded).toContain('Thanh toan cho ma GD:ZZ');
  });

  test('URL có vnp_SecureHash 128 hex (SHA-512) + bắt đầu bằng vnpUrl?', () => {
    const url = build();
    expect(url.startsWith(`${process.env.VNP_URL}?`)).toBe(true);
    expect(parseUrlParams(url).vnp_SecureHash).toMatch(/^[a-f0-9]{128}$/);
  });
});

describe('verifyReturnUrl — guard', () => {
  function signed(raw) {
    const sorted = {};
    const keys = Object.keys(raw).map(encodeURIComponent).sort();
    for (const k of keys) sorted[k] = encodeURIComponent(raw[k]).replace(/%20/g, '+');
    const signData = querystring.stringify(sorted, { encode: false });
    const h = crypto
      .createHmac('sha512', SECRET)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');
    return { ...raw, vnp_SecureHash: h };
  }

  test('hash đúng → true', () => {
    expect(vnpayService.verifyReturnUrl(signed({ vnp_TxnRef: 'A', vnp_Amount: '100' }))).toBe(true);
  });

  test('KHÔNG có vnp_SecureHash → false (guard !secureHash)', () => {
    expect(vnpayService.verifyReturnUrl({ vnp_TxnRef: 'A', vnp_Amount: '100' })).toBe(false);
  });

  test('hash sai độ dài → false (length guard, không gọi timingSafeEqual)', () => {
    expect(
      vnpayService.verifyReturnUrl({ vnp_TxnRef: 'A', vnp_Amount: '100', vnp_SecureHash: 'abc' }),
    ).toBe(false);
  });

  test('hash đúng độ dài nhưng sai nội dung → false', () => {
    const p = signed({ vnp_TxnRef: 'A', vnp_Amount: '100' });
    p.vnp_SecureHash = 'f'.repeat(128);
    expect(vnpayService.verifyReturnUrl(p)).toBe(false);
  });
});

describe('refund — dataObj fields + GOLDEN secureHash', () => {
  test('payload đúng + secureHash khớp chuỗi pipe spec VNPay', async () => {
    axios.post.mockResolvedValue({ data: { vnp_ResponseCode: '00' } });

    await vnpayService.refund({
      orderId: 'ORD-99',
      amount: 25000,
      transDate: '20260505100000',
      ipAddr: '127.0.0.1',
    });

    const [, body] = axios.post.mock.calls[0];
    expect(body).toMatchObject({
      vnp_Version: '2.1.0',
      vnp_Command: 'refund',
      vnp_TmnCode: 'TESTTMN',
      vnp_TransactionType: '02', // default
      vnp_TxnRef: 'ORD-99',
      vnp_Amount: 2500000, // 25000 * 100
      vnp_TransactionNo: '0',
      vnp_CreateBy: 'Admin', // default
      vnp_OrderInfo: 'Hoan tien GD ma:ORD-99',
      vnp_TransactionDate: '20260505100000',
      vnp_IpAddr: '127.0.0.1',
    });
    // date tất định theo moment thật → assert dạng (kill format string)
    expect(body.vnp_RequestId).toMatch(/^\d{6}$/);
    expect(body.vnp_CreateDate).toMatch(/^\d{14}$/);

    // GOLDEN: chuỗi pipe đúng thứ tự spec, trích date THỰC TẾ từ payload (oracle
    // độc lập với vòng nối production) → đổi separator/thứ tự ở code = hash lệch.
    const expectedData = [
      body.vnp_RequestId,
      '2.1.0',
      'refund',
      'TESTTMN',
      '02',
      'ORD-99',
      2500000,
      '0',
      '20260505100000',
      'Admin',
      body.vnp_CreateDate,
      '127.0.0.1',
      'Hoan tien GD ma:ORD-99',
    ].join('|');
    const expectedHash = crypto
      .createHmac('sha512', SECRET)
      .update(Buffer.from(expectedData, 'utf-8'))
      .digest('hex');

    expect(body.vnp_SecureHash).toBe(expectedHash);
  });

  test('custom transType + user → vào payload', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await vnpayService.refund({
      orderId: 'O',
      amount: 1,
      transDate: '20260505100000',
      transType: '03',
      user: 'CSKH',
      ipAddr: '1.1.1.1',
    });
    const [, body] = axios.post.mock.calls[0];
    expect(body.vnp_TransactionType).toBe('03');
    expect(body.vnp_CreateBy).toBe('CSKH');
  });

  test('POST đúng VNP_API + trả response.data', async () => {
    axios.post.mockResolvedValue({ data: { vnp_ResponseCode: '00', x: 1 } });
    const result = await vnpayService.refund({
      orderId: 'O',
      amount: 1,
      transDate: 'D',
      ipAddr: 'I',
    });
    expect(axios.post.mock.calls[0][0]).toBe(process.env.VNP_API);
    expect(result).toEqual({ vnp_ResponseCode: '00', x: 1 });
  });
});
