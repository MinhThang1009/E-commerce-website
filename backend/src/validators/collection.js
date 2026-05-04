const Joi = require('joi');

// Schema tạo bộ sưu tập mới
const createCollectionSchema = Joi.object({
  name:        Joi.string().trim().max(255).required().messages({
    'string.empty': 'Tên bộ sưu tập không được để trống',
    'string.max':   'Tên không được vượt quá 255 ký tự',
    'any.required': 'Tên là trường bắt buộc',
  }),
  slug:        Joi.string().trim().max(255).optional(),
  description: Joi.string().max(2000).allow('', null).optional(),
  thumbnail:   Joi.string().uri().allow('', null).optional(),
  isActive:    Joi.boolean().optional(),
});

// Schema cập nhật bộ sưu tập — tất cả trường đều tuỳ chọn
const updateCollectionSchema = Joi.object({
  name:        Joi.string().trim().max(255).optional(),
  slug:        Joi.string().trim().max(255).optional(),
  description: Joi.string().max(2000).allow('', null).optional(),
  thumbnail:   Joi.string().uri().allow('', null).optional(),
  isActive:    Joi.boolean().optional(),
});

module.exports = { createCollectionSchema, updateCollectionSchema };
