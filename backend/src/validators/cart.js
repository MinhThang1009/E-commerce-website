const Joi = require('joi');

// Schema kiểm tra dữ liệu thêm vào giỏ hàng
const addToCartSchema = Joi.object({
  productId: Joi.number().integer().required().messages({
    'number.base': 'ID sản phẩm không hợp lệ',
    'any.required': 'ID sản phẩm là trường bắt buộc',
  }),
  variantId: Joi.number().integer().allow(null).optional(),
  quantity: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Số lượng phải là số',
    'number.integer': 'Số lượng phải là số nguyên',
    'number.min': 'Số lượng phải lớn hơn 0',
  }),
});

// Schema kiểm tra dữ liệu cập nhật item trong giỏ hàng
const updateCartItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).required().messages({
    'number.base': 'Số lượng phải là số',
    'number.integer': 'Số lượng phải là số nguyên',
    'number.min': 'Số lượng phải lớn hơn 0',
    'any.required': 'Số lượng là trường bắt buộc',
  }),
});

// Schema item giỏ hàng dùng cho đồng bộ
const cartItemSchema = Joi.object({
  productId: Joi.number().integer().required().messages({
    'number.base': 'ID sản phẩm không hợp lệ',
    'any.required': 'ID sản phẩm là trường bắt buộc',
  }),
  variantId: Joi.number().integer().allow(null).optional(),
  quantity: Joi.number().integer().min(1).required().messages({
    'number.base': 'Số lượng phải là số',
    'number.integer': 'Số lượng phải là số nguyên',
    'number.min': 'Số lượng phải lớn hơn 0',
    'any.required': 'Số lượng là trường bắt buộc',
  }),
  name: Joi.string().optional(),
  price: Joi.number().optional(),
  image: Joi.string().optional(),
  attributes: Joi.object().optional(),
});

// Schema kiểm tra dữ liệu đồng bộ giỏ hàng
const syncCartSchema = Joi.object({
  items: Joi.array().items(cartItemSchema).required().messages({
    'array.base': 'Danh sách sản phẩm phải là mảng',
    'any.required': 'Danh sách sản phẩm là trường bắt buộc',
  }),
});

module.exports = {
  addToCartSchema,
  updateCartItemSchema,
  syncCartSchema,
};
