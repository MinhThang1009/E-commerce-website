/**
 * @file ai-policy.js
 * @layer Service
 * @module ai
 *
 * AIPolicy — tập hợp các quy tắc thuần túy cho chatbot: validate input, chuẩn hóa query,
 * phân loại ý định người dùng.
 *
 * "Pure functions" nghĩa là: không có side effects, không gọi DB hay API,
 * không thay đổi state bên ngoài. Cùng input luôn cho cùng output → dễ test.
 *
 * Được dùng bởi ChatbotService (validate + normalize + classify intent + injection check).
 */

/**
 * Độ dài tối đa của một tin nhắn chatbot (ký tự).
 * Giới hạn này bảo vệ server khỏi payload quá lớn và giới hạn context window của LLM.
 * LLM tính phí theo token (~1 token ≈ 4 ký tự), tin nhắn quá dài = tốn tiền + chậm hơn.
 */
const MAX_MESSAGE_LENGTH = 500;

/**
 * Bảng viết tắt domain-specific mà LLM không tự hiểu được.
 *
 * Tại sao chỉ giữ brand/model abbreviations, không mở rộng thêm?
 * Viết tắt hội thoại thông thường (ko, co, dc, ok...) LLM đã được huấn luyện để hiểu.
 * Chỉ những viết tắt đặc thù ngành kỹ thuật (ip, ss, mb, r5...) mới cần expand thủ công.
 *
 * Cú pháp regex trong key:
 *   \\b     = word boundary — đảm bảo "ip" khớp từ nguyên chứ không phải substring
 *             Ví dụ: "ip16" khớp, nhưng "tip" không khớp vì "ip" ở giữa từ
 *   (?=\\d) = positive lookahead — chỉ khớp nếu SAU đó có chữ số
 *             Ví dụ: "ip16" → "ip" khớp (có "1" theo sau), "ip " → "ip" không khớp
 *   \\b...\\b = khớp từ hoàn chỉnh (có boundary cả hai đầu)
 *
 * Flag 'giu' trong regex: g=tất cả lần khớp, i=không phân biệt hoa/thường, u=Unicode
 */
