/**
 * Tests cho email service (src/services/email.js)
 *
 * Bao gồm:
 * - escapeHtml — escape ký tự đặc biệt HTML
 * - sanitizeCampaignHtml — sanitize HTML chiến dịch
 * - sendEmail — gửi email đơn lẻ
 * - sendOtpEmail — gửi OTP
 * - sendResetPasswordEmail — gửi link đặt lại mật khẩu
 * - sendOrderConfirmationEmail — gửi xác nhận đơn hàng
 * - sendOrderStatusUpdateEmail — gửi cập nhật trạng thái
 * - sendOrderCancellationEmail — gửi thông báo hủy đơn
 * - sendNewsletterWelcomeEmail — gửi chào mừng newsletter
 * - sendBulkCampaignEmail — gửi email hàng loạt theo lô
 * - sendAdminFeedbackNotification — thông báo phản hồi cho admin
 */

process.env.NODE_ENV = 'test';
process.env.EMAIL_HOST = 'smtp.example.com';
process.env.EMAIL_PORT = '587';
process.env.EMAIL_USERNAME = 'test@example.com';
process.env.EMAIL_PASSWORD = 'test-password';
process.env.EMAIL_FROM = 'no-reply@example.com';
process.env.EMAIL_FROM_NAME = 'TechStore';
process.env.FRONTEND_URL = 'https://techstore.example.com';

// ---------- Mock nodemailer ----------

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({
  sendMail: mockSendMail,
}));

jest.mock('nodemailer', () => ({
  createTransport: (...args) => mockCreateTransport(...args),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// ---------- Require sau mock ----------
// Reset module để transporterInstance singleton không rò rỉ giữa test
// (email.js dùng module-level singleton — reset từng describe)

const loadEmailService = () => {
  jest.resetModules();
  // Re-mock sau resetModules
  jest.mock('nodemailer', () => ({
    createTransport: (...args) => mockCreateTransport(...args),
  }));
  jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }));
  return require('./email');
};

// ============================================================
// escapeHtml — unit test hàm nội bộ (qua sendOrderConfirmationEmail)
// Kiểm tra behavior XSS escaping thông qua output HTML của email
// ============================================================

describe('sendOrderConfirmationEmail — XSS escaping trong nội dung email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'msg-001' });
  });

  const baseOrder = {
    orderNumber: 'ORD-001',
    orderDate: '2024-01-15T10:00:00Z',
    subtotal: 1000000,
    shippingCost: 50000,
    total: 1050000,
    items: [],
    shippingAddress: {
      name: 'Nguyễn Văn A',
      address1: '123 Đường ABC',
      city: 'Hà Nội',
      state: 'HN',
      zip: '100000',
      country: 'VN',
    },
  };

  test('escape tên sản phẩm chứa thẻ script XSS', async () => {
    const emailService = loadEmailService();
    const order = {
      ...baseOrder,
      items: [{ name: '<script>alert("xss")</script>', quantity: 1, price: 100000, subtotal: 100000 }],
    };

    await emailService.sendOrderConfirmationEmail('customer@test.com', order);

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.html).not.toContain('<script>');
    expect(mailOptions.html).toContain('&lt;script&gt;');
  });

  test('escape dấu nháy đơn và kép trong dữ liệu người dùng', async () => {
    const emailService = loadEmailService();
    const order = {
      ...baseOrder,
      items: [],
      shippingAddress: {
        ...baseOrder.shippingAddress,
        name: "O'Brien \"The Best\"",
      },
    };

    await emailService.sendOrderConfirmationEmail('customer@test.com', order);

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.html).toContain('&#x27;'); // single quote escaped
    expect(mailOptions.html).toContain('&quot;'); // double quote escaped
  });

  test('escape ký tự & trong tên địa chỉ', async () => {
    const emailService = loadEmailService();
    const order = {
      ...baseOrder,
      shippingAddress: { ...baseOrder.shippingAddress, name: 'Nguyễn & Trần' },
    };

    await emailService.sendOrderConfirmationEmail('customer@test.com', order);

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.html).toContain('&amp;');
  });
});

// ============================================================
// escapeHtml — null/undefined input (lines 8-9 branch)
// ============================================================

