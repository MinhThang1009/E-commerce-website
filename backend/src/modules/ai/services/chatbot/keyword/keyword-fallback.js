/**
 * @file keyword-fallback.js
 * @layer Service
 * @module ai
 *
 * KeywordFallback — cơ chế dự phòng khi LLM không khả dụng.
 *
 * Có 3 tình huống dùng fallback này:
 *   1. Tất cả LLM providers đều lỗi (429/402/500/503 — hết quota, server down)
 *   2. parseLLMOutput() thất bại (LLM trả về JSON malformed)
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
const { classifyIntent } = require('@modules/ai/services/core/ai-policy');
const logger = require('@utils/logger');

const toNum = (v) => (v == null ? v : Number(v));

/**
 * Format giá cho dòng liệt kê sản phẩm.
 * Giá null (sản phẩm chỉ có giá theo variant) → text thay thế, tránh lộ "undefined đ" ra user.
 */
const formatListPrice = (product, isEn) => {
  const p = toNum(product.price ?? product.basePrice);
  if (p == null) return isEn ? 'price updating' : 'giá đang cập nhật';
  return isEn ? `${p.toLocaleString('vi-VN')} ₫` : `${p.toLocaleString('vi-VN')} đ`;
};

/** Build product card object chuẩn cho frontend. Dùng chung ở nhiều chỗ. */
const toProductCard = (product) => {
  const p = toNum(product.price ?? product.basePrice);
  const c = toNum(product.compareAtPrice);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: p,
    compareAtPrice: c,
    thumbnail: product.thumbnail,
    inStock: product.inStock,
    stockQuantity: product.stockQuantity,
    rating: null,
    // p != null bắt buộc: c > null luôn true với c dương → discount sai thành 100%
    discount: p != null && c && c > p ? Math.round(((c - p) / c) * 100) : 0,
  };
};

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
  // Phát hiện số model/thế hệ trong câu hỏi, loại bỏ số giá và thông số kỹ thuật trước.
  //
  // Vấn đề cũ: /\b\d{2,}\b/g không tách được số trong model code ("S99", "A57", "Reno15"),
  // và số giá như "15-20 triệu" bị nhầm thành số model → filter sai sản phẩm.
  //
  // Giải pháp:
  //   1. Strip dải giá (15-20 triệu), giá đơn (20 triệu), thông số kỹ thuật (128GB, 4000mAh)
  //   2. Extract standalone 2+ digit numbers: \b\d{2,}\b  (bắt "17" trong "iPhone 17")
  //   3. Extract số embedded trong model code: [a-zA-Z]+(\d{2,})\b (bắt "99" từ "S99", "57" từ "A57")
  // Đơn vị "đ" dùng (?!\p{L}) thay \b — \b của JS là ASCII-only nên "đ\b" không bao giờ
  // match ("15000000đ" sẽ không được strip → số giá bị nhầm thành số model)
  const queryForVersionExtract = lowerMessage
    // Strip dải giá: "15-20 triệu", "10 đến 15tr"
    .replace(
      /\b\d+(?:[.,]\d+)?\s*[-–]\s*\d+(?:[.,]\d+)?\s*(?:tr(?:iệu)?|nghìn|k\b|đ(?!\p{L})|vnd|đồng)(?!\p{L})/giu,
      ' ',
    )
    // Strip giá đơn: "20 triệu", "500k", "10đ"
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:tr(?:iệu)?|nghìn|k\b|đ(?!\p{L})|vnd|đồng)(?!\p{L})/giu, ' ')
    // Strip số ngân sách KHÔNG kèm đơn vị: "tầm 20", "dưới 15" — shorthand phổ biến,
    // user ngầm hiểu là triệu; nếu giữ lại sẽ bị version filter nhầm thành số model
    .replace(
      /\b(?:tầm|tâm|khoảng|dưới|trên|budget|around|under|over|about)\s*\d+(?:[.,]\d+)?\b/giu,
      ' ',
    )
    // Strip thông số kỹ thuật: "128GB", "4000mAh", "165Hz", "48MP"
    // Không strip "inch" vì "14 inch" trong tên sản phẩm là identifier (MacBook Pro 14 inch M5),
    // không phải thông số thuần túy → cần giữ "14" để version filter hoạt động đúng.
    .replace(/\b\d+\s*(?:gb|tb|mb|mah|hz|mp|w\b|mm|cm)\b/gi, ' ');

  // Standalone 2+ digit numbers: "17" trong "iPhone 17"
  const standaloneNums = queryForVersionExtract.match(/\b\d{2,}\b/g) || [];
  // Embedded trong model code: "99" từ "S99", "57" từ "A57", "15" từ "Reno15"
  const embeddedNums = [...queryForVersionExtract.matchAll(/[a-zA-Z]+(\d{2,})\b/g)].map(
    (m) => m[1],
  );
  const versionNumbers = [...new Set([...standaloneNums, ...embeddedNums])];

  if (versionNumbers.length > 0) {
    // Lọc chỉ giữ sản phẩm chứa ít nhất một số trùng với số model trong câu hỏi
    const filtered = matchedProducts.filter((p) =>
      versionNumbers.some((v) => p.name?.toLowerCase().includes(v)),
    );

    // Helper tạo response "chưa có sản phẩm này"
    const notFoundResponse = () => {
      const productName = lowerMessage
        .replace(
          /giá bao nhiêu|bao nhiêu tiền|có không|có ko|có màu gì|bán không|mua ở đâu|thông số|how much|price|available|color|where to buy|specs?|\?/gi,
          '',
        )
        .trim();
      return {
        response: isEn
          ? `🚫 We don't currently have ${productName} in stock. Would you like to see similar products?`
          : `🚫 Cửa hàng hiện chưa có ${productName} ạ. Bạn có muốn xem các sản phẩm tương tự đang có không?`,
        products: [],
        suggestions: isEn
          ? ['View similar products', 'View all phones', 'Get advice']
          : ['Xem sản phẩm tương tự', 'Xem tất cả điện thoại', 'Tư vấn thêm'],
        intent: 'product_search',
      };
    };

    if (filtered.length === 0) return notFoundResponse();

    // ── Brand coherence check ───────────────────────────────────────────────────────
    // Vấn đề: version filter chỉ so khớp số, không quan tâm brand.
    // Ví dụ: "iPhone 15 Pro" → version filter giữ "Xiaomi Redmi Note 15 Pro" vì cùng số "15",
    //   nhưng user hỏi iPhone, không phải Xiaomi.
    //
    // Giải pháp tổng quát (không hardcode brand):
    //   - Lấy token đầu tiên có ý nghĩa (dài > 3 ký tự, không phải số) làm "brand discriminator"
    //   - Nếu token này không xuất hiện trong BẤT KỲ kết quả nào của version filter
    //     → số khớp chỉ là trùng hợp ngẫu nhiên → treat as "not found" cho đúng brand đó
    //
    // Safety: chỉ áp dụng khi có BẢN kết quả sau version filter (filtered.length > 0),
    //   tránh false negative khi user hỏi chung chung không kèm brand.
    //
    // Ví dụ khác hoạt động đúng:
    //   "samsung a57 vs oppo reno15" → brand discriminator = "samsung"
    //     → filtered = [A57, Reno15] → "samsung" có trong A57 → giữ cả 2 ✅
    //   "macbook pro 14 giá bao nhiêu" → brand discriminator = "macbook"
    //     → filtered = [MacBook Pro 14] → "macbook" có trong kết quả → ok ✅
    // Chọn brand discriminator: từ đầu tiên trong query đáp ứng 3 điều kiện:
    //   1. Dài > 3 ký tự (tránh "và", "cái", "bao")
    //   2. Không phải số
    //   3. Xuất hiện trong ít nhất 1 sản phẩm đã match keyword scoring (trước version filter)
    //      → đảm bảo đây là từ sản phẩm thực, không phải từ ngữ pháp như "nhiêu", "phải", "được"
    //
    // Lý do cần điều kiện 3: query được enrich bằng history context ("bao nhiêu RAM?..."),
    // nên searchTerms chứa cả từ ngữ pháp không liên quan đến sản phẩm.
    // Chỉ từ thực sự xuất hiện trong product name mới là brand/model discriminator hợp lệ.
    const brandDiscriminator = searchTerms.find(
      (t) =>
        t.length > 3 &&
        !/^\d+$/.test(t) &&
        t !== lowerMessage &&
        matchedProducts.some((p) => p.name?.toLowerCase().includes(t)),
    );
    if (
      brandDiscriminator &&
      !filtered.some((p) => p.name?.toLowerCase().includes(brandDiscriminator))
    ) {
      return notFoundResponse();
    }

    matchedProducts = filtered;
  }

  // ── Bước 3 (mới): Negation filter ─────────────────────────────────────────────────
  // Loại bỏ sản phẩm mà user nói rõ không muốn, bằng cách parse động từ phủ định từ query.
  //
  // Chỉ trigger với các động từ có nghĩa loại trừ rõ ràng:
  //   "không muốn X", "không thích X", "tránh X", "avoid X", "no X"
  //
  // KHÔNG trigger với "không cần X, gì cũng được":
  //   "không cần" = brand không quan trọng, chứ không phải "tôi ghét brand đó".
  //   "gì cũng được" sau mệnh đề xác nhận ý nghĩa này.
  //
  // Pattern capture group bắt phần sau động từ đến khi gặp từ kết thúc mệnh đề.
  // Ví dụ: "không muốn iPhone, Samsung hay OPPO" → excludedTerms = ["iphone","samsung","oppo"]
  // Ví dụ: "avoid Apple products" → excludedTerms = ["apple","products"]
  // "hay/hoặc/or" KHÔNG nằm trong terminator: chúng nối các item trong danh sách bị loại
  // ("không muốn iPhone, Samsung hay OPPO" phải loại CẢ 3) — connective được lọc khỏi
  // excludedTerms ở bước split bên dưới
  const negationMatch = lowerMessage.match(
    /(?:không\s+(?:muốn|thích|dùng)|tránh|avoid|don't\s+want|not\s+interested\s+in)\s+([\p{L}\p{N}\s,/]+?)(?=\s+(?:gì|được|cũng|mà|nhưng|,|$)|\s*$)/iu,
  );
  if (negationMatch) {
    const NEGATION_CONNECTIVES = new Set(['hay', 'hoặc', 'hoac', 'and']);
    const excludedTerms = negationMatch[1]
      .toLowerCase()
      .split(/[\s,/]+/)
      .filter((w) => w.length > 2 && !NEGATION_CONNECTIVES.has(w));
    if (excludedTerms.length > 0) {
      matchedProducts = matchedProducts.filter(
        (p) => !excludedTerms.some((term) => p.name?.toLowerCase().includes(term)),
      );
    }
  }

  // ── Bước 4 (mới): Price range filter ──────────────────────────────────────────────
  // Khi user đề cập tầm giá, lọc sản phẩm theo giá thực tế.
  // Tránh trường hợp "laptop tầm 20 triệu" trả về MacBook 31 triệu
  // vì version filter đã bị vô hiệu hóa sau khi strip "20 triệu".
  //
  // Các pattern được nhận:
  //   - Dải: "15-20 triệu", "15 đến 20 triệu", "15 tới 20tr"
  //   - Max:  "dưới 20 triệu", "under 20 million", "below 20tr"
  //   - Approx: "tầm 20 triệu", "khoảng 20tr", "around 20 million", "budget 20 million"
  //   - Min:  "trên 15 triệu", "over 15 million", "above 15tr"
  //
  // Safety: chỉ thu hẹp kết quả khi price filter còn ít nhất 1 sản phẩm,
  //   nếu không có sản phẩm nào trong tầm giá thì giữ nguyên (không over-filter).
  const PRICE_UNIT = '(?:tr(?:iệu)?|triệu|million|m\\b)';
  const NUM = '(\\d+(?:[.,]\\d+)?)';

  let minPrice = 0;
  let maxPrice = Infinity;

  const rangeMatch = lowerMessage.match(
    new RegExp(`${NUM}\\s*(?:[-–]|đến|tới)\\s*${NUM}\\s*${PRICE_UNIT}`, 'i'),
  );
  const maxMatch = lowerMessage.match(
    new RegExp(`(?:dưới|under|below|tối\\s*đa|max)\\s*${NUM}\\s*${PRICE_UNIT}`, 'i'),
  );
  const approxMatch = lowerMessage.match(
    new RegExp(`(?:tầm|tâm|khoảng|around|budget|about)\\s*${NUM}\\s*${PRICE_UNIT}`, 'i'),
  );
  const minMatch = lowerMessage.match(
    new RegExp(`(?:trên|over|above|tối\\s*thiểu|min)\\s*${NUM}\\s*${PRICE_UNIT}`, 'i'),
  );

  if (rangeMatch) {
    minPrice = parseFloat(rangeMatch[1].replace(',', '.')) * 1_000_000;
    maxPrice = parseFloat(rangeMatch[2].replace(',', '.')) * 1_000_000;
  } else if (maxMatch) {
    maxPrice = parseFloat(maxMatch[1].replace(',', '.')) * 1_000_000;
  } else if (approxMatch) {
    // "tầm 20 triệu" → window ±20% để không quá cứng (16M–24M)
    const center = parseFloat(approxMatch[1].replace(',', '.')) * 1_000_000;
    minPrice = center * 0.8;
    maxPrice = center * 1.2;
  } else if (minMatch) {
    minPrice = parseFloat(minMatch[1].replace(',', '.')) * 1_000_000;
  }

  if (minPrice > 0 || maxPrice < Infinity) {
    const priceFiltered = matchedProducts.filter((p) => {
      const price = toNum(p.price ?? p.basePrice);
      if (price == null) return true; // sản phẩm chưa có giá → không lọc
      return price >= minPrice && price <= maxPrice;
    });
    // Chỉ áp dụng khi còn kết quả; nếu tầm giá quá hẹp thì giữ nguyên
    if (priceFiltered.length > 0) matchedProducts = priceFiltered;
  }

  // ── Bước 4b (mới): Category prefix filter ─────────────────────────────────────
  // Vấn đề: vector search đôi khi retrieve sản phẩm nhầm category (ví dụ: "laptop
  // tầm 20 triệu" nhưng vector search trả về cả "Máy tính bảng Samsung Galaxy Tab").
  //
  // Giải pháp (non-hardcode): detect term trong query XUẤT HIỆN ở đầu tên sản phẩm
  // (theo convention DB: "Laptop ...", "Điện thoại ...", "Máy tính bảng ...").
  // Nếu tìm được đúng 1 category prefix term → đây là query hỏi về 1 loại sản phẩm cụ thể
  // → lọc chỉ giữ sản phẩm thuộc category đó.
  //
  // Safety: chỉ áp dụng khi có ĐÚNG 1 prefix term (không áp dụng khi query so sánh
  // nhiều category như "so sánh laptop và điện thoại" — khi đó có 2 prefix terms).
  //
  // Ví dụ đúng:  "laptop tầm 20 triệu" → "laptop" prefix → bỏ Tablet ✅
  // Ví dụ skip:  "so sánh MacBook vs iPhone" → "macbook" prefix 0 sản phẩm, "iphone" prefix 0
  //              → không filter ✅ (MacBook name bắt đầu bằng "laptop", không phải "macbook")
  // Set dedup: query lặp từ ("laptop nào là laptop tốt") tạo 2 term trùng → length===1 fail oan
  const categoryPrefixTerms = [
    ...new Set(searchTerms.filter((t) => t.length > 4 && !/^\d+$/.test(t) && t !== lowerMessage)),
  ].filter((t) => {
    const prefixCount = matchedProducts.filter((p) => p.name?.toLowerCase().startsWith(t)).length;
    return prefixCount > 0 && prefixCount < matchedProducts.length;
  });

  // Không áp dụng category filter khi query là so sánh nhiều sản phẩm.
  // "so sánh iPhone vs MacBook" → user muốn xem CẢ 2, không filter về 1 category.
  const isComparativeQuery = /\bvs\b|so sánh|compare|versus|hay là|hoặc là/i.test(lowerMessage);
  if (!isComparativeQuery && categoryPrefixTerms.length === 1) {
    const catFiltered = matchedProducts.filter((p) =>
      p.name?.toLowerCase().startsWith(categoryPrefixTerms[0]),
    );
    // catFiltered luôn > 0: categoryPrefixTerms[0] đã được lọc với prefixCount>0 (L300)
    // → nhánh `=== 0` không reach, guard chỉ để phòng thủ.
    /* istanbul ignore next */
    if (catFiltered.length > 0) matchedProducts = catFiltered;
  }

  // ── Bước 5: Sắp xếp theo điểm khớp (cao nhất lên đầu) ─────────────────────────
  matchedProducts.sort((a, b) => b.matchScore - a.matchScore);

  // ── Bước 6: Loại bỏ sản phẩm trùng lặp ────────────────────────────────────────
  const uniqueProducts = matchedProducts.filter(
    (product, index, self) => index === self.findIndex((p) => p.id === product.id),
  );

  // ── Bước 7: Intent-aware response ─────────────────────────────────────────────
  //
  // Khi LLM down, keyword fallback có thể cải thiện đáng kể bằng cách nhận biết
  // INTENT của câu hỏi và trả lời phù hợp từ structured data thay vì chỉ list sản phẩm.
  //
  // Detect intent từ 10 từ đầu query để tránh history context (được append vào cuối
  // bởi _enrichQueryFromHistory) làm lệch kết quả phân loại.
  const intentQuery = lowerMessage.split(' ').slice(0, 10).join(' ');
  const detectedIntent = classifyIntent(intentQuery);

  // Helper: build policy response từ env vars — store admin cấu hình, code không đổi
  const buildPolicyResponse = (withProducts) => {
    const shipping = process.env.STORE_SHIPPING || 'Miễn phí giao hàng toàn quốc';
    const warranty = process.env.STORE_WARRANTY || '12 tháng chính hãng';
    const returnP = process.env.STORE_RETURN || '30 ngày nếu lỗi nhà sản xuất';
    const support = process.env.STORE_SUPPORT || 'Tư vấn cấu hình, so sánh, hỗ trợ sau mua';
    const policyText = isEn
      ? `📋 Store policies:\n• Shipping: ${shipping}\n• Warranty: ${warranty}\n• Returns: ${returnP}\n• Support: ${support}`
      : `📋 Chính sách cửa hàng:\n• Giao hàng: ${shipping}\n• Bảo hành: ${warranty}\n• Đổi trả: ${returnP}\n• Hỗ trợ: ${support}`;
    return {
      response: policyText,
      products: withProducts ? uniqueProducts.slice(0, 3).map(toProductCard) : [],
      suggestions: isEn
        ? ['View phones', 'View laptops', 'Get advice']
        : ['Xem điện thoại', 'Xem laptop', 'Tư vấn thêm'],
      intent: detectedIntent,
    };
  };

  // Policy / order_inquiry không có sản phẩm → trả thẳng policy info
  if (
    (detectedIntent === 'policy' || detectedIntent === 'order_inquiry') &&
    uniqueProducts.length === 0
  ) {
    return buildPolicyResponse(false);
  }

  if (uniqueProducts.length > 0) {
    // Policy hoặc order_inquiry có kèm sản phẩm liên quan → trả policy + product cards
    // Ví dụ: "hôm nay mưa đi mua điện thoại có ship không" (order_inquiry) →
    //   trả chính sách giao hàng + list điện thoại đang có
    // order_inquiry: kèm products (user muốn mua hàng, cần biết ship + xem sản phẩm)
    // policy: chỉ policy text, không kèm products (user hỏi chính sách, không mua hàng)
    if (detectedIntent === 'order_inquiry') return buildPolicyResponse(true);
    if (detectedIntent === 'policy') return buildPolicyResponse(false);

    // Pricing intent với sản phẩm tìm thấy → trả giá trực tiếp thay vì generic list
    // Heuristic phân biệt "giá bao nhiêu" (cần giá) vs "bao nhiêu RAM" (cần spec):
    //   "bao nhiêu" theo sau bởi unit kỹ thuật → spec question, không format pricing
    const isPriceQuery =
      /giá|bao nhiêu tiền|bao nhiêu đ|how much|price\b|cost\b/i.test(intentQuery) ||
      (/bao nhiêu/i.test(intentQuery) &&
        !/bao nhiêu\s+(?:ram|gb|tb|mah|hz|pin|inch|camera|mp|w\b|nhân|core)/i.test(intentQuery));

    if (detectedIntent === 'pricing' && isPriceQuery) {
      const top = uniqueProducts[0];
      const price = toNum(top.price ?? top.basePrice);
      const stockSuffix = top.inStock
        ? isEn
          ? ', currently in stock 😊'
          : ', đang còn hàng ạ 😊'
        : isEn
          ? ' (currently out of stock)'
          : ' (hiện đang hết hàng)';
      // price null → câu thay thế, không nội suy "undefined" vào response
      const priceClause =
        price != null
          ? isEn
            ? `is priced at ${price.toLocaleString('vi-VN')} ₫`
            : `có giá ${price.toLocaleString('vi-VN')} đ`
          : isEn
            ? 'price is being updated'
            : 'đang cập nhật giá';
      return {
        response: `💰 ${top.name} ${priceClause}${stockSuffix}`,
        products: uniqueProducts.slice(0, 3).map(toProductCard),
        suggestions: isEn
          ? ['View details', 'Compare models', 'Get advice']
          : ['Xem chi tiết', 'So sánh dòng máy', 'Tư vấn thêm'],
        intent: detectedIntent,
      };
    }

    // Generic: list sản phẩm tìm thấy
    const topProducts = uniqueProducts.slice(0, 5);
    const productList = topProducts
      .map((p) => `• ${p.name} - ${formatListPrice(p, isEn)}`)
      .join('\n');
    return {
      response: isEn
        ? `🔍 I found some products matching your request:\n\n${productList}\n\nWould you like more details on any of these?`
        : `🔍 Mình tìm thấy một số sản phẩm phù hợp với yêu cầu của bạn nè: \n\n${productList} \n\nBạn muốn xem kỹ hơn sản phẩm nào không?`,
      products: topProducts.slice(0, 3).map(toProductCard),
      suggestions: isEn
        ? ['View details', 'Other products', 'Get advice']
        : ['Xem chi tiết', 'Sản phẩm khác', 'Tư vấn thêm'],
      intent: 'product_search',
    };
  }

  // ── Bước 8: Xử lý đặc biệt khi user hỏi "sản phẩm mới" ────────────────────────
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
      .map((p) => `• ${p.name} - ${formatListPrice(p, isEn)}`)
      .join('\n');

    return {
      response: isEn
        ? `🌟 Here are our latest arrivals:\n\n${productList}\n\nAnything catch your eye?`
        : `🌟 Đây là những sản phẩm mới nhất vừa cập bến cửa hàng mình nè: \n\n${productList} \n\nBạn ưng ý mẫu nào không?`,
      products: newProducts.slice(0, 3).map(toProductCard),
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
