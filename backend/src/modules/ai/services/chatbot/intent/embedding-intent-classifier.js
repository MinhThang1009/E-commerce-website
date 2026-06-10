/**
 * @file embedding-intent-classifier.js
 * @description Phân loại intent bằng cosine similarity giữa query embedding
 * và embedding của các câu ví dụ đại diện cho từng intent.
 *
 * Từ bản nâng cấp 2026-06: đây là TẦNG PHÂN LOẠI CHÍNH (primary) của bước ③
 * trong pipeline chatbot — regex `classifyIntent()` chỉ còn là fallback khi
 * embedding không khả dụng/không đủ confidence. Lý do: regex là closed-world,
 * câu không nằm trong pattern bị phân loại sai âm thầm ("flagship phone",
 * "điện thoại quay phim tốt"...); embedding phân loại theo ngữ nghĩa nên
 * không phụ thuộc từ khóa cứng.
 *
 * Các câu ví dụ được embed 1 lần lúc khởi động và CACHE XUỐNG ĐĨA
 * (data/intent-example-embeddings.json) — restart server không tốn lại
 * ~50 embedding calls; hash lệch (đổi examples/provider) → tự re-embed.
 * Khi classify: embed query → tính avg cosine similarity với từng intent → chọn cao nhất.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Câu ví dụ đại diện cho từng intent — không cần toàn diện, chỉ cần đa dạng.
 * Các câu đánh dấu (audit) là case từng bị regex phân loại sai (logic-audit 2026-06-10).
 */
const INTENT_EXAMPLES = {
  // Ranh giới với pricing: hỏi GIÁ của sản phẩm cụ thể = pricing;
  // tìm/tư vấn/browse sản phẩm (kể cả THEO BUDGET "tầm X triệu") = product_search.
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
    // Browse theo budget (KHÔNG phải pricing)
    'laptop tầm 15 triệu có loại nào?',
    'điện thoại khoảng 20 triệu có gì ngon?',
    'ngân sách 10 triệu thì mua được máy nào?',
    // Slang mua sắm VN
    'con nào pin trâu mà giá mềm?',
    'tư vấn con tai nghe bass ngon đi',
    'đt nào selfie xịn cho con gái?',
    'có con lap nào màn lớn không shop?',
    // Follow-up hỏi spec/màu của sản phẩm đang xem
    'cái này có những màu nào?',
    'nó chạy chip gì vậy?',
    'máy này pin có tốt không?',
    // (audit) các case regex từng misroute
    'flagship phone nào đáng mua nhất?',
    'laptop có trackpad tốt cho sinh viên',
    'điện thoại quay phim tốt tầm trung',
    'laptop cho giáo viên soạn bài',
    'đồng hồ theo dõi sức khỏe loại nào tốt?',
    'tablet for watching movies on the go',
  ],
  pricing: [
    'iPhone 17 giá bao nhiêu tiền?',
    'MacBook Pro M3 bao nhiêu?',
    'Samsung S25 giá rẻ nhất bao nhiêu?',
    'how much is the iPhone 17?',
    'giá của Xiaomi Redmi Note là bao nhiêu?',
    'con này giá sao bạn?',
    'cho xin bảng giá điện thoại',
    'cái đó bao nhiêu tiền vậy?',
  ],
  order_inquiry: [
    'đơn hàng của tôi ở đâu rồi?',
    'bao giờ giao hàng đến?',
    'tôi đặt hôm qua chưa nhận được',
    'track my order',
    'ship đến khi nào?',
    'phí giao hàng về Đà Nẵng bao nhiêu?',
    'kiểm tra giúp tôi đơn vừa đặt',
    'tôi muốn hủy đơn hàng vừa đặt',
    'mã vận đơn của tôi là gì?',
    'bao giờ bên shop phát hàng?',
    'has my order been shipped yet?',
    'sao đơn hàng của tôi bị hủy?',
  ],
  policy: [
    'bảo hành điện thoại bao lâu?',
    'đổi trả hàng như thế nào?',
    'chính sách hoàn tiền của shop',
    'return policy',
    'hàng lỗi được đổi không?',
    'rơi vỡ màn hình có được bảo hành không?',
    'điều kiện đổi trả là gì?',
    'máy bị lỗi thì được đổi mới hay phải sửa?',
    'mua trả góp cần những giấy tờ gì?',
    'thời gian hoàn tiền là bao lâu?',
    'có được kiểm tra hàng trước khi thanh toán không?',
    'do you offer free returns?',
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
  // Off-topic THUẦN — hỏi về chủ đề ngoài phạm vi, KHÔNG gắn với sản phẩm.
  // Câu trộn ("bóng đá Samsung S25 giá bao nhiêu") sẽ gần pricing/product_search hơn
  // → được trả lời về sản phẩm (quyết định thiết kế 2026-06-10, khác behavior regex cũ).
  off_topic: [
    'thời tiết hà nội hôm nay thế nào?',
    'kết quả bóng đá tối qua ai thắng?',
    'gợi ý cho tôi bộ phim hay cuối tuần',
    'cách nấu phở bò ngon',
    'tin tức chính trị mới nhất hôm nay',
    'triệu chứng cảm cúm nên uống thuốc gì?',
    "what's the weather like today?",
    'who won the football match last night?',
    'recommend me a good movie to watch',
    'how do I cook spaghetti carbonara?',
    'kể cho tôi một câu chuyện cười',
    'giải giúp tôi bài toán này',
    'viết giúp mình một đoạn văn ngắn',
    'giá vàng và chứng khoán hôm nay thế nào?',
    'kết quả xổ số hôm nay là gì?',
    'bài hát nào đang thịnh hành?',
    'chỗ nào du lịch đẹp dịp lễ này?',
    'lịch thi đấu bóng đá hôm nay',
    'help me with my math homework',
    'tell me something funny',
  ],
};

