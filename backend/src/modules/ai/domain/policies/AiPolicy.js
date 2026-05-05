// AiPolicy — pure rules cho AI chatbot input validation.

const MAX_MESSAGE_LENGTH = 2000;

function validateMessage(message) {
  if (!message || !message.trim()) {
    return { valid: false, reason: 'Tin nhắn không được để trống' };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, reason: `Tin nhắn quá dài (tối đa ${MAX_MESSAGE_LENGTH} ký tự)` };
  }
  return { valid: true };
}

module.exports = {
  validateMessage,
  MAX_MESSAGE_LENGTH,
};
