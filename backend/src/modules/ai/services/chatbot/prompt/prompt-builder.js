/**
 * @file promptBuilder.js
 * @layer Service
 * @module ai
 * @description Business logic layer cho ai
 */
/**
 * [Augmentation] Tạo RAG prompt: inject product list + store info + matching rules + version warning.
 * Pure function — không dùng instance state, chỉ dùng params + process.env.
 * @param {string} userMessage - Query đã sanitize.
 * @param {Array<Object>} products - Sản phẩm từ retrieval (metadata + score).
 * @param {Object} context - Context bổ sung (originalMessage...).
 * @returns {string} Prompt text gửi cho LLM.
 */
function createPrompt(userMessage, products, context) {
  const productList =
    products.length > 0
      ? products
          .map(
            (p) =>
              `- ${p.lowConfidence ? '⚠️[low confidence] ' : ''}${p.name} (${p.category || 'Sản phẩm'}): ${p.shortDescription || 'Mô tả đang cập nhật'} - Giá: ${(p.price ?? p.basePrice)?.toLocaleString('vi-VN')} đ - Tình trạng: ${p.inStock ? 'Còn hàng' : 'Hết hàng'}`,
          )
          .join('\n')
      : '(Không tìm thấy sản phẩm nào phù hợp trong cơ sở dữ liệu)';

  // Context augmentation: phát hiện số version/thế hệ trong query,
  // báo LLM biết nếu không có sản phẩm nào khớp số đó trong retrieved context
  const queryVersions =
    userMessage.match(
      /\b\d{2,4}\b(?!\s*(?:gb|tb|mb|mah|hz|mp|w|mm|cm|inch|triệu|nghìn|tr|k|đ|"|'))/gi,
    ) || [];
  const productNames = products.map((p) => p.name?.toLowerCase() || '');
  const missingVersions = queryVersions.filter(
    (v) => !productNames.some((name) => name.includes(v)),
  );
  const versionWarning =
    missingVersions.length > 0
      ? `\n⚠️ CẢNH BÁO: Query đề cập đến số "${missingVersions.join(', ')}" nhưng KHÔNG có sản phẩm nào trong danh sách chứa số này. Đây là retrieved context gần nhất, KHÔNG phải sản phẩm được hỏi.`
      : '';

  return `
DANH SÁCH SẢN PHẨM HIỆN CÓ (Dữ liệu thực tế — retrieved bởi semantic search):
${productList}
${versionWarning}

THÔNG TIN CỬA HÀNG (${process.env.STORE_NAME || 'TechStore'}):
- Bảo hành: ${process.env.STORE_WARRANTY || '12 tháng chính hãng'}
- Giao hàng: ${process.env.STORE_SHIPPING || 'Miễn phí toàn quốc'}
- Đổi trả: ${process.env.STORE_RETURN || '30 ngày nếu lỗi nhà sản xuất'}
- Hỗ trợ kỹ thuật: ${process.env.STORE_SUPPORT || 'Tư vấn cấu hình, so sánh, hỗ trợ sau mua hàng'}

TIN NHẮN KHÁCH HÀNG: "${userMessage}"

QUY TẮC NGÔN NGỮ (BẮT BUỘC — ưu tiên cao nhất):
0. LUÔN trả lời bằng ĐÚNG ngôn ngữ khách hàng đang dùng.
   - Khách nhắn tiếng Việt → response, suggestions PHẢI bằng tiếng Việt.
   - Khách nhắn tiếng Anh → response, suggestions bằng tiếng Anh.
   - KHÔNG bao giờ tự ý chuyển sang tiếng Anh khi khách dùng tiếng Việt.

QUY TẮC SO KHỚP SẢN PHẨM (BẮT BUỘC):
1. Thương hiệu + Dòng sản phẩm + Hậu tố phiên bản là 3 yếu tố phân biệt.
   - Bản thường, Pro, Pro Max, Plus, Ultra, e, Lite → KHÁC NHAU HOÀN TOÀN.
   - Số thế hệ (13, 14, 15, 16, 17…) → KHÁC NHAU HOÀN TOÀN.
2. Máy tính bảng: WiFi, 4G, 5G cùng model → KHÁC NHAU.
3. Laptop: Cùng tên nhưng khác chip (i3/i5/i7, R5/R7, M3/M4/M5) → KHÁC NHAU.
4. NẾU CÓ ⚠️ CẢNH BÁO ở trên: BẮT BUỘC nói "Cửa hàng hiện chưa có [tên sản phẩm khách hỏi] ạ" trước, rồi mới gợi ý tương đương.
5. NẾU KHÔNG CÓ trong danh sách (không có cảnh báo): Nói rõ "chưa có" rồi gợi ý tương đương.
6. KHÔNG BỊA tên, giá, thông số ngoài danh sách.
7. matchedProducts PHẢI chứa TẤT CẢ sản phẩm được đề cập trong response. Nếu response đề cập 5 sản phẩm → matchedProducts phải có đúng 5 phần tử.

Trả về ĐÚNG định dạng JSON sau:
{
  "response": "Câu trả lời thân thiện bằng ngôn ngữ của khách (dùng emoji phù hợp)",
  "matchedProducts": ["Tên chính xác sản phẩm trong danh sách"],
  "suggestions": ["Gợi ý câu tiếp theo bằng ngôn ngữ của khách"],
  "intent": "product_search|pricing|policy|support|general|off_topic"
}`;
}

module.exports = { createPrompt };
