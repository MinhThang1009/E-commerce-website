const Joi = require('joi');

const redeemPointsSchema = Joi.object({
  points: Joi.number().integer().positive().required().messages({
    'number.base': 'Số điểm phải là một con số hợp lệ',
    'number.integer': 'Số điểm phải là số nguyên',
    'number.positive': 'Số điểm phải là số dương (lớn hơn 0)',
    'any.required': 'Số điểm là trường bắt buộc',
  }),
});

module.exports = { redeemPointsSchema };
