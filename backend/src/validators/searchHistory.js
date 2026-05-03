const Joi = require('joi');

// Schema kiểm tra query lưu lịch sử tìm kiếm
const saveSearchSchema = Joi.object({
  query: Joi.string()
    .trim()
    .min(1)
    .max(500)
    .required()
    .messages({
      'string.empty': 'Từ khóa tìm kiếm không được để trống',
      'string.min': 'Từ khóa tìm kiếm không được để trống',
      'string.max': 'Từ khóa tìm kiếm không được vượt quá 500 ký tự',
      'any.required': 'Từ khóa tìm kiếm là bắt buộc',
    }),
  // sessionId tùy chọn để nhóm tìm kiếm của guest
  sessionId: Joi.string().optional(),
});

module.exports = { saveSearchSchema };
