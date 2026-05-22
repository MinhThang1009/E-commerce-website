/**
 * @file response-parser.js
 * @layer Service
 * @module ai
 *
 * ResponseParser — phân tích và làm sạch phản hồi JSON từ LLM.
 *
 * LLM trả về text, không phải object JavaScript. Có 3 vấn đề cần giải quyết:
 *   1. LLM đôi khi bọc JSON trong markdown code block (```json ... ```) → cần strip
 *   2. JSON có thể malformed (LLM không tuân thủ format) → cần fallback
 *   3. LLM có thể đề xuất sản phẩm không có trong kho (hallucination) → cần lọc
 *
 * Luồng xử lý:
 *   1. extractJSON()       — strip markdown, parse JSON (2 cách thử)
 *   2. parseAIResponse()   — map matchedProducts về sản phẩm thực trong DB
 *                          — phát hiện hallucination, log cảnh báo
 *                          — post-processing: bổ sung sản phẩm bị LLM bỏ sót
 *   3. Fallback            — nếu parse thất bại → simpleKeywordMatch()
 */
const logger = require('@utils/logger');
const { simpleKeywordMatch } = require('@modules/ai/services/chatbot/keyword/keyword-fallback');

/**
 * Trích xuất object JSON từ text response của LLM.
 *
 * LLM đôi khi trả về text như:
 *   ```json
 *   { "response": "..." }
 *   ```
 * hoặc thậm chí có text giải thích trước/sau JSON block.
 * Hàm này xử lý cả hai trường hợp.
 *
 * Chiến lược 2 bước:
 *   Bước 1: Strip markdown fences (```json...```) rồi JSON.parse trực tiếp
 *   Bước 2: Nếu bước 1 fail → tìm substring đầu tiên dạng {...} rồi parse
 *   Trả về null nếu cả 2 đều fail (không parse được)
 *
 * @param {string} text - Raw text response từ LLM API.
 * @returns {Object|null} Object đã parse, hoặc null nếu không parse được.
 */
function extractJSON(text) {
  // Strip markdown code fences nếu có: ```json\n...\n``` hoặc ```\n...\n```
  const clean = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();

  // Thử parse trực tiếp trước (trường hợp phổ biến nhất)
  try {
    return JSON.parse(clean);
  } catch {
    // Bỏ qua lỗi, thử cách khác
  }

  // Thử tìm substring JSON object ({...}) trong text
  // [\s\S]* match mọi ký tự kể cả newline (khác với . không match newline)
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // Bỏ qua lỗi, trả null bên dưới
    }
  }

  // Không parse được bằng cách nào → trả null, caller sẽ dùng fallback
  return null;
}

/**
 * Danh sách stopwords bị bỏ qua khi so khớp tên sản phẩm trong response text.
 * Những từ này quá phổ biến, nếu match sẽ gây false positive (match nhầm sản phẩm không liên quan).
 */
const STOPWORDS = new Set(['the', 'và', 'có', 'cho', 'với', 'của', 'là']);

/**
 * Các từ phủ định — dùng để phát hiện LLM đang nói sản phẩm KHÔNG có/không available.
 * Nếu câu chứa sản phẩm lại có từ phủ định → không inject card sản phẩm đó.
 */
const NEGATION_FRAGMENTS = [
  'không có',
  'chưa có',
  'không còn',
  'hết hàng',
  'không bán',
  'không có sẵn',
  'chưa về hàng',
  'không tìm thấy',
  'not available',
  'out of stock',
  'sold out',
  "don't have",
  'not found',
];

/**
 * Kiểm tra xem câu chứa từ khóa sản phẩm có mang nghĩa phủ định không.
 * Tìm vị trí đầu tiên của một từ khóa trong response, sau đó kiểm tra
 * trong phạm vi câu (tính từ dấu chấm câu gần nhất) có từ phủ định không.
 *
 * @param {string} rLower - Response text đã lowercase.
 * @param {string[]} words - Các từ khóa của tên sản phẩm.
 * @returns {boolean} true nếu phát hiện ngữ cảnh phủ định.
 */
