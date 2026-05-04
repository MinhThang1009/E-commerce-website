const Joi = require('joi');

// Schema tạo bài tin tức mới
const createNewsSchema = Joi.object({
  title:       Joi.string().trim().max(255).required().messages({
    'string.empty': 'Tiêu đề bài viết không được để trống',
    'string.max':   'Tiêu đề không được vượt quá 255 ký tự',
    'any.required': 'Tiêu đề là trường bắt buộc',
  }),
  content:     Joi.string().min(10).required().messages({
    'string.empty': 'Nội dung bài viết không được để trống',
    'string.min':   'Nội dung phải có ít nhất 10 ký tự',
    'any.required': 'Nội dung là trường bắt buộc',
  }),
  slug:        Joi.string().trim().max(255).optional(),
  description: Joi.string().max(1000).allow('', null).optional(),
  thumbnail:   Joi.string().uri().allow('', null).optional(),
  category:    Joi.string().max(100).allow('', null).optional(),
  tags:        Joi.string().max(500).allow('', null).optional(),
  isPublished: Joi.boolean().optional(),
});

// Schema cập nhật bài tin tức — tất cả trường đều tuỳ chọn
const updateNewsSchema = Joi.object({
  title:       Joi.string().trim().max(255).optional(),
  content:     Joi.string().min(10).optional(),
  slug:        Joi.string().trim().max(255).optional(),
  description: Joi.string().max(1000).allow('', null).optional(),
  thumbnail:   Joi.string().uri().allow('', null).optional(),
  category:    Joi.string().max(100).allow('', null).optional(),
  tags:        Joi.string().max(500).allow('', null).optional(),
  isPublished: Joi.boolean().optional(),
});

module.exports = { createNewsSchema, updateNewsSchema };
