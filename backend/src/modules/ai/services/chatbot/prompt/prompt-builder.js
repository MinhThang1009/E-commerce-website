/**
 * @file prompt-builder.js
 * @layer Service
 * @module ai
 *
 * PromptBuilder — xây dựng nội dung tin nhắn gửi cho LLM (phần "Augmented" trong RAG).
 *
 * Sau khi ChatbotService đã tìm được sản phẩm liên quan (Retrieval bước 5),
 * bước này tạo một đoạn text kết hợp:
 *   - Danh sách sản phẩm tìm được (ground truth từ DB)
 *   - Thông tin cửa hàng (bảo hành, giao hàng, đổi trả)
 *   - Câu hỏi của user
 *   - Các quy tắc cho LLM (không được bịa sản phẩm, phải trả lời đúng ngôn ngữ...)
 *   - Định dạng JSON mong muốn trong phản hồi
 *
 * Tại sao phải inject thông tin sản phẩm vào prompt?
 * LLM không biết kho hàng cụ thể của cửa hàng. Nếu không inject,
 * LLM sẽ bịa ra sản phẩm/giá (hallucination). Inject context thực tế → LLM
 * chỉ được nói về những gì có trong danh sách.
 *
 * Pure function — không có side effects, không gọi DB hay API.
 */

/**
 * Tạo nội dung prompt gửi cho LLM, kết hợp danh sách sản phẩm + thông tin cửa hàng + câu hỏi user.
 *
 * Đây là bước "Augmented" trong RAG: augment (tăng cường) câu hỏi của user
 * bằng context thực tế từ DB để LLM có thể trả lời chính xác.
 *
 * **Version warning là gì và tại sao cần?**
 * Đôi khi user hỏi "iPhone 17" nhưng vector search trả về "iPhone 16" (gần nhất).
 * Nếu không cảnh báo, LLM có thể tưởng rằng "iPhone 16" trong danh sách chính là "iPhone 17"
 * và trả lời sai. Version warning báo LLM biết: số trong query không khớp với số trong danh sách
 * → phải nói rõ "cửa hàng chưa có iPhone 17" thay vì bịa thông tin.
 *
 * @param {string} userMessage - Query của user đã sanitize (tối đa 500 ký tự, đã escape quotes).
 * @param {Array<Object>} products - Danh sách sản phẩm từ bước Retrieval.
 *   Mỗi sản phẩm có: name, category, shortDescription, price/basePrice, inStock, lowConfidence.
 * @returns {string} Nội dung prompt dạng text, sẵn sàng gửi cho LLM.
 */
