/**
 * @file languageDetector.js
 * @layer Service
 * @module ai
 * @description Business logic layer cho ai
 */
// Phát hiện ngôn ngữ: ưu tiên dấu tiếng Việt, fallback check common VI words không dấu
const VI_NO_ACCENT =
  /\b(gia|bao nhieu|dien thoai|san pham|co khong|xem|mua|ban|hang|tim|so sanh|nen mua|tot nhat|gia ca|re nhat|khuyen mai|bao hanh|doi tra|giao hang|co hang|het hang|mau|phien ban|cau hinh|thong so|pin|man hinh|camera|chip|ram|bon nho|chinh hang)\b/i;

function detectLanguage(text) {
  if (/[àáâãèéêìíòóôõùúýăđơưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯẠ-ỹ]/.test(text)) return 'vi';
  if (VI_NO_ACCENT.test(text)) return 'vi';
  return 'en';
}

module.exports = { detectLanguage };
