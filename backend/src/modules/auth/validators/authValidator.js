// Auth request validators (Joi schemas) — register, login, forgot/reset password,
// resend verification. Move từ validators/user.js cho phần auth-related; user
// profile schemas (updateUser, changePassword) ở users module Sprint sau.
const Joi = require('joi');

const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email không hợp lệ',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là trường bắt buộc',
  }),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.min': 'Mật khẩu phải có ít nhất {#limit} ký tự',
    'string.pattern.base': 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số',
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là trường bắt buộc',
  }),
  firstName: Joi.string().required().messages({
    'string.empty': 'Tên không được để trống',
    'any.required': 'Tên là trường bắt buộc',
  }),
  lastName: Joi.string().required().messages({
    'string.empty': 'Họ không được để trống',
    'any.required': 'Họ là trường bắt buộc',
  }),
  phone: Joi.string().allow('').optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email không hợp lệ',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là trường bắt buộc',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là trường bắt buộc',
  }),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email không hợp lệ',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là trường bắt buộc',
  }),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Token không được để trống',
    'any.required': 'Token là trường bắt buộc',
  }),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.min': 'Mật khẩu phải có ít nhất {#limit} ký tự',
    'string.pattern.base': 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số',
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là trường bắt buộc',
  }),
});

const emailSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email không hợp lệ',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là trường bắt buộc',
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  emailSchema,
};