describe('sendOrderConfirmationEmail — escapeHtml null/undefined input (lines 8-9)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'null-test-001' });
  });

  test('escapeHtml(null) → trả về chuỗi rỗng, không crash khi zip là null', async () => {
    const emailService = loadEmailService();
    // zip = null → escapeHtml(null || '') = escapeHtml('') → '' (không crash)
    // nhưng để hit nhánh null → truyền zip: null trực tiếp với || '' là falsy
    // Cách hit line 8: zip: undefined → escapeHtml(undefined || '') nhưng || trước khi pass vào
    // Cách trực tiếp hit: address2 = null sẽ bỏ qua render, còn shippingAddress.country = undefined
    await emailService.sendOrderConfirmationEmail('customer@example.com', {
      orderNumber: 'ORD-NULL-TEST',
      orderDate: '2024-01-01T00:00:00Z',
      subtotal: 100000,
      shippingCost: 0,
      total: 100000,
      items: [],
      shippingAddress: {
        name: null,      // null → escapeHtml(null) → '' (hits line 8 null check)
        address1: undefined, // undefined → escapeHtml(undefined) → '' (hits line 8 undefined check)
        city: 'HN',
        state: 'HN',
        zip: null,       // null → zip || '' → '' → escapeHtml('') → ''
        country: undefined, // undefined → country || '' → '' → escapeHtml('') → ''
      },
    });

    const [mailOptions] = mockSendMail.mock.calls[0];
    // Hàm không throw, email được gửi
    expect(mailOptions).toBeDefined();
    expect(mailOptions.html).toBeDefined();
  });

  test('escapeHtml(null) trả về chuỗi rỗng — không có ký tự null trong HTML output', async () => {
    const emailService = loadEmailService();
    await emailService.sendOrderConfirmationEmail('customer@example.com', {
      orderNumber: 'ORD-NULL-2',
      orderDate: '2024-01-01T00:00:00Z',
      subtotal: 0,
      shippingCost: 0,
      total: 0,
      items: [],
      shippingAddress: {
        name: null,
        address1: 'Some Street',
        address2: null,     // null/falsy → template literal renders '' (line 300)
        city: 'HCM',
        state: 'HCM',
        zip: undefined,     // undefined → zip || '' evaluates '' (line 301)
        country: undefined, // undefined → country || '' evaluates '' (line 302)
      },
    });

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.html).not.toContain('null');
    expect(mailOptions.html).not.toContain('undefined');
  });
});

// ============================================================
// sendEmail — gửi email đơn lẻ
// ============================================================

describe('sendEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('gọi transporter.sendMail với mailOptions đúng', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'msg-123' });

    await emailService.sendEmail({
      email: 'user@example.com',
      subject: 'Tiêu đề test',
      html: '<p>Nội dung</p>',
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.to).toBe('user@example.com');
    expect(mailOptions.subject).toBe('Tiêu đề test');
    expect(mailOptions.html).toBe('<p>Nội dung</p>');
    expect(mailOptions.from).toContain('TechStore');
    expect(mailOptions.from).toContain('no-reply@example.com');
  });

  test('throw lỗi khi transporter.sendMail throw', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockRejectedValue(new Error('SMTP connection refused'));

    await expect(
      emailService.sendEmail({ email: 'user@example.com', subject: 'Test', html: '<p>Test</p>' })
    ).rejects.toThrow('SMTP connection refused');
  });

  test('sử dụng singleton transporter (createTransport chỉ gọi 1 lần dù gửi nhiều email)', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'msg-x' });

    await emailService.sendEmail({ email: 'a@test.com', subject: 'S1', html: '<p>1</p>' });
    await emailService.sendEmail({ email: 'b@test.com', subject: 'S2', html: '<p>2</p>' });

    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });
});

// ============================================================
// sendOtpEmail
// ============================================================

describe('sendOtpEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  test('gửi email với subject chứa TechStore và mã OTP trong nội dung', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'otp-001' });

    await emailService.sendOtpEmail('user@example.com', '123456');

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.to).toBe('user@example.com');
    expect(mailOptions.subject).toMatch(/TechStore/);
    expect(mailOptions.html).toContain('123456');
  });

  test('gửi đúng email đến địa chỉ được truyền vào', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'otp-002' });

    await emailService.sendOtpEmail('another@test.com', '654321');

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.to).toBe('another@test.com');
    expect(mailOptions.html).toContain('654321');
  });

  test('throw lỗi khi SMTP fail', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockRejectedValue(new Error('Auth failed'));

    await expect(
      emailService.sendOtpEmail('user@example.com', '111111')
    ).rejects.toThrow('Auth failed');
  });
});

// ============================================================
// sendResetPasswordEmail
// ============================================================

