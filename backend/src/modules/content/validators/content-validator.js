const { z } = require('zod');
const createBannerSchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề banner không được để trống').max(255),
  imageUrl: z.string().url('imageUrl phải là URL hợp lệ').min(1, 'imageUrl không được để trống'),
  linkUrl: z.string().url().optional().or(z.literal('')).nullable(),
  position: z.enum(['home_hero', 'home_middle', 'sidebar']).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
});
const updateBannerSchema = createBannerSchema.partial();
const createNewsSchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề bài viết không được để trống').max(255),
  content: z.string().min(10, 'Nội dung phải có ít nhất 10 ký tự'),
  slug: z.string().trim().max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  thumbnail: z.string().url().optional().or(z.literal('')).nullable(),
  category: z.string().max(100).optional().nullable(),
  tags: z.string().max(500).optional().nullable(),
  isPublished: z.boolean().optional(),
});
const updateNewsSchema = createNewsSchema.partial();
const feedbackSchema = z.object({
  name: z.string().trim().min(2, 'Tên phải có ít nhất 2 ký tự').max(100),
  email: z.string().email('Địa chỉ email không hợp lệ').min(1),
  phone: z.string().optional(),
  subject: z.string().trim().min(2, 'Tiêu đề phải có ít nhất 2 ký tự').max(200),
  content: z.string().trim().min(10, 'Nội dung phải có ít nhất 10 ký tự').max(5000),
});
module.exports = {
  createBannerSchema,
  updateBannerSchema,
  createNewsSchema,
  updateNewsSchema,
  feedbackSchema,
};