const ABBREV_MAP = {
  // "ip16" → "iPhone 16", "ip15pro" → "iPhone 15pro" (lookahead (?=\\d) giữ số theo sau)
  '\\bip(?=\\d)': 'iPhone ',
  // "ip" đứng độc lập (không có số theo sau) → "iPhone"
  '\\bip\\b': 'iPhone',
  // "pm" nối liền sau chữ-số: "17pm...", "ip17pm..." → " Pro Max"
  '(?<=\\d)pm': ' Pro Max',
  // "pm" → "Pro Max" (standalone)
  '\\bpm\\b': 'Pro Max',
  // "ss23" → "Samsung S23", "ss24" → "Samsung S24"
  '\\bss(?=\\d)': 'Samsung S',
  // "ss" đứng độc lập → "Samsung"
  '\\bss\\b': 'Samsung',
  // "mb" → "MacBook" (MacBook Air, MacBook Pro...)
  '\\bmb\\b': 'MacBook',
  // "op" → "OPPO" — ngoại trừ khi đứng sau ký tự tiếng Việt (để tránh match sai trong văn bản)
  '(?<![àáâãèéêìíòóôõùúýăđơưẠ-ỹ])\\bop\\b': 'OPPO',
  // "rl" → "realme"
  '\\brl\\b': 'realme',
  // "r5" → "AMD Ryzen 5" (chip laptop phổ biến)
  '\\br5\\b': 'AMD Ryzen 5',
  // "r7" → "AMD Ryzen 7"
  '\\br7\\b': 'AMD Ryzen 7',
  // Viết tắt đại từ xưng hô phổ biến trong chat
  // Loại cả chữ số 2 bên: "16b"/"5b" là mã/dung lượng, không phải đại từ
  '(?<![\\p{L}\\p{N}])b(?![\\p{L}\\p{N}])': 'bạn',

  // Lỗi đánh máy phổ biến — "tâm" (sai) → "tầm" (đúng) khi đứng trước giá
  '\\btâm\\b(?=\\s*\\d)': 'tầm',

  // Viết tắt câu hỏi hội thoại phổ biến
  // "bnh" nối liền: sau chữ ("pmbnh") hoặc sau số ("17bnh")
  '(?<=[a-zA-Z]{2,})bnh': ' bao nhiêu',
  '(?<=\\d)bnh': ' bao nhiêu',
  // "bnh" → "bao nhiêu" (standalone)
  '\\bbnh\\b': 'bao nhiêu',
  // "bh" nối liền sau chữ
  '(?<=[a-zA-Z]{2,})bh': ' bảo hành',
  // "bh" → "bảo hành" (standalone)
  '\\bbh\\b': 'bảo hành',

  // ── Thuật ngữ tiếng Anh → tiếng Việt tương đương ─────────────────────────────────
  // Mục đích: keyword fallback hoạt động được với query tiếng Anh mà không cần LLM.
  '\\bsmartphones?\\b': 'điện thoại',
  '\\btablets?\\b': 'máy tính bảng',
  '\\bheadphones?\\b': 'tai nghe',
  '\\bearphones?\\b': 'tai nghe',
  '\\bearbuds?\\b': 'tai nghe',
  '\\bsmartwatch(?:es)?\\b': 'đồng hồ thông minh',

  // ── Tiếng Việt không dấu → có dấu ─────────────────────────────────────────────
  // Normalize query từ user gõ không dấu (telex/VNI bị tắt) để intent classification
  // và price filter hoạt động đúng.
  //
  // Ưu tiên multi-word patterns trước (dài → ngắn) để tránh match một phần.
  // Chỉ map từ phổ biến trong ngữ cảnh mua sắm — không map toàn bộ từ điển.

  // Giá / tầm giá — quan trọng để price filter trong keyword-fallback.js hoạt động
  '\\bbao\\s+nhieu\\b': 'bao nhiêu', // "bao nhieu" → "bao nhiêu"
  '\\bgia\\s+bao\\s+nhieu\\b': 'giá bao nhiêu',
  '\\btam\\s+gia\\b': 'tầm giá',
  '\\bduoi\\b': 'dưới', // "dưới 15 triệu"
  '\\btren\\b': 'trên', // "trên 30 triệu"
  '\\bkhoang\\b': 'khoảng', // "khoảng 20 triệu"
  '\\btam\\b': 'tầm', // "tầm 20 triệu"
  '\\btrieu\\b': 'triệu', // đơn vị giá — price filter cần có dấu
  '\\bnghin\\b': 'nghìn', // đơn vị giá nhỏ
  // "gia" → "giá" nhưng KHÔNG đụng từ ghép tiếng Việt: "tham gia", "gia đình", "gia dụng",
  // "gia hạn"... (kèm biến thể không dấu) — tránh corrupt query thành "tham giá"/"giá đình"
  // và misclassify intent thành pricing
  // Lưu ý: dùng (?!\\p{L}) thay \\b sau từ có dấu — \\b của JS là ASCII-only,
  // "vị\\b"/"sư\\b" không bao giờ match trước khoảng trắng
  '(?<!tham\\s)\\bgia\\b(?!\\s+(?:đình|dinh|dụng|dung|vị|vi|hạn|han|công|cong|tăng|tang|nhập|nhap|sư|su)(?!\\p{L}))':
    'giá', // "giá bao nhiêu"

  // Trạng thái hàng hóa
  '\\bcon\\s+hang\\b': 'còn hàng',
  '\\bhet\\s+hang\\b': 'hết hàng',
  '\\bton\\s+kho\\b': 'tồn kho',
  '\\bcon\\s+ko\\b': 'còn không',

  // Dịch vụ / chính sách — quan trọng cho intent: policy, order_inquiry
  '\\bgiao\\s+hang\\b': 'giao hàng',
  '\\bbao\\s+hanh\\b': 'bảo hành', // cũng có "bh" nhưng user có thể gõ đủ
  '\\bdoi\\s+tra\\b': 'đổi trả',
  '\\bchinh\\s+sach\\b': 'chính sách',
  '\\bmien\\s+phi\\b': 'miễn phí',
  '\\bdon\\s+hang\\b': 'đơn hàng',
  '\\bdat\\s+hang\\b': 'đặt hàng',
  '\\bvan\\s+chuyen\\b': 'vận chuyển',

  // Hành động tìm kiếm / tư vấn
  '\\btu\\s+van\\b': 'tư vấn',
  '\\bso\\s+sanh\\b': 'so sánh',
  '\\btim\\s+kiem\\b': 'tìm kiếm',
  '\\bcai\\s+nao\\b': 'cái nào',
  '\\bnên\\s+mua\\b': 'nên mua', // đã có dấu nhưng để dự phòng
  '\\bnen\\s+mua\\b': 'nên mua',
  '\\bmuon\\s+mua\\b': 'muốn mua',
  '\\btot\\s+nhat\\b': 'tốt nhất',
  '\\bmoi\\s+nhat\\b': 'mới nhất',
  '\\bdang\\s+ban\\b': 'đang bán',

  // Loại sản phẩm (tiếng Việt không dấu)
  '\\bdien\\s+thoai\\b': 'điện thoại',
  '\\bmay\\s+tinh\\s+bang\\b': 'máy tính bảng',
  '\\bdong\\s+ho\\s+thong\\s+minh\\b': 'đồng hồ thông minh',
  '\\bdong\\s+ho\\b': 'đồng hồ',
  '\\btai\\s+nghe\\b': 'tai nghe',

  // Từ phủ định / trạng thái — ảnh hưởng negation filter và intent
  // Multi-word TRƯỚC single-word (quy tắc đầu section): '\\bkhong\\b' chạy trước sẽ
  // nuốt "khong" làm 2 pattern dưới thành dead code, "co" không bao giờ được thêm dấu
  '\\bkhong\\s+co\\b': 'không có',
  '\\bco\\s+khong\\b': 'có không',
  '\\bkhong\\b': 'không', // "không cần Samsung", "giao hàng không"
  '\\bhet\\b': 'hết', // "hết hàng chưa"

  // Trợ từ tìm kiếm thường gặp
  '\\bnhieu\\b': 'nhiều',
  '\\bnhat\\b': 'nhất', // "tốt nhất", "mới nhất" — khi đứng độc lập
  '\\bmoi\\b': 'mới',
  '\\btot\\b': 'tốt',
  '\\bre\\b': 'rẻ', // "rẻ nhất", "máy rẻ"
  '\\bdat\\b': 'đắt', // "đắt quá"
  '\\bnhe\\b': 'nhẹ', // "máy nhẹ"
  '\\bpin\\s+lau\\b': 'pin lâu',
};

