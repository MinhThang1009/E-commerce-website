const { z } = require('zod');
const ALLOWED_CATEGORIES = ['product', 'user', 'review', 'thumbnail', 'temp'];
const uploadSchema = z.object({
  category: z.enum(ALLOWED_CATEGORIES).default('product'),
  productId: z.number().int().positive().nullable().optional(),
  generateThumbs: z.boolean().default(true),
  optimize: z.boolean().default(true),
});
const base64Schema = z.object({
  base64Data: z.string().min(1, 'base64Data là bắt buộc'),
  category: z.enum(ALLOWED_CATEGORIES).default('product'),
  productId: z.number().int().positive().nullable().optional(),
});
module.exports = { uploadSchema, base64Schema };
