/**
 * validators.extra.test.js — Zod validators (was Joi stubs)
 */
process.env.NODE_ENV = 'test';

describe('wishlist-validator (Zod)', () => {
  const { addWishlistSchema } = require('@modules/wishlist/validators/wishlist-validator');
  it('xuất ra addWishlistSchema', () => expect(addWishlistSchema).toBeDefined());
  it('chấp nhận productId hợp lệ', () =>
    expect(addWishlistSchema.safeParse({ productId: 1 }).success).toBe(true));
  it('lỗi khi thiếu productId', () => expect(addWishlistSchema.safeParse({}).success).toBe(false));
});

describe('upload-validator (Zod)', () => {
  const { uploadBodySchema } = require('@modules/upload/validators/upload-validator');
  it('xuất ra uploadBodySchema', () => expect(uploadBodySchema).toBeDefined());
  it('chấp nhận object rỗng', () => expect(uploadBodySchema.safeParse({}).success).toBe(true));
  it('chấp nhận category hợp lệ', () =>
    expect(uploadBodySchema.safeParse({ category: 'product' }).success).toBe(true));
});

describe('inventory-validator (Zod)', () => {
  const { restockSchema } = require('@modules/inventory/validators/inventory-validator');
  it('xuất ra restockSchema', () => expect(restockSchema).toBeDefined());
  it('chấp nhận dữ liệu hợp lệ', () =>
    expect(restockSchema.safeParse({ productId: 1, quantity: 5 }).success).toBe(true));
  it('lỗi khi quantity < 1', () =>
    expect(restockSchema.safeParse({ productId: 1, quantity: 0 }).success).toBe(false));
});

describe('ai-validator (Zod)', () => {
  const { chatMessageSchema } = require('@modules/ai/validators/ai-validator');
  it('xuất ra chatMessageSchema', () => expect(chatMessageSchema).toBeDefined());
  it('chấp nhận message hợp lệ', () =>
    expect(chatMessageSchema.safeParse({ message: 'Hello' }).success).toBe(true));
  it('lỗi khi message rỗng', () =>
    expect(chatMessageSchema.safeParse({ message: '' }).success).toBe(false));
});
