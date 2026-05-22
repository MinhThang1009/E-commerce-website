/**
 * @file language-detector.js
 * @layer Service
 * @module ai
 *
 * LanguageDetector — phát hiện ngôn ngữ (tiếng Việt hay tiếng Anh) từ câu hỏi của user.
 *
 * Tại sao cần phát hiện ngôn ngữ?
 * Chatbot cần trả lời đúng ngôn ngữ user đang dùng.
 * User nhắn tiếng Việt → trả lời tiếng Việt (thân thiện: mình/em - bạn/anh/chị).
 * User nhắn tiếng Anh → trả lời tiếng Anh.
 *
 * Tại sao dùng regex thay vì thư viện detect-language?
 * Chatbot chỉ cần phân biệt 2 ngôn ngữ (vi/en), không cần xử lý 50+ ngôn ngữ.
 * Regex nhẹ hơn nhiều (< 1ms) so với thư viện nặng (cld3, franc...) cần load model.
 * Đủ chính xác cho usecase: tiếng Việt có dấu Unicode đặc trưng rất dễ nhận biết.
 *
 * Thuật toán 3 bước theo thứ tự ưu tiên:
 *   1. Có dấu Unicode tiếng Việt → chắc chắn là tiếng Việt (độ chính xác ~100%)
 *   2. Có từ không dấu phổ biến ("gia", "bao nhieu"...) → khả năng cao là tiếng Việt
 *   3. Không thuộc 2 trường hợp trên → coi là tiếng Anh (mặc định)
 */

/**
 * Regex nhận diện từ tiếng Việt viết không dấu phổ biến trong ngữ cảnh mua hàng.
 *
 * Tại sao cần rule này?
 * Nhiều user gõ tiếng Việt không dấu (gọi là "tiếng Việt không dấu/Vietlish"):
 * "ip16 gia bao nhieu" — không có dấu tiếng Việt nhưng rõ ràng là tiếng Việt.
 * Rule 1 (check dấu Unicode) sẽ không catch được → cần rule 2.
 *
 * Danh sách từ được chọn cẩn thận: phải là từ phổ biến trong tiếng Việt
 * nhưng ít xuất hiện trong tiếng Anh để tránh false positive.
 * Ví dụ: "gia" (giá) vs "garage" — dùng \b word boundary để tránh match "garage".
 *
 * Flag /i: case-insensitive (match cả "GIA" lẫn "gia").
 */
const VI_NO_ACCENT =
  /\b(gia|bao nhieu|dien thoai|san pham|co khong|xem|mua|ban|hang|tim|so sanh|nen mua|tot nhat|gia ca|re nhat|khuyen mai|bao hanh|doi tra|giao hang|co hang|het hang|mau|phien ban|cau hinh|thong so|pin|man hinh|camera|chip|ram|bon nho|chinh hang)\b/i;

/**
 * Phát hiện ngôn ngữ của đoạn text là tiếng Việt hay tiếng Anh.
 *
 * **Bước 1 — Dấu Unicode tiếng Việt (rule mạnh nhất):**
 * Tiếng Việt có bộ ký tự Unicode đặc trưng không có trong tiếng Anh:
 * à á â ã è é ê ì í ò ó ô õ ù ú ý ă đ ơ ư và các biến thể với dấu thanh (Ạ-ỹ).
 * Nếu phát hiện bất kỳ ký tự nào trong số này → chắc chắn là tiếng Việt.
 *
 * Giải thích regex /[àáâãèéêìíòóôõùúýăđơưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯẠ-ỹ]/:
 * [...]  = character class — khớp bất kỳ ký tự nào trong ngoặc
 * Ạ-ỹ    = dải Unicode từ Ạ đến ỹ (bao gồm tất cả ký tự có dấu thanh tiếng Việt)
 *
 * **Bước 2 — Từ phổ biến viết không dấu:**
 * User có thể gõ tiếng Việt không dấu → check danh sách từ thường gặp trong mua hàng.
 *
 * **Bước 3 — Mặc định là tiếng Anh:**
 * Không có dấu, không có từ nhận dạng được → giả định là tiếng Anh.
 * Đây là safe default vì phần lớn text không tiếng Việt sẽ là tiếng Anh trong usecase này.
 *
 * @param {string} text - Đoạn text cần phát hiện ngôn ngữ (câu hỏi của user).
 * @returns {'vi'|'en'} Mã ngôn ngữ: 'vi' = tiếng Việt, 'en' = tiếng Anh.
 */
function detectLanguage(text) {
  // Bước 1: Kiểm tra dấu Unicode tiếng Việt — nhanh và chính xác nhất
  if (/[àáâãèéêìíòóôõùúýăđơưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯẠ-ỹ]/.test(text)) return 'vi';

  // Bước 2: Kiểm tra từ tiếng Việt không dấu phổ biến
  if (VI_NO_ACCENT.test(text)) return 'vi';

  // Bước 3: Mặc định tiếng Anh
  return 'en';
}

module.exports = { detectLanguage };