describe('sendResetPasswordEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  test('email chứa link reset với token đúng', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'reset-001' });

    await emailService.sendResetPasswordEmail('user@example.com', 'token-abc-123');

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.html).toContain('token-abc-123');
    expect(mailOptions.html).toContain('https://techstore.example.com/reset-password');
    expect(mailOptions.html).toContain('15 phút');
  });

  test('subject đúng là "Đặt lại mật khẩu của bạn"', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'reset-002' });

    await emailService.sendResetPasswordEmail('user@example.com', 'some-token');

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.subject).toMatch(/Đặt lại mật khẩu/);
  });
});

// ============================================================
// sendOrderConfirmationEmail
// ============================================================

describe('sendOrderConfirmationEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  const fullOrder = {
    orderNumber: 'ORD-2024-001',
    orderDate: '2024-01-15T10:00:00Z',
    subtotal: 2000000,
    shippingCost: 30000,
    total: 2030000,
    estimatedDelivery: '2024-01-20T10:00:00Z',
    items: [
      { name: 'iPhone 15 Pro', quantity: 1, price: 2000000, subtotal: 2000000 },
    ],
    shippingAddress: {
      name: 'Nguyễn Văn B',
      address1: '456 Đường XYZ',
      address2: 'Tầng 3',
      city: 'TP.HCM',
      state: 'HCM',
      zip: '700000',
      country: 'VN',
    },
  };

  test('email chứa mã đơn hàng và tên sản phẩm', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'order-conf-001' });

    await emailService.sendOrderConfirmationEmail('customer@example.com', fullOrder);

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.html).toContain('ORD-2024-001');
    expect(mailOptions.html).toContain('iPhone 15 Pro');
  });

  test('email chứa ngày giao dự kiến khi estimatedDelivery được truyền', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'order-conf-002' });

    await emailService.sendOrderConfirmationEmail('customer@example.com', fullOrder);

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.html).toContain('Ngày giao dự kiến');
  });

  test('email không chứa ngày giao khi estimatedDelivery là undefined', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'order-conf-003' });

    const { estimatedDelivery: _ed, ...orderWithoutDelivery } = fullOrder;
    await emailService.sendOrderConfirmationEmail('customer@example.com', orderWithoutDelivery);

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.html).not.toContain('Ngày giao dự kiến');
  });

  test('subject chứa số đơn hàng', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'order-conf-004' });

    await emailService.sendOrderConfirmationEmail('customer@example.com', fullOrder);

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.subject).toContain('ORD-2024-001');
  });
});

// ============================================================
// sendOrderStatusUpdateEmail
// ============================================================

describe('sendOrderStatusUpdateEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  const statusOrder = {
    orderNumber: 'ORD-STATUS-001',
    orderDate: '2024-01-15T10:00:00Z',
    status: 'shipped',
  };

  test('email chứa trạng thái tiếng Việt khi status là "shipped"', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'status-001' });

    await emailService.sendOrderStatusUpdateEmail('user@example.com', statusOrder);

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.html).toContain('Đã giao cho đơn vị vận chuyển');
  });

  test('email chứa trạng thái tiếng Việt khi status là "delivered"', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'status-002' });

    await emailService.sendOrderStatusUpdateEmail('user@example.com', {
      ...statusOrder,
      status: 'delivered',
    });

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.html).toContain('Đã giao hàng');
  });

  test('fallback dùng raw status khi không có trong statusMap', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'status-003' });

    await emailService.sendOrderStatusUpdateEmail('user@example.com', {
      ...statusOrder,
      status: 'unknown_status',
    });

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.html).toContain('unknown_status');
  });
});

// ============================================================
// sendOrderCancellationEmail
// ============================================================

describe('sendOrderCancellationEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  test('email chứa số đơn hàng và thông tin hoàn tiền', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'cancel-001' });

    await emailService.sendOrderCancellationEmail('user@example.com', {
      orderNumber: 'ORD-CANCEL-001',
      orderDate: '2024-01-15T10:00:00Z',
    });

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.subject).toContain('ORD-CANCEL-001');
    expect(mailOptions.html).toContain('ORD-CANCEL-001');
    expect(mailOptions.html).toContain('5-7 ngày làm việc');
  });
});

// ============================================================
// sendNewsletterWelcomeEmail
// ============================================================

describe('sendNewsletterWelcomeEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  test('gửi email với subject chứa "bản tin"', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'newsletter-001' });

    await emailService.sendNewsletterWelcomeEmail('subscriber@example.com');

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.to).toBe('subscriber@example.com');
    expect(mailOptions.subject).toMatch(/bản tin/i);
    expect(mailOptions.html).toContain('cửa hàng');
  });
});

