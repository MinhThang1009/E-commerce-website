/**
 * validators.extra.test.js — Zod validators
 */
process.env.NODE_ENV = 'test';

describe('ai-validator (Zod)', () => {
  const { chatMessageSchema } = require('@modules/ai/validators/ai-validator');
  it('xuất ra chatMessageSchema', () => expect(chatMessageSchema).toBeDefined());
  it('chấp nhận message hợp lệ', () =>
    expect(chatMessageSchema.safeParse({ message: 'Hello' }).success).toBe(true));
  it('lỗi khi message rỗng', () =>
    expect(chatMessageSchema.safeParse({ message: '' }).success).toBe(false));
});