function hasNegationContext(rLower, words) {
  // Tìm vị trí đầu tiên của bất kỳ từ khóa nào trong response
  let pos = Infinity;
  for (const w of words) {
    const i = rLower.indexOf(w);
    if (i !== -1 && i < pos) pos = i;
  }
  if (pos === Infinity) return false;

  // Lấy toàn bộ câu chứa từ khóa đó (từ dấu câu trước đến dấu câu sau)
  const sentStart = Math.max(0, rLower.lastIndexOf('\n', pos - 1) + 1);
  let sentEnd = rLower.length;
  for (const ch of ['.', '!', '?', '\n']) {
    const i = rLower.indexOf(ch, pos);
    if (i !== -1 && i < sentEnd) sentEnd = i;
  }
  const sentence = rLower.slice(sentStart, sentEnd + 1);

  return NEGATION_FRAGMENTS.some((neg) => sentence.includes(neg));
}

/**
 * Bổ sung sản phẩm mà LLM đề cập trong response text nhưng quên đưa vào matchedProducts.
 *
 * Tại sao cần hàm này?
 * LLM đôi khi viết "Bạn có thể xem thêm iPhone 15 Pro..." trong response nhưng
 * không đưa "iPhone 15 Pro" vào mảng matchedProducts. Frontend sẽ không hiển thị
 * card sản phẩm → user không click được. Hàm này phát hiện và bổ sung các sản phẩm bị bỏ sót.
 *
 * Cách hoạt động: word-overlap ≥ 75%
 *   - Tách tên sản phẩm thành các từ (bỏ stopwords và từ ngắn ≤ 2 ký tự)
 *   - Đếm số từ xuất hiện trong response text
 *   - Nếu ≥ 75% số từ xuất hiện → sản phẩm này được đề cập trong response → bổ sung
 *
 * Tại sao 75% chứ không phải 100%?
 * Tên sản phẩm dài có thể bị viết tắt trong response (bỏ bớt "Pro" chẳng hạn).
 * 75% đủ chặt để tránh false positive nhưng đủ linh hoạt để catch tên viết tắt.
 *
 * @param {string} responseText - Nội dung câu trả lời từ LLM (text, không phải JSON).
 * @param {Array<Object>} retrievedProducts - Tất cả sản phẩm từ bước Retrieval (ground truth).
 * @param {Set<number>} alreadyMatchedIds - Set ID sản phẩm đã có trong matchedProducts rồi (skip).
 * @returns {Array<Object>} Danh sách sản phẩm bổ sung (đã format giống matchedProducts).
 */
function extractProductsFromText(responseText, retrievedProducts, alreadyMatchedIds) {
  const rLower = responseText.toLowerCase();
  const extras = [];

  for (const p of retrievedProducts) {
    // Bỏ qua sản phẩm đã có trong matchedProducts
    if (alreadyMatchedIds.has(p.id)) continue;

    // Tách tên sản phẩm thành từng từ, lọc bỏ stopwords và từ quá ngắn
    const words = p.name
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));

    // Cần ít nhất 2 từ để tránh match nhầm (tên 1 từ quá chung chung)
    if (words.length < 2) continue;

    // Đếm số từ xuất hiện trong response text
    const matchCount = words.filter((w) => rLower.includes(w)).length;

    // Kiểm tra ngưỡng 75%: Math.ceil(75%) để làm tròn lên
    // Ví dụ: 4 từ → cần ít nhất Math.ceil(4 * 0.75) = 3 từ match
    if (matchCount < Math.ceil(words.length * 0.75)) continue;

    // Bỏ qua nếu LLM đang nói sản phẩm này KHÔNG có (phủ định trong cùng câu)
    // Ví dụ: "chưa có Samsung Galaxy S25 Ultra" → không inject card sản phẩm đó
    if (hasNegationContext(rLower, words)) continue;

    // Sản phẩm đạt ngưỡng → bổ sung vào danh sách
    const price = p.price ?? p.basePrice;
    const compare = p.compareAtPrice;
    extras.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price,
      compareAtPrice: compare,
      thumbnail: p.thumbnail,
      inStock: p.inStock !== undefined ? p.inStock : true,
      stockQuantity: p.stockQuantity,
      rating: null,
      // Tính % giảm giá: ((giá gốc - giá bán) / giá gốc) × 100, làm tròn số nguyên
      discount: compare && compare > price ? Math.round(((compare - price) / compare) * 100) : 0,
    });
  }
  return extras;
}

