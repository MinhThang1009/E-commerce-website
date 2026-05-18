const { z } = require('zod');
const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'Tên không được để trống').optional(),
  lastName: z.string().min(1, 'Họ không được để trống').optional(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mật khẩu hiện tại không được để trống'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
  confirmPassword: z.string().min(1, 'Xác nhận mật khẩu không được để trống'),
}).refine(d => d.newPassword === d.confirmPassword, { message: 'Xác nhận mật khẩu không khớp', path: ['confirmPassword'] });
const addressSchema = z.object({
  name: z.string().optional(),
  firstName: z.string().min(1, 'Tên không được để trống'),
  lastName: z.string().min(1, 'Họ không được để trống'),
  company: z.string().optional(),
  address1: z.string().min(1, 'Địa chỉ không được để trống'),
  address2: z.string().optional(),
  city: z.string().min(1, 'Thành phố không được để trống'),
  state: z.string().min(1, 'Tỉnh/Thành phố không được để trống'),
  zip: z.string().min(1, 'Mã bưu điện không được để trống'),
  country: z.string().min(1, 'Quốc gia không được để trống'),
  phone: z.string().optional(),
  isDefault: z.boolean().default(false),
});
module.exports = { updateProfileSchema, changePasswordSchema, addressSchema };
