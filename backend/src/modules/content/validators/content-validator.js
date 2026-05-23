const { z } = require('zod');
const feedbackSchema = z.object({
  name: z.string().trim().min(2, 'Tên phải có ít nhất 2 ký tự').max(100),
  email: z.string().email('Địa chỉ email không hợp lệ').min(1),
  phone: z.string().optional(),
  subject: z.string().trim().min(2, 'Tiêu đề phải có ít nhất 2 ký tự').max(200),
  content: z.string().trim().min(10, 'Nội dung phải có ít nhất 10 ký tự').max(5000),
});
module.exports = {
  feedbackSchema,
};