/**
 * Phân tích phản hồi JSON từ LLM và ánh xạ tên sản phẩm về object sản phẩm thực trong DB.
 *
 * LLM trả về tên sản phẩm dạng string (ví dụ: "iPhone 16 Pro Max").
 * Hàm này tìm sản phẩm tương ứng trong `products` (ground truth từ DB).
 *
 * **Tại sao cần logic so khớp phức tạp thay vì so khớp chính xác?**
 * LLM có thể viết tên không hoàn toàn giống tên trong DB:
 *   - "Apple iPhone 16 Pro Max" vs "iPhone 16 Pro Max" (thêm "Apple")
 *   - "iphone 16 pro max" vs "iPhone 16 Pro Max" (khác hoa/thường)
 *   - "iPhone 16 ProMax" vs "iPhone 16 Pro Max" (thiếu khoảng trắng)
 *
 * **Chiến lược so khớp (theo thứ tự từ chặt đến lỏng):**
 *   1. Exact match (lowercase) — trường hợp lý tưởng
 *   2. Version keyword check — "Pro", "Max", "Plus", "Ultra"... phải khớp chính xác
 *      (iPhone 16 Pro ≠ iPhone 16 Pro Max — "Max" là yếu tố phân biệt)
 *   3. Number check — số thế hệ phải khớp (iPhone 15 ≠ iPhone 16)
 *   4. Word overlap ≥ 80% — các từ còn lại phải khớp ít nhất 80%
 *
 * **Hallucination detection:**
 * Nếu LLM đề xuất tên sản phẩm không có trong retrieved products → log cảnh báo.
 * Điều này xảy ra khi LLM "tưởng tượng" sản phẩm không có trong kho.
 *
 * @param {string} aiText - Raw text response từ LLM (có thể có markdown fences).
 * @param {Array<Object>} products - Sản phẩm từ bước Retrieval (ground truth — không được thay đổi).
 * @param {string} userMessage - Câu hỏi gốc của user (dùng cho fallback nếu parse thất bại).
 * @returns {Object} Kết quả chuẩn hóa:
 *   - `response` {string}: câu trả lời bằng ngôn ngữ của user
 *   - `products` {Array}: danh sách sản phẩm đã được ánh xạ về object thực trong DB
 *   - `suggestions` {Array}: gợi ý câu hỏi tiếp theo
 *   - `intent` {string}: phân loại ý định
 */
