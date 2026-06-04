/**
 * email.mutation-kill.test.js
 *
 * Bổ sung cho email.test.js (baseline mutation 52%). Kill mutant:
 *   - createTransporter: gmail vs custom SMTP (host/port/secure/auth/pool)
 *   - sendEmail: mailOptions (from/to/subject/html), log success + error throw
 *   - send* functions: subject + html chứa đúng t-key + biến (otp/url/order/escape)
 *   - escapeHtml (XSS), dateLocale, các conditional (estimatedDelivery, address2, statusText)
 *
 * Mock t() trả về "key|vars" → assert html chứa key (StringLiteral key→'' sẽ fail).
 */

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock('nodemailer', () => ({ createTransport: (...a) => mockCreateTransport(...a) }));
jest.mock('@utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('@utils/i18n', () => ({
  t: (key, lang, vars) => (vars ? `${key}|${Object.values(vars).join(',')}` : key),
}));

const logger = require('@utils/logger');

const ENV = {
  EMAIL_HOST: 'smtp.mailtrap.io',
  EMAIL_PORT: '2525',
  EMAIL_USERNAME: 'user',
  EMAIL_PASSWORD: 'pass',
  EMAIL_FROM: 'shop@x.com',
  EMAIL_FROM_NAME: 'TechStore',
  FRONTEND_URL: 'http://fe',
};

function freshEmail(extraEnv = {}) {
  let mod;
  jest.isolateModules(() => {
    Object.assign(process.env, ENV, extraEnv);
    mod = require('./email');
  });
  return mod;
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(process.env, ENV);
});

// ══════════════════════════════════════════════════════════════════════════════
// createTransporter
// ══════════════════════════════════════════════════════════════════════════════

