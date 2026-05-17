// AiPolicy — pure rules cho AI chatbot input validation + query normalization.

const MAX_MESSAGE_LENGTH = 2000;

const ABBREV_MAP = {
  '\\bip\\b': 'iPhone',
  '\\bpm\\b': 'Pro Max',
  '\\bss\\b': 'Samsung',
  '\\bmb\\b': 'MacBook',
  '\\bxl\\b': 'Xiaomi',
  '\\bop\\b': 'OPPO',
  '\\brl\\b': 'realme',
  '\\br5\\b': 'AMD Ryzen 5',
  '\\br7\\b': 'AMD Ryzen 7',
  '\\bsp\\b': 'sản phẩm',
  '\\bbh\\b': 'bảo hành',
  '\\bđh\\b': 'đơn hàng',
  '\\bbnh\\b': 'bao nhiêu',
  '\\bkm\\b': 'khuyến mãi',
};

function expandAbbreviations(text) {
  let result = text;
  for (const [pattern, replacement] of Object.entries(ABBREV_MAP)) {
    result = result.replace(new RegExp(pattern, 'gi'), replacement);
  }
  return result;
}

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
  expandAbbreviations,
  MAX_MESSAGE_LENGTH,
};