/**
 * Ngưỡng confidence theo từng intent — dưới ngưỡng → fallback regex.
 * off_topic đặt cao hơn vì hậu quả false positive nặng (block thẳng câu hỏi của user),
 * các intent khác sai thì chỉ lệch format trả lời. Calibrate bằng
 * `node scripts/eval-intent-classifier.js`.
 */
const INTENT_THRESHOLDS = {
  product_search: 0.55,
  pricing: 0.45,
  order_inquiry: 0.5,
  policy: 0.5,
  general: 0.5,
  off_topic: 0.5,
};

/** Ngưỡng mặc định (backward-compat cho classify() cũ) */
const SIMILARITY_THRESHOLD = 0.55;

/** Số ví dụ gần nhất dùng để tính score mỗi intent (top-k mean) */
const TOP_K_EXAMPLES = 3;

/** File cache embedding của examples — tránh ~50 calls mỗi lần server start */
const DEFAULT_CACHE_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'data',
  'intent-example-embeddings.json',
);

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
   * Hash của bộ examples + salt (fingerprint provider) — cache chỉ hợp lệ khi
   * examples KHÔNG đổi và embedding provider KHÔNG đổi (vector từ provider khác
   * không so sánh được với nhau).
   */
  _cacheHash(salt) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(INTENT_EXAMPLES) + '|' + (salt || ''))
      .digest('hex');
  }

  /**
   * Khởi tạo classifier: load cache embeddings nếu hash khớp, ngược lại embed
   * tất cả câu ví dụ rồi ghi cache. Gọi 1 lần lúc startup — fire-and-forget với catch.
   *
   * @param {(text: string) => Promise<number[]>} embedFn
   * @param {Object} [opts]
   * @param {string} [opts.cachePath] - Đường dẫn file cache (default: data/intent-example-embeddings.json)
   * @param {string} [opts.cacheSalt] - Fingerprint provider để invalidate cache khi đổi embedding model
   * @param {boolean} [opts.cache] - false để bỏ qua đọc/ghi cache (mặc định tắt trong NODE_ENV=test
   *   — unit test phải hermetic, không phụ thuộc/ghi file trên đĩa)
   */
  async initialize(
    embedFn,
    {
      cachePath = DEFAULT_CACHE_PATH,
      cacheSalt = '',
      cache = process.env.NODE_ENV !== 'test',
    } = {},
  ) {
    this._embedFn = embedFn;
    const hash = this._cacheHash(cacheSalt);

    // Thử load cache — lỗi đọc/parse coi như cache miss, không throw
    if (cache) {
      try {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        if (cached.hash === hash && cached.embeddings) {
          this._exampleEmbeddings = cached.embeddings;
          this._ready = true;
          return;
        }
      } catch {
        // cache miss → embed mới bên dưới
      }
    }

    // Tuần tự để tránh flood embedding API (rate limit 429)
    for (const [intent, examples] of Object.entries(INTENT_EXAMPLES)) {
      const embeddings = [];
      for (const ex of examples) {
        embeddings.push(await embedFn(ex));
      }
      this._exampleEmbeddings[intent] = embeddings;
    }
    this._ready = true;

    // Ghi cache — fail chỉ làm chậm lần start sau, không ảnh hưởng runtime
    if (cache) {
      try {
        fs.mkdirSync(path.dirname(cachePath), { recursive: true });
        fs.writeFileSync(
          cachePath,
          JSON.stringify({ hash, embeddings: this._exampleEmbeddings }),
          'utf8',
        );
      } catch {
        // bỏ qua — cache là tối ưu, không phải yêu cầu
      }
    }
  }

  isReady() {
    return this._ready;
  }

  /** Embed một câu query để dùng với classify()/classifyWithScore() */
  async embed(text) {
    if (!this._embedFn) throw new Error('EmbeddingIntentClassifier chưa được initialize');
    return this._embedFn(text);
  }

  /**
   * Phân loại intent kèm điểm confidence — KHÔNG áp threshold, để caller quyết
   * (caller dùng INTENT_THRESHOLDS per-intent).
   *
   * @param {number[]} queryEmbedding
   * @returns {{ intent: string, score: number }|null} null khi chưa có example embeddings
   */
  classifyWithScore(queryEmbedding) {
    let bestIntent = null;
    let bestScore = -Infinity;

    for (const [intent, embeddings] of Object.entries(this._exampleEmbeddings)) {
      // Top-k mean thay vì mean toàn bộ: intent dạng "catch-all" (off_topic gồm
      // thời tiết + bóng đá + nấu ăn...) có ví dụ đa chủ đề — mean toàn bộ pha loãng
      // điểm của các ví dụ khớp nhất ("kể chuyện cười" chỉ gần 1-2 ví dụ humor)
      const sims = embeddings.map((emb) => cosineSimilarity(queryEmbedding, emb));
      sims.sort((a, b) => b - a);
      const k = Math.min(TOP_K_EXAMPLES, sims.length);
      const score = sims.slice(0, k).reduce((s, v) => s + v, 0) / k;
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }

    return bestIntent === null ? null : { intent: bestIntent, score: bestScore };
  }

  /**
   * Phân loại intent từ query embedding (backward-compat — threshold phẳng).
   * @param {number[]} queryEmbedding
   * @returns {string|null} Tên intent, hoặc null nếu không đủ confidence
   */
  classify(queryEmbedding) {
    const result = this.classifyWithScore(queryEmbedding);
    if (!result) return null;
    return result.score >= SIMILARITY_THRESHOLD ? result.intent : null;
  }
}

module.exports = new EmbeddingIntentClassifier();
module.exports.EmbeddingIntentClassifier = EmbeddingIntentClassifier;
module.exports.cosineSimilarity = cosineSimilarity;
module.exports.SIMILARITY_THRESHOLD = SIMILARITY_THRESHOLD;
module.exports.INTENT_THRESHOLDS = INTENT_THRESHOLDS;
module.exports.INTENT_EXAMPLES = INTENT_EXAMPLES;
