/**
 * @file keyword-fallback.js
 * @layer Service
 * @module ai
 *
 * KeywordFallback — cơ chế dự phòng khi LLM không khả dụng.
 *
 * Có 3 tình huống dùng fallback này:
 *   1. Tất cả LLM providers đều lỗi (429/402/500/503 — hết quota, server down)
 *   2. parseAIResponse() thất bại (LLM trả về JSON malformed)
 *   3. Không có provider nào được cấu hình (LLM_API_KEY không set)
 *
 * Phương pháp: so khớp từ khóa đơn giản (không dùng AI/vector)
 *   - Tokenize câu hỏi thành từng từ
 *   - Match từng từ với tên/mô tả sản phẩm
 *   - Sản phẩm nào có nhiều từ khớp nhất → xếp lên đầu
 *
 * Đây là "safety net" — chất lượng kém hơn LLM nhiều nhưng đảm bảo chatbot
 * luôn trả về phản hồi hữu ích thay vì lỗi 500.
 */
const { detectLanguage } = require('@modules/ai/services/chatbot/language/language-detector');
const logger = require('@utils/logger');

/**
 * Tìm kiếm sản phẩm bằng so khớp từ khóa đơn giản — dùng khi LLM không khả dụng.
 *
 * **Cách tính điểm khớp (matchScore):**
 *   - Tên sản phẩm chứa từ khóa: +10 điểm (quan trọng hơn)
 *   - Mô tả ngắn chứa từ khóa: +5 điểm (ít quan trọng hơn)
 *   - Toàn bộ câu hỏi khớp (không tách từ): +10 điểm (bonus khi câu hỏi ngắn và khớp toàn bộ)
 *
 * **Tại sao tên sản phẩm được trọng số cao hơn mô tả?**
 * User thường gõ tên sản phẩm (iPhone 16), không gõ mô tả (điện thoại cao cấp).
 * Tên sản phẩm khớp = chính xác hơn nhiều so với mô tả khớp.
 *
 * **Version number filtering:**
 * Nếu user hỏi "iPhone 17" nhưng kết quả chỉ có "iPhone 15, 16" → trả về
 * thông báo "chưa có" thay vì gợi ý sai.
 *
 * @param {string} userMessage - Câu hỏi của user (query gốc chưa qua normalize).
 * @param {Array<Object>} products - Danh sách sản phẩm từ vector search (có thể rỗng).
 * @returns {Object} Kết quả chuẩn:
 *   `{ response: string, products: Array, suggestions: Array, intent: string }`
 */