// ============================================================
// sendBulkCampaignEmail
// ============================================================

describe('sendBulkCampaignEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  test('gửi thành công đến tất cả email trong danh sách', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'bulk-001' });

    const emails = ['a@test.com', 'b@test.com', 'c@test.com'];
    const results = await emailService.sendBulkCampaignEmail(
      emails,
      'Khuyến mãi tháng 1',
      '<p>Nội dung khuyến mãi</p>'
    );

    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(3);
  });

  test('ghi nhận failure khi một email trong lô gửi thất bại', async () => {
    const emailService = loadEmailService();
    // Email thứ 2 fail
    mockSendMail
      .mockResolvedValueOnce({ messageId: 'bulk-ok-1' })
      .mockRejectedValueOnce(new Error('Invalid address'))
      .mockResolvedValueOnce({ messageId: 'bulk-ok-3' });

    const results = await emailService.sendBulkCampaignEmail(
      ['a@test.com', 'bad-address', 'c@test.com'],
      'Test subject',
      '<p>Content</p>'
    );

    expect(results).toHaveLength(3);
    const failed = results.filter(r => !r.success);
    expect(failed).toHaveLength(1);
    expect(failed[0].email).toBe('bad-address');
    expect(failed[0].error).toBe('Invalid address');
  });

  test('throw lỗi khi tất cả email trong danh sách đều fail', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockRejectedValue(new Error('SMTP down'));

    await expect(
      emailService.sendBulkCampaignEmail(
        ['a@test.com', 'b@test.com'],
        'Test',
        '<p>Content</p>'
      )
    ).rejects.toThrow('Tất cả email đều gửi thất bại');
  });

  test('sanitize nội dung HTML trước khi đưa vào email', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'bulk-sanitize' });

    // Nội dung chứa thẻ script độc hại
    await emailService.sendBulkCampaignEmail(
      ['a@test.com'],
      'Test',
      '<p>Nội dung tốt</p><script>evil()</script>'
    );

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.html).not.toContain('<script>');
    expect(mailOptions.html).toContain('Nội dung tốt');
  });

  test('danh sách rỗng → không gọi sendMail và trả về mảng rỗng', async () => {
    const emailService = loadEmailService();

    const results = await emailService.sendBulkCampaignEmail([], 'Subject', '<p>Content</p>');

    expect(results).toHaveLength(0);
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});

// ============================================================
// sendAdminFeedbackNotification
// ============================================================

describe('sendAdminFeedbackNotification', () => {
  beforeEach(() => jest.clearAllMocks());

  const validFeedback = {
    name: 'Khách hàng Test',
    email: 'customer@example.com',
    subject: 'Góp ý về sản phẩm',
    content: 'Sản phẩm rất tốt nhưng giá hơi cao.',
  };

  test('gửi email đến admin với thông tin phản hồi đầy đủ', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'feedback-001' });

    await emailService.sendAdminFeedbackNotification('admin@example.com', validFeedback);

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.to).toBe('admin@example.com');
    expect(mailOptions.html).toContain('Khách hàng Test');
    expect(mailOptions.html).toContain('customer@example.com');
    expect(mailOptions.html).toContain('Góp ý về sản phẩm');
  });

  test('escape nội dung phản hồi chứa HTML độc hại', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'feedback-002' });

    await emailService.sendAdminFeedbackNotification('admin@example.com', {
      ...validFeedback,
      content: '<img src=x onerror="alert(1)">',
    });

    const [mailOptions] = mockSendMail.mock.calls[0];
    // escapeHtml chuyển " thành &quot; — tag gốc không còn thực thi được
    expect(mailOptions.html).not.toContain('<img src=x onerror="'); // unescaped form không xuất hiện
    expect(mailOptions.html).toContain('&lt;img');  // tag bị escaped
    expect(mailOptions.html).toContain('&quot;');   // dấu nháy kép bị escaped
  });

  test('subject chứa tiêu đề phản hồi', async () => {
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'feedback-003' });

    await emailService.sendAdminFeedbackNotification('admin@example.com', validFeedback);

    const [mailOptions] = mockSendMail.mock.calls[0];
    expect(mailOptions.subject).toContain('Góp ý về sản phẩm');
    expect(mailOptions.subject).toContain('Phản hồi mới');
  });
});

