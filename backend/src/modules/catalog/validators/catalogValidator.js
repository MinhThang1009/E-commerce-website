const Joi = require('joi');

// Catalog validators — gộp Category, Brand, Collection. Sprint 6b sẽ thêm
// Product validators (createProduct/updateProduct cho admin).

const categorySchema = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Tên danh mục không được để trống',
    'any.required': 'Tên danh mục là trường bắt buộc',
  }),
  description: Joi.string().allow('').optional(),
  image: Joi.string().allow('').optional(),
  parentId: Joi.string().uuid().allow(null).optional(),
  isActive: Joi.boolean().default(true),
  sortOrder: Joi.number().integer().default(0),
});

const createBrandSchema = Joi.object({
  name: Joi.string().trim().max(100).required().messages({
    'string.empty': 'Tên thương hiệu không được để trống',
    'string.max': 'Tên không được vượt quá 100 ký tự',
    'any.required': 'Tên là trường bắt buộc',
  }),
  slug: Joi.string().trim().max(255).optional(),
  logoUrl: Joi.string().uri().allow('', null).optional(),
});

const updateBrandSchema = Joi.object({
  name: Joi.string().trim().max(100).optional(),
  slug: Joi.string().trim().max(255).optional(),
  logoUrl: Joi.string().uri().allow('', null).optional(),
});

const createCollectionSchema = Joi.object({
  name: Joi.string().trim().max(255).required().messages({
    'string.empty': 'Tên bộ sưu tập không được để trống',
    'string.max': 'Tên không được vượt quá 255 ký tự',
    'any.required': 'Tên là trường bắt buộc',
  }),
  slug: Joi.string().trim().max(255).optional(),
  description: Joi.string().max(2000).allow('', null).optional(),
  thumbnail: Joi.string().uri().allow('', null).optional(),
  isActive: Joi.boolean().optional(),
  productIds: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.string())).optional(),
});

const updateCollectionSchema = Joi.object({
  name: Joi.string().trim().max(255).optional(),
  slug: Joi.string().trim().max(255).optional(),
  description: Joi.string().max(2000).allow('', null).optional(),
  thumbnail: Joi.string().uri().allow('', null).optional(),
  isActive: Joi.boolean().optional(),
  productIds: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.string())).optional(),
});

module.exports = {
  categorySchema,
  createBrandSchema,
  updateBrandSchema,
  createCollectionSchema,
  updateCollectionSchema,
};