function simpleKeywordMatch(userMessage, products) {
  const lowerMessage = userMessage.toLowerCase().trim();
  const lang = detectLanguage(userMessage);
  const isEn = lang === 'en'; // true = user nhắn tiếng Anh → trả lời tiếng Anh
  let matchedProducts = [];

  // ── Bước 1: Tokenize và tính điểm khớp cho từng sản phẩm ───────────────────────
  // Tách câu hỏi thành từng từ riêng lẻ (filter từ ngắn hơn 3 ký tự để tránh match "và", "có"...)
  const searchTerms = lowerMessage.split(' ').filter((term) => term.length > 2);
  // Thêm cả toàn bộ câu hỏi để catch trường hợp query ngắn như "iPhone 16"
  searchTerms.push(lowerMessage);

  products.forEach((product) => {
    let matchScore = 0;
    const productName = product.name?.toLowerCase() || '';
    const productDesc = product.shortDescription?.toLowerCase() || '';

    searchTerms.forEach((term) => {
      if (productName.includes(term)) matchScore += 10; // Khớp tên → điểm cao
      if (productDesc.includes(term)) matchScore += 5; // Khớp mô tả → điểm thấp hơn
    });

    // Chỉ giữ sản phẩm có ít nhất 1 từ khớp
    if (matchScore > 0) {
      matchedProducts.push({ ...product, matchScore });
    }
  });

  // ── Bước 2: Version number filtering ──────────────────────────────────────────
  // Phát hiện số thế hệ trong câu hỏi (số có ≥ 2 chữ số)
  // Ví dụ: "iPhone 17" → ["17"], "Samsung S25 Ultra" → ["25"]
  const versionNumbers = lowerMessage.match(/\b\d{2,}\b/g);
  if (versionNumbers) {
    // Lọc chỉ giữ sản phẩm chứa ít nhất một số trùng với số trong câu hỏi
    const filtered = matchedProducts.filter((p) =>
      versionNumbers.some((v) => p.name?.toLowerCase().includes(v)),
    );

    if (filtered.length === 0) {
      // Không có sản phẩm nào khớp số thế hệ → thông báo "chưa có" rõ ràng
      // Trích xuất tên sản phẩm user đang hỏi bằng cách xóa các cụm từ phổ biến
      const productName = lowerMessage
        .replace(
          /giá bao nhiêu|bao nhiêu tiền|có không|có ko|có màu gì|bán không|mua ở đâu|thông số|how much|price|available|color|where to buy|specs?|\?/gi,
          '',
        )
        .trim();
      return {
        response: isEn
          ? `😔 We don't currently have ${productName} in stock. Would you like to see similar products?`
          : `😔 Cửa hàng hiện chưa có ${productName} ạ. Bạn có muốn xem các sản phẩm tương tự đang có không?`,
        products: [],
        suggestions: isEn
          ? ['View similar products', 'View all phones', 'Get advice']
          : ['Xem sản phẩm tương tự', 'Xem tất cả điện thoại', 'Tư vấn thêm'],
        intent: 'product_search',
      };
    }
    matchedProducts = filtered;
  }

  // ── Bước 3: Sắp xếp theo điểm khớp (cao nhất lên đầu) ─────────────────────────
  matchedProducts.sort((a, b) => b.matchScore - a.matchScore);

  // ── Bước 4: Loại bỏ sản phẩm trùng lặp ────────────────────────────────────────
  // Array.findIndex() dùng để kiểm tra sản phẩm này có phải lần đầu xuất hiện không
  // Cách hoạt động: nếu index của phần tử hiện tại === index tìm được bằng findIndex → là lần đầu
  const uniqueProducts = matchedProducts.filter(
    (product, index, self) => index === self.findIndex((p) => p.id === product.id),
  );

  // ── Bước 5: Trả về kết quả nếu tìm thấy sản phẩm ──────────────────────────────
  if (uniqueProducts.length > 0) {
    const topProducts = uniqueProducts.slice(0, 5); // Hiển thị tối đa 5 sản phẩm trong text
    const productList = topProducts
      .map((p) => `• ${p.name} - ${(p.price ?? p.basePrice)?.toLocaleString('vi-VN')} đ`)
      .join('\n');

    return {
      response: isEn
        ? `🔍 I found some products matching your request:\n\n${productList}\n\nWould you like more details on any of these?`
        : `🔍 Mình tìm thấy một số sản phẩm phù hợp với yêu cầu của bạn nè: \n\n${productList} \n\nBạn muốn xem kỹ hơn sản phẩm nào không?`,
      // Chỉ gửi 3 card sản phẩm cho frontend (nhiều hơn gây rối giao diện)
      products: topProducts.slice(0, 3).map((product) => {
        const p = product.price ?? product.basePrice;
        const c = product.compareAtPrice;
        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: p,
          compareAtPrice: c,
          thumbnail: product.thumbnail,
          inStock: product.inStock,
          rating: null,
          discount: c && c > p ? Math.round(((c - p) / c) * 100) : 0,
        };
      }),
      suggestions: isEn
        ? ['View details', 'Other products', 'Get advice']
        : ['Xem chi tiết', 'Sản phẩm khác', 'Tư vấn thêm'],
      intent: 'product_search',
    };
  }

  // ── Bước 6: Xử lý đặc biệt khi user hỏi "sản phẩm mới" ────────────────────────
  // Không có sản phẩm khớp từ khóa nhưng user hỏi về hàng mới → sắp xếp theo ngày tạo
  if (
    /sản phẩm mới|hàng mới|mới nhất|new\s*(product|arrival|item)s?|latest|newest/.test(lowerMessage)
  ) {
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('Đã nhận diện ý định "sản phẩm mới"');
    }

    // Sắp xếp theo createdAt giảm dần (mới nhất lên đầu)
    const newProducts = [...products]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const productList = newProducts
      .map((p) => `• ${p.name} - ${(p.price ?? p.basePrice)?.toLocaleString('vi-VN')} đ`)
      .join('\n');

    return {
      response: isEn
        ? `🌟 Here are our latest arrivals:\n\n${productList}\n\nAnything catch your eye?`
        : `🌟 Đây là những sản phẩm mới nhất vừa cập bến cửa hàng mình nè: \n\n${productList} \n\nBạn ưng ý mẫu nào không?`,
      products: newProducts.slice(0, 3).map((product) => {
        const p = product.price ?? product.basePrice;
        const c = product.compareAtPrice;
        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: p,
          compareAtPrice: c,
          thumbnail: product.thumbnail,
          inStock: product.inStock,
          rating: null,
          discount: c && c > p ? Math.round(((c - p) / c) * 100) : 0,
        };
      }),
      suggestions: isEn
        ? ['View details', 'Deals & promotions', 'Get advice']
        : ['Xem chi tiết', 'Sản phẩm khuyến mãi', 'Tư vấn thêm'],
      intent: 'product_search',
    };
  }

  // Không tìm được gì → trả response chào hỏi chung, mời user hỏi thêm
  return getFallbackResponse(userMessage);
}

/**
 * Trả về phản hồi chào hỏi chung khi chatbot không tìm được sản phẩm phù hợp.
 *
 * Đây là "last resort" — người dùng vẫn nhận được phản hồi thân thiện
 * thay vì màn hình lỗi hoặc im lặng.
 *
 * Tại sao cần hàm riêng thay vì hardcode trong simpleKeywordMatch?
 * Để chatbot-service có thể gọi trực tiếp khi cần trả lời fallback
 * mà không phải chạy qua toàn bộ logic keyword matching.
 *
 * @param {string} userMessage - Câu hỏi gốc của user (dùng để detect ngôn ngữ).
 * @returns {Object} Response object chuẩn:
 *   `{ response: string, products: [], suggestions: Array, intent: 'general' }`
 */
function getFallbackResponse(userMessage) {
  const storeName = process.env.STORE_NAME || 'TechStore';
  const lang = detectLanguage(userMessage);
  const isEn = lang === 'en';
  return {
    response: isEn
      ? `Hi there! I'm a support assistant at ${storeName}. How can I help you today? 😊`
      : `Chào bạn! Mình là nhân viên hỗ trợ của ${storeName}. Mình có thể giúp gì cho bạn hôm nay? 😊`,
    products: [],
    suggestions: isEn
      ? ['New arrivals', 'Deals & promotions', 'Shopping help', 'Product advice']
      : ['Xem sản phẩm mới', 'Sản phẩm khuyến mãi', 'Hỗ trợ mua hàng', 'Tư vấn sản phẩm'],
    intent: 'general',
  };
}

module.exports = { simpleKeywordMatch, getFallbackResponse };