function buildAugmentedPrompt(userMessage, products) {
  // ── Phần 1: Xây dựng danh sách sản phẩm ────────────────────────────────────────
  // Mỗi sản phẩm được format thành 1 dòng với đầy đủ thông tin cần thiết
  const retrievalContextText =
    products.length > 0
      ? products
          .map((p) =>
            // ⚠️[low confidence]: cờ báo kết quả tìm kiếm kém chính xác (score thấp)
            // LLM sẽ thận trọng hơn khi đề xuất sản phẩm có flag này
            (() => {
              const variantsStr = p.variants?.length
                ? ' | Phiên bản: ' +
                  p.variants
                    .map(
                      (v) =>
                        `${v.variantName}${v.price != null ? ' (' + Number(v.price).toLocaleString('vi-VN') + 'đ' : ''}${v.stockQuantity > 0 ? ', còn hàng' : ', hết hàng'})`,
                    )
                    .join('; ')
                : '';
              const ratingStr =
                p.ratingAverage != null && p.ratingAverage > 0
                  ? ` - Đánh giá: ${Number(p.ratingAverage).toFixed(1)}/5`
                  : '';
              const descStr =
                p.description && p.description !== p.shortDescription
                  ? ` - Mô tả: ${p.description.substring(0, 300)}`
                  : '';
              // Giá null (SP chỉ có giá variant) → ghi rõ thay vì "NaN đ" làm LLM bịa giá
              const priceVal = p.price ?? p.basePrice;
              const priceStr =
                priceVal != null
                  ? `${Number(priceVal).toLocaleString('vi-VN')} đ`
                  : 'đang cập nhật (xem giá theo phiên bản nếu có)';
              return `- ${p.lowConfidence ? '⚠️[low confidence] ' : ''}${p.name} (${p.category || 'Sản phẩm'}): ${p.shortDescription || 'Mô tả đang cập nhật'}${descStr}${p.specifications ? '. Thông số: ' + p.specifications : ''}${variantsStr} - Giá từ: ${priceStr} - Tình trạng: ${p.inStock ? 'Còn hàng' : 'Hết hàng'}${ratingStr}`;
            })(),
          )
          .join('\n')
      : '(Không tìm thấy sản phẩm nào phù hợp trong cơ sở dữ liệu)';

  // ── Phần 2: Version warning — cảnh báo khi số model trong query không khớp danh sách ──
  // Mục đích: ngăn LLM nhầm "iPhone 16" là "iPhone 17" chỉ vì tên gần giống.
  //
  // Cách hoạt động:
  //   1. Trích xuất tất cả số có 2+ chữ số trong query (16, 17, 256, 8GB...)
  //   2. Loại trừ số là đơn vị đo lường (gb, tb, hz, mAh, triệu, nghìn, k đồng...)
  //   3. Kiểm tra xem mỗi số có xuất hiện trong TÊN sản phẩm nào không
  //   4. Số không xuất hiện → thêm vào danh sách "missing versions" → sinh cảnh báo
  // Strip dải giá TRƯỚC khi extract — "15-20 triệu"/"15 đến 20 triệu" có số đầu không đứng
  // cạnh đơn vị nên lookahead bên dưới không loại được → bị nhầm thành số model
  // (đồng bộ với keyword-fallback.js bước version extract)
  const queryWithoutPriceRanges = userMessage.replace(
    /\b\d+(?:[.,]\d+)?\s*(?:[-–]|đến|tới|to)\s*\d+(?:[.,]\d+)?\s*(?:tr(?:iệu)?|nghìn|k\b|đ\b|vnd|đồng|million|m\b)\b/gi,
    ' ',
  );
  const queryVersions =
    queryWithoutPriceRanges.match(
      /\b\d{2,4}\b(?!\s*(?:gb|tb|mb|mah|hz|mp|w|mm|cm|inch|triệu|nghìn|tr|k|đ|"|'))/gi,
    ) || [];
  const productNames = products.map((p) => p.name?.toLowerCase() || '');
  const missingVersions = queryVersions.filter(
    (v) => !productNames.some((name) => name.includes(v)),
  );

  // Chỉ thêm cảnh báo khi thực sự có số model không khớp
  const versionWarning =
    missingVersions.length > 0
      ? `\n⚠️ CẢNH BÁO: Query đề cập đến số "${missingVersions.join(', ')}" nhưng KHÔNG có sản phẩm nào trong danh sách chứa số này. Đây là retrieved context gần nhất, KHÔNG phải sản phẩm được hỏi.`
      : '';

  // ── Phần 3: Tổng hợp thành prompt hoàn chỉnh ───────────────────────────────────
  // Cấu trúc prompt gồm 4 phần theo thứ tự:
  //   [A] Danh sách sản phẩm + cảnh báo version (nếu có)
  //   [B] Thông tin cửa hàng từ environment variables
  //   [C] Câu hỏi của user
  //   [D] Quy tắc ngôn ngữ + quy tắc so khớp sản phẩm + định dạng JSON output
  //
  // Thông tin cửa hàng lấy từ process.env để dễ cấu hình cho từng deployment
  // (không hardcode trong code → không cần sửa code khi thay đổi chính sách)
  return `
DANH SÁCH SẢN PHẨM HIỆN CÓ (Dữ liệu thực tế — retrieved bởi semantic search):
${retrievalContextText}
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

module.exports = { buildAugmentedPrompt };
