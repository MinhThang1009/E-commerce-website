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

// Product schema — admin create/update sản phẩm.
const productSchema = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Tên sản phẩm không được để trống',
    'any.required': 'Tên sản phẩm là trường bắt buộc',
  }),
  description: Joi.string().required().messages({
    'string.empty': 'Mô tả không được để trống',
    'any.required': 'Mô tả là trường bắt buộc',
  }),
  shortDescription: Joi.string().required().messages({
    'string.empty': 'Mô tả ngắn không được để trống',
    'any.required': 'Mô tả ngắn là trường bắt buộc',
  }),
  price: Joi.number().min(0).required().messages({
    'number.base': 'Giá phải là số',
    'number.min': 'Giá không được nhỏ hơn 0',
    'any.required': 'Giá là trường bắt buộc',
  }),
  compareAtPrice: Joi.number().min(0).allow(null).optional(),
  images: Joi.array().items(Joi.string()).default([]),
  thumbnail: Joi.string().allow('').optional(),
  categoryIds: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.string())).optional(),
  inStock: Joi.boolean().default(true),
  stockQuantity: Joi.number().integer().min(0).default(0),
  featured: Joi.boolean().default(false),
  searchKeywords: Joi.array().items(Joi.string()).default([]),
  seoTitle: Joi.string().allow('').optional(),
  seoDescription: Joi.string().allow('').optional(),
  seoKeywords: Joi.array().items(Joi.string()).default([]),
  brand: Joi.string().allow('').optional(),
  model: Joi.string().allow('').optional(),
  condition: Joi.string().valid('new', 'like-new', 'used', 'refurbished').default('new'),
  warrantyMonths: Joi.number().integer().min(0).max(120).default(12),
  specifications: Joi.alternatives().try(Joi.object(), Joi.array()).default({}),
  attributes: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    values: Joi.array().items(Joi.string()).required(),
  })).optional(),
  variants: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    sku: Joi.string().allow('').optional(),
    attributes: Joi.object().pattern(Joi.string(), Joi.string()).required(),
    price: Joi.number().min(0).required(),
    stockQuantity: Joi.number().integer().min(0).default(0),
    images: Joi.array().items(Joi.string()).default([]),
    displayName: Joi.string().allow('').optional(),
    sortOrder: Joi.number().integer().min(0).default(0),
    isDefault: Joi.boolean().default(false),
    isAvailable: Joi.boolean().default(true),
  })).optional(),
  warrantyPackageIds: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.string())).optional(),
});

module.exports = {
  categorySchema,
  createBrandSchema,
  updateBrandSchema,
  createCollectionSchema,
  updateCollectionSchema,
  productSchema,
};