/**
 * Mở rộng viết tắt trong câu truy vấn của người dùng.
 *
 * Chạy trước khi tìm kiếm vector để tăng độ chính xác:
 * "ip16 giá bnh" → "iPhone 16 giá bao nhiêu" → vector search tìm được sản phẩm đúng hơn.
 *
 * @param {string} text - Query gốc từ user (đã trim).
 * @returns {string} Query đã được mở rộng viết tắt.
 */
function expandAbbreviations(text) {
  let result = text;
  for (const [pattern, replacement] of Object.entries(ABBREV_MAP)) {
    result = result.replace(new RegExp(pattern, 'giu'), replacement);
  }
  return result;
}

/**
 * Kiểm tra tin nhắn chatbot có hợp lệ không.
 *
 * Kiểm tra 2 điều kiện:
 *   1. Không rỗng (sau khi trim bỏ khoảng trắng)
 *   2. Không vượt quá MAX_MESSAGE_LENGTH ký tự
 *
 * Tại sao trả về object { valid, reason } thay vì throw error?
 * Để caller (ChatbotService.handleMessage) tự quyết định cách xử lý lỗi (throw AppError 400).
 * Pure function không nên throw — throw là side effect.
 *
 * @param {string} message - Tin nhắn gốc từ user.
 * @returns {{ valid: boolean, reason?: string }} Kết quả kiểm tra.
 *   - `valid: true` nếu hợp lệ
 *   - `valid: false, reason: "..."` nếu không hợp lệ (kèm lý do cụ thể)
 */
