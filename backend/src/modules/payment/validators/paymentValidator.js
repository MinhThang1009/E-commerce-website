const Joi = require('joi');

const createUrlSchema = Joi.object({
  orderId: Joi.number().integer().positive().required().messages({
    'number.base': 'Order ID phải là số',
    'any.required': 'Order ID là bắt buộc',
  }),
});

const refundSchema = Joi.object({
  orderId: Joi.number().integer().positive().required().messages({
    'number.base': 'Order ID phải là số',
    'any.required': 'Order ID là bắt buộc',
  }),
  amount: Joi.number().positive().optional().messages({
    'number.positive': 'Số tiền hoàn phải lớn hơn 0',
  }),
  reason: Joi.string().max(500).optional(),
});

module.exports = {
  createUrlSchema,
  refundSchema,
};
