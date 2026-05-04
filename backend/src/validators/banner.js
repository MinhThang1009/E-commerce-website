const Joi = require('joi');

// Schema tạo banner mới
const createBannerSchema = Joi.object({
  title:    Joi.string().trim().max(255).required().messages({
    'string.empty': 'Tiêu đề banner không được để trống',
    'string.max':   'Tiêu đề không được vượt quá 255 ký tự',
    'any.required': 'Tiêu đề là trường bắt buộc',
  }),
  imageUrl: Joi.string().uri().required().messages({
    'string.uri':   'imageUrl phải là URL hợp lệ',
    'string.empty': 'imageUrl không được để trống',
    'any.required': 'imageUrl là trường bắt buộc',
  }),
  linkUrl:  Joi.string().uri().allow('', null).optional(),
  position: Joi.string().valid('home_hero', 'home_middle', 'sidebar').optional(),
  isActive: Joi.boolean().optional(),
  priority: Joi.number().integer().min(0).optional(),
});

// Schema cập nhật banner — tất cả trường đều tuỳ chọn
const updateBannerSchema = Joi.object({
  title:    Joi.string().trim().max(255).optional(),
  imageUrl: Joi.string().uri().optional(),
  linkUrl:  Joi.string().uri().allow('', null).optional(),
  position: Joi.string().valid('home_hero', 'home_middle', 'sidebar').optional(),
  isActive: Joi.boolean().optional(),
  priority: Joi.number().integer().min(0).optional(),
});

module.exports = { createBannerSchema, updateBannerSchema };
