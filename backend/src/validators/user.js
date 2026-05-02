const Joi = require('joi');

// Schema kiểm tra dữ liệu đăng ký
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email không hợp lệ',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là trường bắt buộc',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Mật khẩu phải có ít nhất {#limit} ký tự',
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

// Schema kiểm tra dữ liệu đăng nhập
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

// Schema kiểm tra dữ liệu cập nhật thông tin người dùng
const updateUserSchema = Joi.object({
  firstName: Joi.string().optional().messages({
    'string.empty': 'Tên không được để trống',
  }),
  lastName: Joi.string().optional().messages({
    'string.empty': 'Họ không được để trống',
  }),
  phone: Joi.string().allow('').optional(),
  avatar: Joi.string().allow('').optional(),
});

// Schema kiểm tra dữ liệu đổi mật khẩu
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

// Schema kiểm tra dữ liệu quên mật khẩu
const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email không hợp lệ',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là trường bắt buộc',
  }),
});

// Schema kiểm tra dữ liệu đặt lại mật khẩu
const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Token không được để trống',
    'any.required': 'Token là trường bắt buộc',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Mật khẩu phải có ít nhất {#limit} ký tự',
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là trường bắt buộc',
  }),
});

// Schema kiểm tra dữ liệu email
const emailSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email không hợp lệ',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là trường bắt buộc',
  }),
});

// Schema kiểm tra xác thực email bằng token
const verifyEmailSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Token không được để trống',
    'any.required': 'Token là trường bắt buộc',
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  updateUserSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  emailSchema,
  verifyEmailSchema,
};
