/**
 * @file keywordFallback.js
 * @layer Service
 * @module ai
 * @description Business logic layer cho ai
 */
const { detectLanguage } = require('./languageDetector');
const logger = require('../../../utils/logger');

// Khớp từ khóa đơn giản (dùng khi AI không khả dụng hoặc parseAIResponse fail)
function simpleKeywordMatch(userMessage, products) {
  const lowerMessage = userMessage.toLowerCase().trim();
  const lang = detectLanguage(userMessage);
  const isEn = lang === 'en';
  let matchedProducts = [];

  const searchTerms = lowerMessage.split(' ').filter((term) => term.length > 2);
  searchTerms.push(lowerMessage);

  products.forEach((product) => {
    let matchScore = 0;
    const productName = product.name?.toLowerCase() || '';
    const productDesc = product.shortDescription?.toLowerCase() || '';

    searchTerms.forEach((term) => {
      if (productName.includes(term)) matchScore += 10;
      if (productDesc.includes(term)) matchScore += 5;
    });

    if (matchScore > 0) {
      matchedProducts.push({ ...product, matchScore });
    }
  });

  const versionNumbers = lowerMessage.match(/\b\d{2,}\b/g);
  if (versionNumbers) {
    const filtered = matchedProducts.filter((p) =>
      versionNumbers.some((v) => p.name?.toLowerCase().includes(v)),
    );
    if (filtered.length === 0) {
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

  matchedProducts.sort((a, b) => b.matchScore - a.matchScore);

  const uniqueProducts = matchedProducts.filter(
    (product, index, self) => index === self.findIndex((p) => p.id === product.id),
  );

  if (uniqueProducts.length > 0) {
    const topProducts = uniqueProducts.slice(0, 5);
    const productList = topProducts
      .map((p) => `• ${p.name} - ${(p.price ?? p.basePrice)?.toLocaleString('vi-VN')} đ`)
      .join('\n');

    return {
      response: isEn
        ? `🔍 I found some products matching your request:\n\n${productList}\n\nWould you like more details on any of these?`
        : `🔍 Mình tìm thấy một số sản phẩm phù hợp với yêu cầu của bạn nè: \n\n${productList} \n\nBạn muốn xem kỹ hơn sản phẩm nào không?`,
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

  if (
    /sản phẩm mới|hàng mới|mới nhất|new\s*(product|arrival|item)s?|latest|newest/.test(lowerMessage)
  ) {
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('Đã nhận diện ý định "sản phẩm mới"');
    }

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

  return getFallbackResponse(userMessage);
}

// Phản hồi dự phòng khi AI không khả dụng hoặc câu hỏi ngoài scope
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
