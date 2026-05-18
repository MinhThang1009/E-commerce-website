const { z } = require('zod');
const createUrlSchema = z.object({
  orderId: z.number().int().positive('Order ID là bắt buộc'),
});
const refundSchema = z.object({
  orderId: z.number().int().positive('Order ID là bắt buộc'),
  amount: z.number().positive('Số tiền hoàn phải lớn hơn 0').optional(),
  reason: z.string().max(500).optional(),
});
module.exports = { createUrlSchema, refundSchema };