function validateMessage(message) {
  if (!message || !message.trim()) {
    return { valid: false, reason: 'ai.messageEmpty' };
  }
  const trimmed = message.trim();
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, reason: 'ai.messageTooLong' };
  }
  // Phải có ít nhất 1 chữ cái hoặc chữ số (tránh chỉ gửi dấu câu như ", !, ?, ...)
  if (!/[\p{L}\p{N}]/u.test(trimmed)) {
    return { valid: false, reason: 'ai.messageInvalid' };
  }
  return { valid: true };
}

/**
 * Regex phát hiện câu hỏi ngoài phạm vi tư vấn sản phẩm công nghệ.
 *
 * Tại sao dùng regex thay vì LLM để phát hiện off-topic?
 * LLM mất 1-3 giây để phân tích. Với những từ khóa rõ ràng như "thời tiết", "bóng đá",
 * regex cho kết quả tức thì (< 1ms) và độ chính xác đủ tốt → tiết kiệm quota + giảm latency.
 *
 * Danh sách từ khóa gồm cả tiếng Việt và tiếng Anh để xử lý user nhắn bằng cả hai ngôn ngữ.
 */
// Lookbehind cho phim/movie/music/sức khỏe/health: các từ này là OFF-TOPIC khi user hỏi
// VỀ chủ đề đó, nhưng là USE-CASE hợp lệ khi đứng sau động từ ngữ cảnh sản phẩm
// ("điện thoại quay phim tốt", "smartwatch theo dõi sức khỏe", "tablet for watching movies")
const OFF_TOPIC_PATTERN =
  /thời tiết|bóng đá|(?<!nghe\s+)âm nhạc|(?<!quay\s+)(?<!xem\s+)(?<!coi\s+)(?<!chụp\s+)phim|nấu ăn|(?<!dõi\s+)(?<!đo\s+)sức khỏe|(?<!đọc\s+)(?<!xem\s+)tin tức|weather|football|soccer|(?<!nghe\s+)(?<!for\s+)(?<!play\s+)(?<!playing\s+)music|(?<!watch\s+)(?<!watching\s+)(?<!for\s+)movie|cooking|health(?!\p{L})(?!\s*(?:track|monitor|app|sensor))|news/u;

/**
 * Kiểm tra câu hỏi có ngoài phạm vi tư vấn sản phẩm không.
 *
 * @param {string} message - Tin nhắn (đã qua expandAbbreviations).
 * @returns {boolean} true nếu là câu hỏi off-topic, false nếu liên quan đến sản phẩm.
 */
function isOffTopic(message) {
  // toLowerCase() để match không phân biệt hoa/thường (Bóng đá, BÓNG ĐÁ, bóng đá đều match)
  return OFF_TOPIC_PATTERN.test(message.toLowerCase());
}

/**
 * Phân loại ý định của người dùng dựa trên nội dung tin nhắn.
 *
 * 6 loại intent theo thứ tự ưu tiên kiểm tra:
 *   1. off_topic      — hỏi ngoài phạm vi (thời tiết, bóng đá...)
 *   2. order_inquiry  — hỏi về đơn hàng, giao hàng, tracking
 *   3. policy         — hỏi về bảo hành, đổi trả, chính sách
 *   4. pricing        — hỏi về giá cả, ngân sách
 *   5. product_search — hỏi về sản phẩm cụ thể hoặc muốn tư vấn/so sánh
 *   6. general        — mọi câu hỏi còn lại (không khớp pattern nào)
 *
 * Thứ tự quan trọng: off_topic được check trước để tránh match sai
 * (ví dụ: "bóng đá Samsung" → off_topic, không phải product_search).
 *
 * Intent được dùng để:
 *   - Chatbot chọn template trả lời phù hợp
 *   - Analytics dashboard thống kê loại câu hỏi phổ biến
 *
 * @param {string} normalizedText - Query đã qua expandAbbreviations.
 * @returns {string} Tên intent: 'off_topic'|'order_inquiry'|'policy'|'pricing'|'product_search'|'general'
 */
