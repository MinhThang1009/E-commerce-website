const { z } = require('zod');
const chatMessageSchema = z.object({
  message: z.string().trim().min(1, 'ai.messageEmpty').max(500, 'ai.messageTooLong'),
  sessionId: z
    .string()
    .min(1, 'ai.sessionIdRequired')
    .max(128, 'ai.sessionIdTooLong')
    .nullable()
    .optional(),
  // userId KHÔNG nhận từ client body — luôn lấy từ req.user?.id (JWT) trong controller
});

const cartAddSchema = z.object({
  productId: z.number().int().positive({ message: 'ai.productIdInvalid' }),
  variantId: z.number().int().positive({ message: 'ai.productIdInvalid' }).optional(),
  quantity: z.number().int().min(1, 'ai.quantityMin').max(100, 'ai.quantityMax').default(1),
  sessionId: z.string().min(1, 'ai.sessionIdRequired').max(128, 'ai.sessionIdTooLong').optional(),
});

// sessionId bắt buộc để tránh clearSession(null) xóa toàn bộ server-side session Map
const sessionSchema = z.object({
  sessionId: z.string().min(1, 'ai.sessionIdRequired').max(128, 'ai.sessionIdTooLong'),
});

module.exports = { chatMessageSchema, cartAddSchema, sessionSchema };
