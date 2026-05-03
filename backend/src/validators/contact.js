const Joi = require('joi');

// Schema kiểm tra form đăng ký nhận bản tin
const newsletterSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Địa chỉ email không hợp lệ',
      'string.empty': 'Email không được để trống',
      'any.required': 'Email là trường bắt buộc',
    }),
});

// Schema kiểm tra form gửi phản hồi
const feedbackSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Tên không được để trống',
    'string.min': 'Tên phải có ít nhất 2 ký tự',
    'string.max': 'Tên không được vượt quá 100 ký tự',
    'any.required': 'Tên là trường bắt buộc',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Địa chỉ email không hợp lệ',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là trường bắt buộc',
  }),
  phone: Joi.string().allow('').optional(),
  subject: Joi.string().trim().min(2).max(200).required().messages({
    'string.empty': 'Tiêu đề không được để trống',
    'string.min': 'Tiêu đề phải có ít nhất 2 ký tự',
    'string.max': 'Tiêu đề không được vượt quá 200 ký tự',
    'any.required': 'Tiêu đề là trường bắt buộc',
  }),
  content: Joi.string().trim().min(10).max(5000).required().messages({
    'string.empty': 'Nội dung phản hồi không được để trống',
    'string.min': 'Nội dung phải có ít nhất 10 ký tự',
    'string.max': 'Nội dung không được vượt quá 5000 ký tự',
    'any.required': 'Nội dung là trường bắt buộc',
  }),
});

module.exports = { newsletterSchema, feedbackSchema };
