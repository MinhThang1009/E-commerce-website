const Joi = require('joi');

// Schema kiểm tra yêu cầu đổi điểm tích lũy
// points phải là số nguyên dương — không cho phép âm hoặc 0
const redeemPointsSchema = Joi.object({
  points: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'Số điểm phải là một con số hợp lệ',
      'number.integer': 'Số điểm phải là số nguyên',
      'number.positive': 'Số điểm phải là số dương (lớn hơn 0)',
      'any.required': 'Số điểm là trường bắt buộc',
    }),
});

module.exports = { redeemPointsSchema };