function classifyIntent(normalizedText) {
  const lower = normalizedText.toLowerCase();

  // Off-topic phải check trước — ưu tiên cao nhất
  if (isOffTopic(normalizedText)) return 'off_topic';

  // Hỏi về trạng thái đơn hàng, vận chuyển
  // Word boundary bắt buộc: "flagship" chứa "ship", "trackpad" chứa "track",
  // "recorder" chứa "order" — không có \b thì câu hỏi sản phẩm bị route nhầm sang order_inquiry
  if (
    /đơn hàng|\border\b|giao hàng|\bship|\btrack(?:ing)?\b|\bdelivery\b|shipping\s*status/.test(
      lower,
    )
  )
    return 'order_inquiry';

  // Hỏi về chính sách mua hàng, bảo hành, đổi trả
  if (/bảo hành|đổi trả|chính sách|policy|warranty|return|refund|exchange/.test(lower))
    return 'policy';

  // Hỏi về giá tiền, ngân sách
  // "giá" cần boundary: "giáo viên" chứa "giá+o", "đánh giá" (review) không phải hỏi giá
  if (
    /(?<!đánh\s)giá(?!\p{L})|bao nhiêu|tiền|cost|price|how\s*much|affordable|budget|cheap/u.test(
      lower,
    )
  )
    return 'pricing';

  // Hỏi về sản phẩm cụ thể (tên thương hiệu, loại sản phẩm)
  if (
    /iphone|samsung|macbook|laptop|phone|computer|tablet|điện thoại|máy tính|đồng hồ|smartwatch|watch|ipad|oppo|xiaomi|realme|pixel|nokia|headphone|earbuds|airpods|galaxy|surface|pro max|ultra|fold/.test(
      lower,
    )
  )
    return 'product_search';

  // Muốn được tư vấn hoặc so sánh sản phẩm (không đề cập tên cụ thể)
  if (
    /tư vấn|so sánh|nên mua|recommend|suggest|tốt nhất|compare|best|should\s*i\s*buy|which\s*one/.test(
      lower,
    )
  )
    return 'product_search';

  // Không khớp pattern nào → câu hỏi chung chung
  return 'general';
}

/**
 * Phát hiện prompt injection patterns phổ biến trong tin nhắn user.
 * Pure function — không có side effects.
 *
 * @param {string} text
 * @returns {boolean} true nếu phát hiện injection attempt
 */
