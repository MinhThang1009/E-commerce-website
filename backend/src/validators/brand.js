const Joi = require('joi');

// Schema tạo thương hiệu mới
const createBrandSchema = Joi.object({
  name:    Joi.string().trim().max(100).required().messages({
    'string.empty': 'Tên thương hiệu không được để trống',
    'string.max':   'Tên không được vượt quá 100 ký tự',
    'any.required': 'Tên là trường bắt buộc',
  }),
  slug:    Joi.string().trim().max(255).optional(),
  logoUrl: Joi.string().uri().allow('', null).optional(),
});

// Schema cập nhật thương hiệu — tất cả trường đều tuỳ chọn
const updateBrandSchema = Joi.object({
  name:    Joi.string().trim().max(100).optional(),
  slug:    Joi.string().trim().max(255).optional(),
  logoUrl: Joi.string().uri().allow('', null).optional(),
});

module.exports = { createBrandSchema, updateBrandSchema };
