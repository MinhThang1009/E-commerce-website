/**
 * @file responseParser.js
 * @layer Service
 * @module ai
 * @description Business logic layer cho ai
 */
const logger = require('@utils/logger');
const { simpleKeywordMatch } = require('@modules/ai/services/chatbot/keyword/keyword-fallback');

// Extract JSON object từ response text — xử lý trường hợp model wrap bằng text hoặc markdown
function extractJSON(text) {
  const clean = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {}
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

/**
 * [Generation] Parse JSON response từ LLM, map matchedProducts về sản phẩm thực trong retrieved context.
 * Exact match → fuzzy match (version keywords + word overlap). Phát hiện hallucination nếu LLM đề xuất SP không có.
 * @param {string} aiText - Raw text response từ LLM.
 * @param {Array<Object>} products - Sản phẩm từ retrieval (ground truth).
 * @param {string} userMessage - Query gốc (dùng cho fallback).
 * @returns {Object} {response, products, suggestions, intent}.
 */
function parseAIResponse(aiText, products, userMessage) {
  try {
    const parsed = extractJSON(aiText);
    if (!parsed) throw new Error('Không parse được JSON từ response');

    const matchedProducts = [];
    if (parsed.matchedProducts && Array.isArray(parsed.matchedProducts)) {
      parsed.matchedProducts.forEach((productName) => {
        const product = products.find((p) => {
          const pName = p.name.toLowerCase();
          const rName = productName.toLowerCase();

          if (pName === rName) return true;

          const versionKeywords = ['pro', 'max', 'plus', 'ultra', 'mini', 'se', 'ti', 'super'];
          const rVersions = versionKeywords.filter((v) => rName.includes(v));
          const pVersions = versionKeywords.filter((v) => pName.includes(v));
          if (
            rVersions.length !== pVersions.length ||
            !rVersions.every((v) => pVersions.includes(v))
          ) {
            return false;
          }

          const numbersP = pName.match(/\b\d+\b/g) || [];
          const numbersR = rName.match(/\b\d+\b/g) || [];
          if (numbersP.length > 0 && numbersR.length > 0) {
            const hasNumberMismatch =
              numbersR.some((n) => !numbersP.includes(n)) ||
              numbersP.some((n) => !numbersR.includes(n));
            if (hasNumberMismatch) return false;
          }

          const pWords = new Set(pName.split(/\s+/));
          const rWords = new Set(rName.split(/\s+/));
          if (rWords.size < 2) return false;
          const intersection = [...pWords].filter((w) => rWords.has(w) && w.length > 1);
          const minSize = Math.min(pWords.size, rWords.size);
          return minSize > 0 && intersection.length >= minSize * 0.8;
        });

        if (product) {
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
          logger.warn(
            `[RAG] Hallucination detected: LLM đề xuất "${productName}" nhưng không có trong retrieved context`,
          );
        }
      });
    }

    const seen = new Set();
    const uniqueProducts = matchedProducts.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    return {
      response: parsed.response || 'Tôi có thể giúp bạn tìm sản phẩm phù hợp!',
      products: uniqueProducts,
      suggestions: parsed.suggestions || [
        'Xem tất cả sản phẩm',
        'Sản phẩm khuyến mãi',
        'Hỗ trợ mua hàng',
        'Liên hệ tư vấn',
      ],
      intent: parsed.intent || 'general',
    };
  } catch (error) {
    logger.error('[RAG] parseAIResponse JSON.parse failed:', error.message);
  }

  return simpleKeywordMatch(userMessage, products);
}

module.exports = { parseAIResponse, extractJSON };
