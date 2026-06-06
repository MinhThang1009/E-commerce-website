const { z } = require('zod');
const categorySchema = z.object({
  name: z.string().min(1, 'Tên danh mục không được để trống'),
  description: z.string().nullish(),
  image: z.string().nullish(),
  parentId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
const createBrandSchema = z.object({
  name: z.string().trim().min(1, 'Tên thương hiệu không được để trống').max(100),
  slug: z.string().trim().max(255).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')).nullable(),
  description: z.string().nullish(),
  website: z.string().url('URL website không hợp lệ').optional().or(z.literal('')).nullable(),
  isActive: z.boolean().default(true),
});
const updateBrandSchema = createBrandSchema.partial();
module.exports = { categorySchema, createBrandSchema, updateBrandSchema };
