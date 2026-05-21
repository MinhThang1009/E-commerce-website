const { z } = require('zod');
const idSchema = z.coerce.number().int().positive('ID không hợp lệ');
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100000).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).optional(),
});
const statsSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  groupBy: z.enum(['hour', 'day', 'week', 'month']).optional(),
});
const createProductSchema = z.object({
  name: z.string().min(2, 'Tên sản phẩm phải từ 2-200 ký tự').max(200),
  description: z.string().min(1, 'Mô tả chi tiết là bắt buộc'),
  shortDescription: z.string().min(1, 'Mô tả ngắn là bắt buộc'),
  price: z.number().min(0, 'Giá sản phẩm phải là số dương'),
  compareAtPrice: z.number().min(0).optional(),
  comparePrice: z.number().min(0).optional(),
  stockQuantity: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  images: z.array(z.string()).optional(),
  seoKeywords: z.array(z.string()).optional(),
  categoryIds: z.array(z.union([z.number().int(), z.string()])).optional(),
});
const updateProductSchema = createProductSchema.partial();
const updateUserSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phone: z.string().optional(),
  role: z.enum(['customer', 'admin', 'manager']).optional(),
  isEmailVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
  note: z.string().max(500).optional(),
});
module.exports = {
  idSchema,
  paginationSchema,
  statsSchema,
  createProductSchema,
  updateProductSchema,
  updateUserSchema,
  updateOrderStatusSchema,
};
