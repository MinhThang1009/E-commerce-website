const { z } = require('zod');
const restockSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  quantity: z.number().int().min(1, 'Số lượng phải lớn hơn 0'),
  note: z.string().optional(),
});
module.exports = { restockSchema };
