const { z } = require('zod');
const createSchema = z.object({
  name: z.string().trim().min(1, 'Tên gói bảo hành là bắt buộc').max(255),
  description: z.string().trim().max(1000).optional(),
  durationMonths: z.number().int().min(1, 'Thời hạn bảo hành là bắt buộc'),
  price: z.number().min(0, 'Giá gói bảo hành là bắt buộc'),
  terms: z.string().trim().max(2000).optional(),
  coverage: z.string().trim().max(2000).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});
const updateSchema = createSchema.partial();
module.exports = { createSchema, updateSchema };