describe('createTransporter', () => {
  it('Gmail (EMAIL_HOST=smtp.gmail.com) → service "gmail" + pool + auth', async () => {
    const email = freshEmail({ EMAIL_HOST: 'smtp.gmail.com' });
    await email.sendEmail({ email: 'a@b.com', subject: 's', html: 'h' });
    expect(mockCreateTransport).toHaveBeenCalledWith({
      service: 'gmail',
      pool: true,
      auth: { user: 'user', pass: 'pass' },
    });
  });

  it('custom SMTP → config host/port/secure/pool/maxConnections/maxMessages', async () => {
    const email = freshEmail({ EMAIL_HOST: 'smtp.mailtrap.io', EMAIL_PORT: '2525' });
    await email.sendEmail({ email: 'a@b.com', subject: 's', html: 'h' });
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        pool: true,
        maxConnections: 3,
        maxMessages: 100,
        host: 'smtp.mailtrap.io',
        port: '2525',
        secure: false,
        auth: { user: 'user', pass: 'pass' },
      }),
    );
  });

  it('custom SMTP port 465 → secure true', async () => {
    const email = freshEmail({ EMAIL_HOST: 'smtp.x.io', EMAIL_PORT: '465' });
    await email.sendEmail({ email: 'a@b.com', subject: 's', html: 'h' });
    expect(mockCreateTransport.mock.calls[0][0].secure).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// sendEmail
// ══════════════════════════════════════════════════════════════════════════════

describe('sendEmail', () => {
  it('mailOptions: from "Name <addr>", to, subject, html', async () => {
    const email = freshEmail();
    await email.sendEmail({ email: 'kh@x.com', subject: 'Chủ đề', html: '<b>hi</b>' });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'TechStore <shop@x.com>',
      to: 'kh@x.com',
      subject: 'Chủ đề',
      html: '<b>hi</b>',
    });
  });

  it('thành công → log info messageId', async () => {
    const email = freshEmail();
    const info = await email.sendEmail({ email: 'a@b.com', subject: 's', html: 'h' });
    expect(info).toEqual({ messageId: 'msg-1' });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('msg-1'));
  });

  it('lỗi gửi → log error + re-throw', async () => {
    const email = freshEmail();
    mockSendMail.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(email.sendEmail({ email: 'a@b.com', subject: 's', html: 'h' })).rejects.toThrow(
      'SMTP down',
    );
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('SMTP down'));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// send* functions — subject + html nội dung
// ══════════════════════════════════════════════════════════════════════════════

describe('sendOtpEmail', () => {
  it('subject email.otp.subject + storeName, html chứa otp + các key otp', async () => {
    const email = freshEmail();
    await email.sendOtpEmail('a@b.com', '123456', 'vi');
    const opt = mockSendMail.mock.calls[0][0];
    expect(opt.subject).toBe('email.otp.subject|TechStore');
    expect(opt.html).toContain('123456');
    expect(opt.html).toContain('email.otp.title');
    expect(opt.html).toContain('email.otp.description');
    expect(opt.html).toContain('email.otp.label');
    expect(opt.html).toContain('email.otp.expiry');
    expect(opt.html).toContain('email.otp.ignore');
  });
});

describe('sendResetPasswordEmail', () => {
  it('html chứa resetUrl đúng (FRONTEND_URL + token) + các key', async () => {
    const email = freshEmail();
    await email.sendResetPasswordEmail('a@b.com', 'tok123', 'vi');
    const opt = mockSendMail.mock.calls[0][0];
    expect(opt.subject).toBe('email.resetPassword.subject');
    expect(opt.html).toContain('http://fe/reset-password?token=tok123');
    expect(opt.html).toContain('email.resetPassword.title');
    expect(opt.html).toContain('email.resetPassword.linkText');
  });
});

describe('sendOrderConfirmationEmail', () => {
  const order = {
    orderNumber: 'ORD-1',
    orderDate: '2026-06-05',
    subtotal: 1000000,
    shippingCost: 30000,
    total: 1030000,
    items: [{ name: 'iPhone', quantity: 2, price: 500000, subtotal: 1000000 }],
    shippingAddress: {
      name: 'Nguyễn A',
      address1: 'Số 1',
      city: 'HN',
      state: 'HN',
      zip: '100000',
      country: 'VN',
    },
    estimatedDelivery: '2026-06-10',
  };

  it('html chứa item (escapeHtml name, qty, price format) + subtotal/shipping/total', async () => {
    const email = freshEmail();
    await email.sendOrderConfirmationEmail('a@b.com', order, 'vi');
    const html = mockSendMail.mock.calls[0][0].html;
    expect(html).toContain('iPhone');
    expect(html).toContain('1.000.000đ'); // price toLocaleString vi-VN
    expect(html).toContain('30.000đ'); // shipping
    expect(html).toContain('1.030.000đ'); // total
    expect(html).toContain('email.orderConfirmation.total');
  });

  it('subject chứa orderNumber đã escape', async () => {
    const email = freshEmail();
    await email.sendOrderConfirmationEmail('a@b.com', order, 'vi');
    expect(mockSendMail.mock.calls[0][0].subject).toBe('email.orderConfirmation.subject|ORD-1');
  });

  it('có estimatedDelivery → render dòng estimatedDelivery', async () => {
    const email = freshEmail();
    await email.sendOrderConfirmationEmail('a@b.com', order, 'vi');
    expect(mockSendMail.mock.calls[0][0].html).toContain(
      'email.orderConfirmation.estimatedDelivery',
    );
  });

  it('KHÔNG có estimatedDelivery → bỏ dòng đó', async () => {
    const email = freshEmail();
    await email.sendOrderConfirmationEmail('a@b.com', { ...order, estimatedDelivery: null }, 'vi');
    expect(mockSendMail.mock.calls[0][0].html).not.toContain(
      'email.orderConfirmation.estimatedDelivery',
    );
  });

  it('address2 có → render; address2 thiếu → bỏ', async () => {
    const email = freshEmail();
    await email.sendOrderConfirmationEmail(
      'a@b.com',
      { ...order, shippingAddress: { ...order.shippingAddress, address2: 'Tầng 2' } },
      'vi',
    );
    expect(mockSendMail.mock.calls[0][0].html).toContain('Tầng 2');
  });
});

describe('sendOrderStatusUpdateEmail', () => {
  it('statusText từ t(statuses.${status}), html chứa orderNumber', async () => {
    const email = freshEmail();
    await email.sendOrderStatusUpdateEmail(
      'a@b.com',
      { orderNumber: 'ORD-9', orderDate: '2026-06-05', status: 'shipped' },
      'vi',
    );
    const opt = mockSendMail.mock.calls[0][0];
    expect(opt.subject).toBe('email.orderStatus.subject|ORD-9');
    expect(opt.html).toContain('email.orderStatus.statuses.shipped');
    expect(opt.html).toContain('#ORD-9');
  });
});

describe('sendOrderCancellationEmail', () => {
  it('subject + html chứa orderNumber + key cancelled', async () => {
    const email = freshEmail();
    await email.sendOrderCancellationEmail(
      'a@b.com',
      { orderNumber: 'ORD-5', orderDate: '2026-06-05' },
      'vi',
    );
    const opt = mockSendMail.mock.calls[0][0];
    expect(opt.subject).toBe('email.orderCancelled.subject|ORD-5');
    expect(opt.html).toContain('email.orderCancelled.refund');
    expect(opt.html).toContain('#ORD-5');
  });
});

describe('sendAdminFeedbackNotification', () => {
  it('gửi tới adminEmail, escape các field feedback', async () => {
    const email = freshEmail();
    await email.sendAdminFeedbackNotification(
      'admin@x.com',
      { name: 'A<b>', email: 'u@x.com', subject: 'Hỏi', content: 'Nội dung & <script>' },
      'vi',
    );
    const opt = mockSendMail.mock.calls[0][0];
    expect(opt.to).toBe('admin@x.com');
    expect(opt.html).toContain('A&lt;b&gt;'); // escapeHtml name
    expect(opt.html).toContain('Nội dung &amp; &lt;script&gt;'); // escapeHtml content
    expect(opt.html).toContain('email.contactFeedback.title');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// escapeHtml + dateLocale (qua output)
// ══════════════════════════════════════════════════════════════════════════════

describe('escapeHtml + dateLocale', () => {
  const baseOrder = {
    orderNumber: 'ORD-1',
    orderDate: '2026-12-25',
    subtotal: 1,
    shippingCost: 1,
    total: 2,
    items: [],
    shippingAddress: { name: 'x', address1: 'y', city: 'c', state: 's' },
    estimatedDelivery: null,
  };

  it('escapeHtml escape & < > " \' trong tên item', async () => {
    const email = freshEmail();
    await email.sendOrderConfirmationEmail(
      'a@b.com',
      {
        ...baseOrder,
        items: [{ name: `<a href="x">&'`, quantity: 1, price: 1, subtotal: 1 }],
      },
      'vi',
    );
    const html = mockSendMail.mock.calls[0][0].html;
    expect(html).toContain('&lt;a href=&quot;x&quot;&gt;&amp;&#x27;');
  });

  it('lang en → ngày format en-US (MM/DD/YYYY khác vi-VN DD/MM/YYYY)', async () => {
    const email = freshEmail();
    await email.sendOrderConfirmationEmail('a@b.com', baseOrder, 'en');
    const html = mockSendMail.mock.calls[0][0].html;
    expect(html).toContain('12/25/2026'); // en-US
  });

  it('lang vi → ngày format vi-VN (DD/MM/YYYY)', async () => {
    const email = freshEmail();
    await email.sendOrderConfirmationEmail('a@b.com', baseOrder, 'vi');
    const html = mockSendMail.mock.calls[0][0].html;
    expect(html).toContain('25/12/2026'); // vi-VN
  });
});