function parseAIResponse(aiText, products, userMessage) {
  try {
    // ── Bước 1: Parse JSON từ text của LLM ──────────────────────────────────────
    const parsed = extractJSON(aiText);
    if (!parsed) throw new Error('Không parse được JSON từ response');

    // ── Bước 2: Ánh xạ tên sản phẩm → object thực trong DB ──────────────────────
    const matchedProducts = [];
    if (parsed.matchedProducts && Array.isArray(parsed.matchedProducts)) {
      parsed.matchedProducts.forEach((productName) => {
        // Tìm sản phẩm trong retrieved list khớp với tên LLM trả về
        const product = products.find((p) => {
          const pName = p.name.toLowerCase();
          const rName = productName.toLowerCase();

          // Kiểm tra 1: Exact match (trường hợp lý tưởng nhất)
          if (pName === rName) return true;

          // Kiểm tra 2: Version keywords phải khớp chính xác
          // "Pro Max" ≠ "Pro", "Ultra" ≠ "Plus" — đây là sản phẩm KHÁC NHAU
          const versionKeywords = ['pro', 'max', 'plus', 'ultra', 'mini', 'se', 'ti', 'super'];
          const rVersions = versionKeywords.filter((v) => rName.includes(v));
          const pVersions = versionKeywords.filter((v) => pName.includes(v));
          if (
            rVersions.length !== pVersions.length ||
            !rVersions.every((v) => pVersions.includes(v))
          ) {
            return false; // Version keywords không khớp → sản phẩm khác
          }

          // Kiểm tra 3: Số thế hệ không được mâu thuẫn (iPhone 15 ≠ iPhone 16)
          // Chỉ kiểm tra một chiều: nếu LLM đề cập số KHÔNG có trong tên sản phẩm → sai sản phẩm.
          // Không kiểm tra chiều ngược lại: LLM có thể bỏ qua số dung lượng ("512GB")
          // mà vẫn đúng sản phẩm. Ví dụ: "Samsung S25 512GB" → LLM viết "Samsung S25" → vẫn đúng.
          const numbersP = pName.match(/\b\d+\b/g) || [];
          const numbersR = rName.match(/\b\d+\b/g) || [];
          if (numbersP.length > 0 && numbersR.length > 0) {
            // LLM đề cập số không có trong sản phẩm → đây là sản phẩm khác
            const llmMentionsWrongNumber = numbersR.some((n) => !numbersP.includes(n));
            if (llmMentionsWrongNumber) {
              return false;
            }
          }

          // Kiểm tra 4: Word overlap ≥ 80% (fuzzy match cho tên viết tắt/khác format nhỏ)
          const pWords = new Set(pName.split(/\s+/));
          const rWords = new Set(rName.split(/\s+/));
          if (rWords.size < 2) return false; // Tên quá ngắn → không đủ thông tin để so khớp
          const intersection = [...pWords].filter((w) => rWords.has(w) && w.length > 1);
          const minSize = Math.min(pWords.size, rWords.size);
          return minSize > 0 && intersection.length >= minSize * 0.8;
        });

        if (product) {
          // Sản phẩm tìm thấy → format thành object chuẩn cho frontend
          const resolvedPrice = product.price ?? product.basePrice;
          const resolvedCompare = product.compareAtPrice;
          matchedProducts.push({
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: resolvedPrice,
            compareAtPrice: resolvedCompare,
            thumbnail: product.thumbnail,
            inStock: product.inStock !== undefined ? product.inStock : true,
            stockQuantity: product.stockQuantity,
            rating: null,
            discount:
              resolvedCompare && resolvedCompare > resolvedPrice
                ? Math.round(((resolvedCompare - resolvedPrice) / resolvedCompare) * 100)
                : 0,
          });
        } else {
          // LLM đề xuất sản phẩm không tồn tại trong kho → hallucination!
          // Log cảnh báo để dễ debug và theo dõi tần suất
          logger.warn(
            `[RAG] Hallucination detected: LLM đề xuất "${productName}" nhưng không có trong retrieved context`,
          );
          // Không thêm vào kết quả — chỉ trả về sản phẩm có thật trong DB
        }
      });
    }

    // ── Bước 3: Loại bỏ sản phẩm trùng lặp ─────────────────────────────────────
    // LLM có thể đề cập cùng một sản phẩm nhiều lần với tên khác nhau
    const seen = new Set();
    const uniqueProducts = matchedProducts.filter((p) => {
      if (seen.has(p.id)) return false; // Đã thấy ID này rồi → bỏ qua
      seen.add(p.id);
      return true;
    });

    // ── Bước 4 (Post-processing): Bổ sung sản phẩm bị LLM bỏ sót ───────────────
    // Tình huống: LLM đề cập "Samsung Galaxy S25" trong response nhưng không có trong matchedProducts
    // → extractProductsFromText phát hiện và bổ sung để frontend hiển thị đúng
    const alreadyMatchedIds = new Set(uniqueProducts.map((p) => p.id));
    const extras = extractProductsFromText(parsed.response || '', products, alreadyMatchedIds);
    if (extras.length > 0) {
      logger.debug(`[RAG] Post-processing: bổ sung ${extras.length} sản phẩm từ response text`);
    }
    const finalProducts = [...uniqueProducts, ...extras];

    // ── Bước 5: Trả về kết quả chuẩn hóa ────────────────────────────────────────
    return {
      response: parsed.response || 'Tôi có thể giúp bạn tìm sản phẩm phù hợp!',
      products: finalProducts,
      suggestions: parsed.suggestions || [
        'Xem tất cả sản phẩm',
        'Sản phẩm khuyến mãi',
        'Hỗ trợ mua hàng',
        'Liên hệ tư vấn',
      ],
      intent: parsed.intent || 'general',
    };
  } catch (error) {
    // JSON parse thất bại hoặc dữ liệu không hợp lệ → fallback về keyword matching
    logger.error('[RAG] parseAIResponse JSON.parse failed:', error.message);
  }

  // Fallback: không parse được JSON → dùng keyword matching đơn giản
  // simpleKeywordMatch không dùng LLM, chỉ so khớp từ khóa trong câu hỏi với tên sản phẩm
  return simpleKeywordMatch(userMessage, products);
}

module.exports = { parseAIResponse, extractJSON };
