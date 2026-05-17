/**
 * @file aiPolicy.js
 * @layer Service
 * @module ai
 * @description Business logic layer cho ai
 */
// AIPolicy — pure rules cho AI chatbot input validation + query normalization.

const MAX_MESSAGE_LENGTH = 2000;

const ABBREV_MAP = {
  '\\bip\\b': 'iPhone',
  '\\bpm\\b': 'Pro Max',
  '\\bss\\b': 'Samsung',
  '\\bmb\\b': 'MacBook',
  '\\bxiaomi\\b': 'Xiaomi',
  '(?<![àáâãèéêìíòóôõùúýăđơưẠ-ỹ])\\bop\\b': 'OPPO',
  '\\brl\\b': 'realme',
  '\\br5\\b': 'AMD Ryzen 5',
  '\\br7\\b': 'AMD Ryzen 7',
  '\\bbh\\b': 'bảo hành',
  '\\bđh\\b': 'đơn hàng',
  '\\bbnh\\b': 'bao nhiêu',
};

/**
 * [Input] Expand viết tắt phổ biến: ip→iPhone, ss→Samsung, bnh→bao nhiêu...
 * @param {string} text - Query gốc.
 * @returns {string} Query đã expand.
 */
function expandAbbreviations(text) {
  let result = text;
  for (const [pattern, replacement] of Object.entries(ABBREV_MAP)) {
    result = result.replace(new RegExp(pattern, 'giu'), replacement);
  }
  return result;
}

/**
 * [Input] Validate tin nhắn chatbot: không rỗng, ≤2000 ký tự.
 * @param {string} message - Tin nhắn gốc.
 * @returns {{valid: boolean, reason?: string}}
 */
function validateMessage(message) {
  if (!message || !message.trim()) {
    return { valid: false, reason: 'Tin nhắn không được để trống' };
  }
  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    return { valid: false, reason: `Tin nhắn quá dài (tối đa ${MAX_MESSAGE_LENGTH} ký tự)` };
  }
  return { valid: true };
}

const OFF_TOPIC_PATTERN =
  /thời tiết|bóng đá|âm nhạc|phim|nấu ăn|sức khỏe|tin tức|weather|football|soccer|music|movie|cooking|health|news/;

function isOffTopic(message) {
  return OFF_TOPIC_PATTERN.test(message.toLowerCase());
}

function classifyIntent(normalizedText) {
  const lower = normalizedText.toLowerCase();
  if (isOffTopic(normalizedText)) return 'off_topic';
  if (/đơn hàng|order|giao hàng|ship|track|delivery|shipping\s*status/.test(lower))
    return 'order_inquiry';
  if (/bảo hành|đổi trả|chính sách|policy|warranty|return|refund|exchange/.test(lower))
    return 'policy';
  if (/giá|bao nhiêu|tiền|cost|price|how\s*much|affordable|budget|cheap/.test(lower))
    return 'pricing';
  if (
    /iphone|samsung|macbook|laptop|phone|computer|tablet|điện thoại|máy tính|đồng hồ|smartwatch|watch|ipad|oppo|xiaomi|realme|pixel|nokia|headphone|earbuds|airpods|galaxy|surface/.test(
      lower,
    )
  )
    return 'product_search';
  if (
    /tư vấn|so sánh|nên mua|recommend|suggest|tốt nhất|compare|best|should\s*i\s*buy|which\s*one/.test(
      lower,
    )
  )
    return 'product_search';
  return 'general';
}

module.exports = {
  validateMessage,
  expandAbbreviations,
  isOffTopic,
  classifyIntent,
  MAX_MESSAGE_LENGTH,
};
