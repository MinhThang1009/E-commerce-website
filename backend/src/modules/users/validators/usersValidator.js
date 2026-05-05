// Users request validators (Joi schemas) — profile + password + address.
// Move các schema từ validators/user.js (updateUser, changePassword) +
// validators/address.js (address). Auth-related schema (register/login/...) đã
// move sang modules/auth/validators ở Phase 42.2.
const Joi = require('joi');

const updateProfileSchema = Joi.object({
  firstName: Joi.string().optional().messages({
    'string.empty': 'Tên không được để trống',
  }),
  lastName: Joi.string().optional().messages({
    'string.empty': 'Họ không được để trống',
  }),
  phone: Joi.string().allow('').optional(),
  avatar: Joi.string().allow('').optional(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'Mật khẩu hiện tại không được để trống',
    'any.required': 'Mật khẩu hiện tại là trường bắt buộc',
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'Mật khẩu mới phải có ít nhất {#limit} ký tự',
    'string.empty': 'Mật khẩu mới không được để trống',
    'any.required': 'Mật khẩu mới là trường bắt buộc',
  }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Xác nhận mật khẩu không khớp',
      'string.empty': 'Xác nhận mật khẩu không được để trống',
      'any.required': 'Xác nhận mật khẩu là trường bắt buộc',
    }),
});

const addressSchema = Joi.object({
  name: Joi.string().allow('').optional(),
  firstName: Joi.string().required().messages({
    'string.empty': 'Tên không được để trống',
    'any.required': 'Tên là trường bắt buộc',
  }),
  lastName: Joi.string().required().messages({
    'string.empty': 'Họ không được để trống',
    'any.required': 'Họ là trường bắt buộc',
  }),
  company: Joi.string().allow('').optional(),
  address1: Joi.string().required().messages({
    'string.empty': 'Địa chỉ không được để trống',
    'any.required': 'Địa chỉ là trường bắt buộc',
  }),
  address2: Joi.string().allow('').optional(),
  city: Joi.string().required().messages({
    'string.empty': 'Thành phố không được để trống',
    'any.required': 'Thành phố là trường bắt buộc',
  }),
  state: Joi.string().required().messages({
    'string.empty': 'Tỉnh/Thành phố không được để trống',
    'any.required': 'Tỉnh/Thành phố là trường bắt buộc',
  }),
  zip: Joi.string().required().messages({
    'string.empty': 'Mã bưu điện không được để trống',
    'any.required': 'Mã bưu điện là trường bắt buộc',
  }),
  country: Joi.string().required().messages({
    'string.empty': 'Quốc gia không được để trống',
    'any.required': 'Quốc gia là trường bắt buộc',
  }),
  phone: Joi.string().allow('').optional(),
  isDefault: Joi.boolean().default(false),
});

module.exports = {
  updateProfileSchema,
  changePasswordSchema,
  addressSchema,
};
