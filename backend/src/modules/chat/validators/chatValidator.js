const Joi = require('joi');

const sendMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(2000).required().messages({
    'string.empty': 'Nội dung tin nhắn không được để trống',
    'string.min': 'Nội dung tin nhắn không được để trống',
    'string.max': 'Tin nhắn không được vượt quá 2000 ký tự',
    'any.required': 'Nội dung tin nhắn là bắt buộc',
  }),
  sessionId: Joi.string().uuid().optional().messages({
    'string.guid': 'sessionId không hợp lệ',
  }),
});

module.exports = { sendMessageSchema };
