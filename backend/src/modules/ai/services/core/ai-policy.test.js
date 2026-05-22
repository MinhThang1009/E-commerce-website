/**
 * @file aiPolicy.test.js
 * @description Tests cho aiPolicy.js — phủ tất cả branches của classifyIntent,
 *   expandAbbreviations, validateMessage, isOffTopic.
 */

const {
  validateMessage,
  expandAbbreviations,
  isOffTopic,
  classifyIntent,
  MAX_MESSAGE_LENGTH,
} = require('./ai-policy');

// ── validateMessage ────────────────────────────────────────────────────────────

describe('validateMessage', () => {
  test('hợp lệ khi message bình thường', () => {
    expect(validateMessage('iPhone 15 giá bao nhiêu')).toEqual({ valid: true });
  });

  test('không hợp lệ khi message rỗng', () => {
    const r = validateMessage('');
    expect(r.valid).toBe(false);
  });

  test('không hợp lệ khi message chỉ khoảng trắng', () => {
    const r = validateMessage('   ');
    expect(r.valid).toBe(false);
  });

  test('không hợp lệ khi quá dài', () => {
    const r = validateMessage('a'.repeat(MAX_MESSAGE_LENGTH + 1));
    expect(r.valid).toBe(false);
  });

  test('hợp lệ ở đúng giới hạn MAX_MESSAGE_LENGTH', () => {
    const r = validateMessage('a'.repeat(MAX_MESSAGE_LENGTH));
    expect(r.valid).toBe(true);
  });

  test('không hợp lệ khi chỉ gồm dấu câu, không có chữ cái hay chữ số', () => {
    // Line 112: !/[\p{L}\p{N}]/u.test(trimmed) → false branch
    const r = validateMessage('!!! ???');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('không hợp lệ');
  });

  test('không hợp lệ khi chỉ là dấu phẩy và khoảng trắng', () => {
    const r = validateMessage('  ,,,  ');
    expect(r.valid).toBe(false);
  });
});

// ── expandAbbreviations ────────────────────────────────────────────────────────

describe('expandAbbreviations', () => {
  test('ip → iPhone', () => expect(expandAbbreviations('ip 15')).toContain('iPhone'));
  test('ss → Samsung', () => expect(expandAbbreviations('ss s25')).toContain('Samsung'));
  test('mb → MacBook', () => expect(expandAbbreviations('mb air')).toContain('MacBook'));
  test('pm → Pro Max', () => expect(expandAbbreviations('ip 15 pm')).toContain('Pro Max'));
  test('bnh → bao nhiêu', () => expect(expandAbbreviations('bnh tiền')).toContain('bao nhiêu'));
  test('bh → bảo hành', () => expect(expandAbbreviations('bh bao lâu')).toContain('bảo hành'));
  test('rl → realme', () => expect(expandAbbreviations('rl c55')).toContain('realme'));
  test('r5 → AMD Ryzen 5', () =>
    expect(expandAbbreviations('laptop r5 7530u')).toContain('AMD Ryzen 5'));
  test('giữ nguyên khi không có abbreviation', () => {
    expect(expandAbbreviations('laptop gaming')).toBe('laptop gaming');
  });
});

// ── isOffTopic ─────────────────────────────────────────────────────────────────

describe('isOffTopic', () => {
  test('thời tiết là off-topic', () => expect(isOffTopic('thời tiết hôm nay')).toBe(true));
  test('football là off-topic', () => expect(isOffTopic('football match')).toBe(true));
  test('iPhone không phải off-topic', () => expect(isOffTopic('iPhone 15 giá')).toBe(false));
});

// ── classifyIntent ─────────────────────────────────────────────────────────────

describe('classifyIntent', () => {
  test('off_topic', () => expect(classifyIntent('thời tiết hôm nay thế nào')).toBe('off_topic'));

  test('order_inquiry — "đơn hàng"', () => {
    expect(classifyIntent('đơn hàng của tôi ở đâu')).toBe('order_inquiry');
  });
  test('order_inquiry — "shipping status"', () => {
    expect(classifyIntent('check shipping status')).toBe('order_inquiry');
  });

  // Line 67: return 'policy'
  test('policy — "bảo hành" (line 67)', () => {
    expect(classifyIntent('chính sách bảo hành như thế nào')).toBe('policy');
  });
  test('policy — "đổi trả"', () => {
    expect(classifyIntent('đổi trả hàng trong bao lâu')).toBe('policy');
  });

  test('pricing — "giá"', () => {
    expect(classifyIntent('giá iPhone 15 bao nhiêu')).toBe('pricing');
  });
  test('pricing — "how much"', () => {
    expect(classifyIntent('how much does it cost')).toBe('pricing');
  });

  test('product_search — tên sản phẩm', () => {
    expect(classifyIntent('tìm iPhone 15')).toBe('product_search');
  });
  test('product_search — laptop', () => {
    expect(classifyIntent('laptop gaming')).toBe('product_search');
  });

  // Line 81: second return 'product_search' — chỉ trigger khi KHÔNG khớp product names ở line 75
  // Cần message không có tên sản phẩm (không có iphone/samsung/laptop...) nhưng có tư vấn/so sánh
  test('product_search — "tư vấn mua gì tốt nhất" (line 81, không có product name)', () => {
    expect(classifyIntent('tư vấn mua gì tốt nhất')).toBe('product_search');
  });
  test('product_search — "recommend me something" (line 81)', () => {
    expect(classifyIntent('recommend me something')).toBe('product_search');
  });
  test('product_search — "which one should i buy" (line 81)', () => {
    expect(classifyIntent('which one should i buy')).toBe('product_search');
  });
  test('product_search — "nên mua cái nào" (line 81)', () => {
    expect(classifyIntent('nên mua cái nào')).toBe('product_search');
  });

  test('general — không khớp pattern nào', () => {
    expect(classifyIntent('xin chào bạn')).toBe('general');
  });
});
