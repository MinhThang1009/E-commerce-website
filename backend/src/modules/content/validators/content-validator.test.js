'use strict';
const { createNewsSchema, feedbackSchema, newsletterSchema } = require('./content-validator');

describe('createNewsSchema (Zod)', () => {
  it('chấp nhận dữ liệu hợp lệ', () => {
    const r = createNewsSchema.safeParse({ title: 'Test Title', content: 'Nội dung dài hơn 10 ký tự nhé' });
    expect(r.success).toBe(true);
  });
  it('lỗi khi thiếu title', () => {
    expect(createNewsSchema.safeParse({ content: 'Content long enough nhé' }).success).toBe(false);
  });
  it('lỗi khi content quá ngắn', () => {
    const r = createNewsSchema.safeParse({ title: 'Title', content: 'short' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toContain('10 ký tự');
  });
});

describe('feedbackSchema (Zod)', () => {
  const valid = { name: 'Nguyễn Văn A', email: 'test@example.com', subject: 'Test Subject', content: 'Nội dung đủ dài hơn 10 ký tự nhé' };
  it('chấp nhận dữ liệu hợp lệ', () => expect(feedbackSchema.safeParse(valid).success).toBe(true));
  it('lỗi khi email không hợp lệ', () => expect(feedbackSchema.safeParse({ ...valid, email: 'invalid' }).success).toBe(false));
});

describe('newsletterSchema (Zod)', () => {
  it('chấp nhận email hợp lệ', () => expect(newsletterSchema.safeParse({ email: 'test@example.com' }).success).toBe(true));
  it('lỗi khi email không hợp lệ', () => expect(newsletterSchema.safeParse({ email: 'not-email' }).success).toBe(false));
});