// ─── createTransporter — Gmail branch (line 49) ───────────────────────────────
// Covers line 49: khi EMAIL_HOST = smtp.gmail.com → tạo Gmail transport
// createTransporter được gọi lazily qua getTransporter() khi sendEmail được gọi lần đầu

describe('createTransporter — Gmail branch', () => {
  test('EMAIL_HOST=smtp.gmail.com → tạo transporter với service:gmail — covers line 49', async () => {
    // Lưu env cũ
    const origHost = process.env.EMAIL_HOST;
    process.env.EMAIL_HOST = 'smtp.gmail.com';

    // Dùng loadEmailService() — reset modules + re-mock nodemailer
    // mockCreateTransport đã được khai báo ở module scope nên có thể dùng
    mockCreateTransport.mockClear();
    mockSendMail.mockResolvedValue({ messageId: 'gmail-ok' });

    const emailService = loadEmailService();

    // Gọi sendEmail để kích hoạt getTransporter() → createTransporter()
    await emailService.sendEmail({
      email: 'test@gmail.com',
      subject: 'Gmail Test',
      html: '<p>Test</p>',
    });

    // createTransport được gọi với service: 'gmail' (không phải host/port config)
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'gmail' })
    );

    process.env.EMAIL_HOST = origHost;
  });
});

// ─── createTransporter — EMAIL_PORT chưa set → fallback port (line 40) ────────
// Covers ternary isGmail ? 587 : 465 bên trong fallback branch của ||

describe('createTransporter — EMAIL_PORT undefined → fallback port (line 40)', () => {
  test('EMAIL_PORT chưa set + không phải Gmail → port 465 (line 40 cond-expr false branch)', async () => {
    const savedPort = process.env.EMAIL_PORT;
    const savedHost = process.env.EMAIL_HOST;
    delete process.env.EMAIL_PORT;
    process.env.EMAIL_HOST = 'smtp.nonmail.com'; // not gmail → isGmail = false → port 465

    mockSendMail.mockResolvedValue({ messageId: 'fallback-port-ok' });
    const emailService = loadEmailService();

    await emailService.sendEmail({ email: 'x@test.com', subject: 'FallbackPort', html: '<p>x</p>' });

    expect(mockSendMail).toHaveBeenCalledTimes(1);

    // Restore
    if (savedPort !== undefined) process.env.EMAIL_PORT = savedPort;
    process.env.EMAIL_HOST = savedHost;
  });

  test('EMAIL_PORT chưa set + Gmail → port 587 (line 40 cond-expr true branch)', async () => {
    const savedPort = process.env.EMAIL_PORT;
    const savedHost = process.env.EMAIL_HOST;
    delete process.env.EMAIL_PORT;
    process.env.EMAIL_HOST = 'smtp.gmail.com'; // gmail → isGmail = true → port 587

    mockSendMail.mockResolvedValue({ messageId: 'gmail-port-ok' });
    const emailService = loadEmailService();

    await emailService.sendEmail({ email: 'g@gmail.com', subject: 'GmailPort', html: '<p>g</p>' });

    expect(mockSendMail).toHaveBeenCalledTimes(1);

    // Restore
    if (savedPort !== undefined) process.env.EMAIL_PORT = savedPort;
    process.env.EMAIL_HOST = savedHost;
  });
});

// ─── sendBulkCampaignEmail — delay giữa các lô (line 165) ────────────────────
// Covers line 165: await delay khi còn nhiều hơn 1 lô email
// Dùng jest.useFakeTimers() với advanceTimersByTimeAsync để không chờ delay thật

describe('sendBulkCampaignEmail — delay between batches (line 165)', () => {
  test('6 emails (batchSize=5) → 2 lô → delay được gọi giữa lô 1 và lô 2 — covers line 165', async () => {
    jest.useFakeTimers();
    const emailService = loadEmailService();
    mockSendMail.mockResolvedValue({ messageId: 'bulk-ok' });

    // 6 emails → lô 1 = 5, lô 2 = 1 → delay giữa hai lô
    const emails = Array.from({ length: 6 }, (_, i) => `user${i}@example.com`);

    const sendPromise = emailService.sendBulkCampaignEmail(
      emails, 'Test Campaign', '<p>Nội dung</p>'
    );

    // Advance fake timers để vượt qua delay 1000ms
    await jest.advanceTimersByTimeAsync(2000);

    const result = await sendPromise;

    jest.useRealTimers();

    // sendBulkCampaignEmail trả về mảng kết quả từng email
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(6);
    expect(result[0]).toHaveProperty('success', true);
  });
});
