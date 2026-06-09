/**
 * @file embedding-intent-classifier.js
 * @description Phân loại intent bằng cosine similarity giữa query embedding
 * và embedding của các câu ví dụ đại diện cho từng intent.
 *
 * Dùng làm fallback khi regex classifyIntent() trả về 'general' —
 * embedding phân biệt được các câu hỏi sản phẩm không có từ khóa rõ ràng
 * (vd: "bạn có 17 Pro Max không?" không chứa "iphone" nên regex bỏ qua).
 *
 * Các câu ví dụ được embed 1 lần lúc khởi động, lưu trong bộ nhớ.
 * Khi classify: embed query → tính avg cosine similarity với từng intent → chọn cao nhất.
 */

/** Câu ví dụ đại diện cho từng intent — không cần toàn diện, chỉ cần đa dạng */
const INTENT_EXAMPLES = {
  product_search: [
    'bạn có iPhone 17 không?',
    'cửa hàng có bán Samsung Galaxy S25 không?',
    'cho tôi xem laptop Dell',
    'tìm điện thoại cho người già',
    'shop có iPad Air không?',
    'có bán tai nghe bluetooth không?',
    'do you have the latest MacBook?',
    'is the iPhone 17 Pro Max in stock?',
    'muốn mua smartwatch',
    'bạn bán máy tính bảng không?',
  ],
  pricing: [
    'iPhone 17 giá bao nhiêu tiền?',
    'MacBook Pro M3 bao nhiêu?',
    'laptop tầm 15 triệu có loại nào?',
    'Samsung S25 giá rẻ nhất bao nhiêu?',
    'how much is the iPhone 17?',
    'ngân sách 10 triệu mua được gì?',
    'giá của Xiaomi Redmi Note là bao nhiêu?',
  ],
  order_inquiry: [
    'đơn hàng của tôi ở đâu rồi?',
    'bao giờ giao hàng đến?',
    'tôi đặt hôm qua chưa nhận được',
    'track my order',
    'ship đến khi nào?',
  ],
  policy: [
    'bảo hành điện thoại bao lâu?',
    'đổi trả hàng như thế nào?',
    'chính sách hoàn tiền của shop',
    'return policy',
    'hàng lỗi được đổi không?',
  ],
  general: [
    'chào bạn',
    'hi, bạn khỏe không?',
    'cảm ơn bạn nhiều',
    'ok hiểu rồi',
    'bạn là ai?',
    'hello, nice to meet you',
    'xin chào',
    'bạn có thể giúp tôi không?',
  ],
};

/** Ngưỡng tối thiểu — dưới ngưỡng này giữ nguyên intent từ regex */
const SIMILARITY_THRESHOLD = 0.55;

function cosineSimilarity(a, b) {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

class EmbeddingIntentClassifier {
  constructor() {
    this._exampleEmbeddings = {}; // intent → number[][]
    this._embedFn = null;
    this._ready = false;
  }

  /**
   * Khởi tạo classifier: embed tất cả câu ví dụ và cache lại.
   * Gọi 1 lần lúc startup — fire-and-forget với catch.
   *
   * @param {(text: string) => Promise<number[]>} embedFn
   */
  async initialize(embedFn) {
    this._embedFn = embedFn;
    // Tuần tự để tránh flood embedding API (rate limit 429)
    for (const [intent, examples] of Object.entries(INTENT_EXAMPLES)) {
      const embeddings = [];
      for (const ex of examples) {
        embeddings.push(await embedFn(ex));
      }
      this._exampleEmbeddings[intent] = embeddings;
    }
    this._ready = true;
  }

  isReady() {
    return this._ready;
  }

  /** Embed một câu query để dùng với classify() */
  async embed(text) {
    if (!this._embedFn) throw new Error('EmbeddingIntentClassifier chưa được initialize');
    return this._embedFn(text);
  }

  /**
   * Phân loại intent từ query embedding.
   * @param {number[]} queryEmbedding
   * @returns {string|null} Tên intent, hoặc null nếu không đủ confidence
   */
  classify(queryEmbedding) {
    let bestIntent = null;
    let bestScore = -Infinity;

    for (const [intent, embeddings] of Object.entries(this._exampleEmbeddings)) {
      const avgScore =
        embeddings.reduce((sum, emb) => sum + cosineSimilarity(queryEmbedding, emb), 0) /
        embeddings.length;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestIntent = intent;
      }
    }

    return bestScore >= SIMILARITY_THRESHOLD ? bestIntent : null;
  }
}

module.exports = new EmbeddingIntentClassifier();
module.exports.EmbeddingIntentClassifier = EmbeddingIntentClassifier;
module.exports.cosineSimilarity = cosineSimilarity;
module.exports.SIMILARITY_THRESHOLD = SIMILARITY_THRESHOLD;
module.exports.INTENT_EXAMPLES = INTENT_EXAMPLES;
