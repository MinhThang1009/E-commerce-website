const { z } = require('zod');
const categorySchema = z.object({
  name: z.string().min(1, 'Tên danh mục không được để trống'),
  description: z.string().optional(),
  image: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
const createBrandSchema = z.object({
  name: z.string().trim().min(1, 'Tên thương hiệu không được để trống').max(100),
  slug: z.string().trim().max(255).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')).nullable(),
});
const updateBrandSchema = createBrandSchema.partial();
const productSchema = z.object({
  name: z.string().min(1, 'Tên sản phẩm không được để trống'),
  description: z.string().min(1, 'Mô tả không được để trống'),
  shortDescription: z.string().min(1, 'Mô tả ngắn không được để trống'),
  price: z.number().min(0, 'Giá không được nhỏ hơn 0'),
  compareAtPrice: z.number().min(0).nullable().optional(),
  images: z.array(z.string()).default([]),
  categoryIds: z.array(z.union([z.number().int(), z.string()])).optional(),
  stockQuantity: z.number().int().min(0).default(0),
  featured: z.boolean().default(false),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoKeywords: z.array(z.string()).default([]),
  brand: z.string().optional(),
  model: z.string().optional(),
  condition: z.enum(['new', 'like-new', 'used', 'refurbished']).default('new'),
  warrantyMonths: z.number().int().min(0).max(120).default(12),
  specifications: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).default({}),
  attributes: z.array(z.object({ name: z.string(), values: z.array(z.string()) })).optional(),
  variants: z
    .array(
      z.object({
        name: z.string(),
        sku: z.string().optional(),
        attributes: z.record(z.string(), z.string()),
        price: z.number().min(0),
        stockQuantity: z.number().int().min(0).default(0),
        images: z.array(z.string()).default([]),
        displayName: z.string().optional(),
        sortOrder: z.number().int().min(0).default(0),
        isDefault: z.boolean().default(false),
        isAvailable: z.boolean().default(true),
      }),
    )
    .optional(),
  warrantyPackageIds: z.array(z.union([z.number().int(), z.string()])).optional(),
});
module.exports = { categorySchema, createBrandSchema, updateBrandSchema, productSchema };
