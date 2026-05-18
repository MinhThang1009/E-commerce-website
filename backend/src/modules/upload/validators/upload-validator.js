const { z } = require('zod');
const uploadBodySchema = z.object({
  category: z.string().optional().default('product'),
  productId: z.coerce.number().int().positive().optional(),
});
module.exports = { uploadBodySchema };