const INJECTION_PATTERNS = [
  // 1. Bỏ qua chỉ thị (EN + VI)
  /ignore\s+(all\s+)?(previous\s+)?instructions?/i,
  /bỏ\s*qua\s+(tất\s*cả\s+|mọi\s+)?(các\s+)?(hướng\s*dẫn|chỉ\s*thị|lệnh|quy\s*tắc)/iu,
  // 2. Chèn system prompt
  /\bsystem\s*:/i,
  // 3. Đóng vai / role-play (EN + VI)
  /\bact\s+as\b/i,
  // (?!\s*trò): "đóng vai trò" là cụm từ thường ("pin đóng vai trò quan trọng"), không phải role-play
  /(đóng\s*vai(?!\s*trò)|giả\s*làm|hành\s*động\s*như)/iu,
  // 4. Quên quy tắc (EN + VI)
  /\bforget\s+(all|everything|your)\b/i,
  // Object bắt buộc — "quên hết" đứng riêng là câu nói thường ("tôi quên hết mật khẩu"),
  // chỉ chặn khi đối tượng là quy tắc/luật/lệnh/hướng dẫn
  /quên\s+(hết|tất\s*cả|mọi|đi)\s*(quy\s*tắc|luật|lệnh|hướng\s*dẫn)/iu,
  // 5. Giả vờ / pretend (EN + VI)
  /\bpretend\s+(to\s+be|you\s+are)\b/i,
  /giả\s*vờ\s+(là|làm)/iu,
  // 6. Gán lại danh tính (EN + VI)
  /\byou\s+are\s+now\b/i,
  /(bây\s*giờ|giờ)\s+bạn\s+là/iu,
  // 7. Trích xuất dữ liệu (EN + VI)
  /(get|give|show|send|lấy|cho|đưa|cung\s*cấp|xuất|trích\s*xuất).{0,30}(user\s*data|data\s*user|dữ\s*liệu\s*(người\s*dùng|khách\s*hàng)|thông\s*tin\s*(cá\s*nhân|tài\s*khoản)|personal\s*(data|info)|customer\s*data|database|password|credentials?)/iu,
  // 8. Jailbreak / DAN / developer mode (EN + VI)
  /(jailbreak|DAN\s*mode|developer\s*mode|chế\s*độ\s*(nhà\s*phát\s*triển|không\s*giới\s*hạn))/iu,
  // 9. Lộ system prompt / hidden instructions (EN + VI)
  /(reveal|show|print|display|hiển\s*thị|cho\s*xem).{0,20}(system\s*prompt|hidden|instructions?|nội\s*dung\s*hệ\s*thống|prompt\s*ẩn)/iu,
  // 10. Ghi đè hành vi — "from now on" / "từ giờ trở đi" (EN + VI)
  /\bfrom\s+now\s+on\b/i,
  // Hậu tố bắt buộc — "từ nay/từ giờ" đứng riêng xuất hiện trong câu hỏi mua sắm bình thường
  // ("khuyến mãi từ nay đến tết"); biến thể "từ giờ bạn là..." đã được pattern 6 chặn
  /từ\s*(bây\s*giờ|giờ|nay)\s*(trở\s*đi|về\s*sau)/iu,
  // 11. Bypass / override safety trực tiếp (EN + VI)
  /\b(bypass|override|disable|turn\s*off|remove)\b.{0,20}\b(safety|filter|restriction|guardrail|limit)/i,
  /(vượt\s*qua|tắt|bỏ|gỡ\s*bỏ|phá).{0,20}(giới\s*hạn|bộ\s*lọc|filter|hạn\s*chế|an\s*toàn|bảo\s*vệ)/iu,
  // 12. Fictional framing — bọc injection trong kịch bản giả (EN + VI)
  /\b(hypothetical|imagine|fictional|pretend).{0,30}(no\s*(rules?|restrictions?|limits?|filters?)|unrestricted|unfiltered)/i,
  /(giả\s*sử|tưởng\s*tượng|trong\s*trường\s*hợp).{0,30}(không\s*(có\s*)?(quy\s*tắc|giới\s*hạn|hạn\s*chế|luật)|tự\s*do)/iu,
  // 13. Repeat / echo attack — bắt LLM tự affirm (chỉ EN, VI dễ false positive: "lặp lại giá iPhone")
  /\b(repeat\s+after\s+me|say\s+exactly|echo\s+this)\b/i,
  // 14. Ký tự ẩn — zero-width space/joiner, bidirectional override (OWASP LLM01 stealth injection)
  /[​‌‍‎‏‪-‮⁠﻿]/,
  // 15. Giả delimiter hệ thống — giả lệnh admin/system trong ngoặc hoặc heading (OWASP LLM01 boundary confusion)
  /#{3,}\s*(ADMIN|SYSTEM|INSTRUCTION|DIRECTIVE|OVERRIDE|IGNORE)/i,
  /\[\s*(ADMIN|SYSTEM|INSTRUCTION|UNLOCK|OVERRIDE|CHỈ\s*THỊ(\s*QUẢN\s*TRỊ)?|QUẢN\s*TRỊ|HỆ\s*THỐNG)\s*\]/iu,
];

function isPromptInjection(text) {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

module.exports = {
  validateMessage,
  expandAbbreviations,
  isOffTopic,
  classifyIntent,
  isPromptInjection,
  MAX_MESSAGE_LENGTH,
  ABBREV_MAP,
};
