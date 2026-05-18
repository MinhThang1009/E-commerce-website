const { z } = require('zod');
const idSchema = z.union([z.number().int(), z.string()]);
const reviewSchema = z.object({
  productId: idSchema,
  rating: z.number().int('Đánh giá phải là số nguyên').min(1, 'Đánh giá phải từ 1 đến 5').max(5, 'Đánh giá phải từ 1 đến 5'),
  title: z.string().min(1, 'Tiêu đề không được để trống'),
  comment: z.string().min(1, 'Nội dung đánh giá không được để trống'),
  images: z.array(z.string().url()).optional(),
});
const reviewHelpfulSchema = z.object({ helpful: z.boolean() });
module.exports = { reviewSchema, reviewHelpfulSchema };
