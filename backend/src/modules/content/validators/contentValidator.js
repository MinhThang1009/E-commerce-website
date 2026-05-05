const Joi = require('joi');

// Content validators — gộp banner + news + newsletter + feedback.
// Email campaign chưa có schema validator riêng (legacy routes chỉ xác thực admin).

const createBannerSchema = Joi.object({
  title: Joi.string().trim().max(255).required().messages({
    'string.empty': 'Tiêu đề banner không được để trống',
    'string.max': 'Tiêu đề không được vượt quá 255 ký tự',
    'any.required': 'Tiêu đề là trường bắt buộc',
  }),
  imageUrl: Joi.string().uri().required().messages({
    'string.uri': 'imageUrl phải là URL hợp lệ',
    'string.empty': 'imageUrl không được để trống',
    'any.required': 'imageUrl là trường bắt buộc',
  }),
  linkUrl: Joi.string().uri().allow('', null).optional(),
  position: Joi.string().valid('home_hero', 'home_middle', 'sidebar').optional(),
  isActive: Joi.boolean().optional(),
  priority: Joi.number().integer().min(0).optional(),
});

const updateBannerSchema = Joi.object({
  title: Joi.string().trim().max(255).optional(),
  imageUrl: Joi.string().uri().optional(),
  linkUrl: Joi.string().uri().allow('', null).optional(),
  position: Joi.string().valid('home_hero', 'home_middle', 'sidebar').optional(),
  isActive: Joi.boolean().optional(),
  priority: Joi.number().integer().min(0).optional(),
});

const createNewsSchema = Joi.object({
  title: Joi.string().trim().max(255).required().messages({
    'string.empty': 'Tiêu đề bài viết không được để trống',
    'string.max': 'Tiêu đề không được vượt quá 255 ký tự',
    'any.required': 'Tiêu đề là trường bắt buộc',
  }),
  content: Joi.string().min(10).required().messages({
    'string.empty': 'Nội dung bài viết không được để trống',
    'string.min': 'Nội dung phải có ít nhất 10 ký tự',
    'any.required': 'Nội dung là trường bắt buộc',
  }),
  slug: Joi.string().trim().max(255).optional(),
  description: Joi.string().max(1000).allow('', null).optional(),
  thumbnail: Joi.string().uri().allow('', null).optional(),
  category: Joi.string().max(100).allow('', null).optional(),
  tags: Joi.string().max(500).allow('', null).optional(),
  isPublished: Joi.boolean().optional(),
});

const updateNewsSchema = Joi.object({
  title: Joi.string().trim().max(255).optional(),
  content: Joi.string().min(10).optional(),
  slug: Joi.string().trim().max(255).optional(),
  description: Joi.string().max(1000).allow('', null).optional(),
  thumbnail: Joi.string().uri().allow('', null).optional(),
  category: Joi.string().max(100).allow('', null).optional(),
  tags: Joi.string().max(500).allow('', null).optional(),
  isPublished: Joi.boolean().optional(),
});

const newsletterSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Địa chỉ email không hợp lệ',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là trường bắt buộc',
  }),
});

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

module.exports = {
  createBannerSchema,
  updateBannerSchema,
  createNewsSchema,
  updateNewsSchema,
  newsletterSchema,
  feedbackSchema,
};
