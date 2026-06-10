/**
 * @file unified-embedding.js
 * @layer Service (shared)
 * @description Sinh vector embedding từ text — nền tảng cho vector search trong chatbot.
 *
 * **Embedding là gì?**
 * Embedding là kỹ thuật chuyển đổi text thành mảng số (vector) có 1024 chiều.
 * Hai đoạn text có ý nghĩa tương tự → vector gần nhau trong không gian 1024 chiều.
 * Ví dụ: "iPhone 15 Pro" và "điện thoại Apple" → vector gần nhau (cosine similarity cao).
 * Ngược lại, "iPhone 15 Pro" và "máy giặt Samsung" → vector xa nhau.
 *
 * **Tại sao cần phân biệt "passage" và "query"?**
 * Các embedding model hiện đại dùng "asymmetric embedding":
 * - "passage" (đoạn văn): dùng khi LƯU sản phẩm vào vector store (indexing).
 *   Text dài, chứa nhiều thông tin: tên + brand + mô tả + giá...
 * - "query" (câu hỏi): dùng khi TÌMKIẾM từ chatbot (search).
 *   Text ngắn, là câu hỏi của user: "ip15 pro giá bao nhiêu"
 *
 * Dùng prefix/instruction khác nhau giúp model hiểu ý nghĩa đúng hơn, tăng chất lượng search.
 * Nếu cùng dùng 1 loại prefix → model không biết đây là indexing hay searching → kém chính xác.
 *
 * Fallback chain: Jina v3 (JINA_API_KEY) → HF e5-instruct (HF_API_KEY) → HF e5-base (HF_API_KEY).
 * Provider nào lỗi → tự động thử provider tiếp theo. Provider cuối lỗi → throw Error.
 *
 * ⚠️ Cả 3 providers đều output 1024 chiều nhưng vector của 2 MODEL KHÁC NHAU không
 * so sánh được bằng cosine (không gian embedding khác nhau). Caller cần guard
 * cross-model → dùng generateEmbeddingWithMeta() để biết provider đã tạo vector.
 */
const axios = require('axios');
const logger = require('@utils/logger');

/** Tất cả providers phải trả về vector 1024 chiều — validate khi nhận kết quả. */
const EXPECTED_DIM = 1024;

// ──────────────────────────────────────────────────────────────────────────────
// Providers — mỗi hàm gọi 1 API embedding cụ thể, trả về mảng 1024 số thực
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Gọi Jina Embeddings v3 API để sinh vector embedding.
 *
 * Jina phân biệt passage/query bằng field `task` trong request body:
 * - `retrieval.passage` → khi indexing sản phẩm (lưu vào vector store)
 * - `retrieval.query`   → khi search (câu hỏi của user)
 *
 * Jina tự động áp dụng kiến trúc internal khác nhau cho 2 task này,
 * giúp tối ưu độ chính xác mà không cần caller xử lý prefix thủ công.
 *
 * @param {string} text - Text cần embedding.
 * @param {string} type - 'passage' (indexing sản phẩm) hoặc 'query' (câu hỏi tìm kiếm).
 * @param {string} apiKey - Jina API key (từ env JINA_API_KEY).
 * @returns {Promise<number[]>} Vector 1024 chiều (mảng 1024 số thực).
 * @throws {Error} Nếu API trả về vector sai số chiều hoặc request thất bại.
 */
async function jinaEmbed(text, type, apiKey) {
  const task = type === 'passage' ? 'retrieval.passage' : 'retrieval.query';
  const resp = await axios.post(
    'https://api.jina.ai/v1/embeddings',
    { model: 'jina-embeddings-v3', input: [text], task },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    },
  );
  const emb = resp.data?.data?.[0]?.embedding;
  if (!emb || emb.length !== EXPECTED_DIM) {
    throw new Error(`Jina: sai chiều ${emb?.length} (mong đợi ${EXPECTED_DIM})`);
  }
  return emb;
}

/**
 * Gọi HuggingFace multilingual-e5-large-instruct API để sinh vector embedding.
 *
 * Model e5-instruct yêu cầu prefix bắt buộc theo spec (không phải tùy chọn):
 * - Passage: "passage: " — prefix ngắn, đủ để model biết đây là document cần lưu
 * - Query: câu instruction dài giải thích task retrieval (e5-instruct format)
 *
 * Tại sao query cần instruction dài? Model e5-instruct được train với cơ chế
 * "task-specific instruction" — nó cần biết task (product search retrieval) và context
 * (Vietnamese e-commerce). Không có instruction → model dùng kiến trúc generic → kém chính xác.
 * Jina tự xử lý điều này internally qua field "task"; e5-instruct yêu cầu prefix tường minh.
 *
 * @param {string} text - Text cần embedding.
 * @param {string} type - 'passage' (indexing sản phẩm) hoặc 'query' (câu hỏi tìm kiếm).
 * @param {string} apiKey - HuggingFace API key (từ env HF_API_KEY).
 * @returns {Promise<number[]>} Vector 1024 chiều (mảng 1024 số thực).
 * @throws {Error} Nếu API trả về vector sai số chiều hoặc request thất bại.
 */
async function hfInstructEmbed(text, type, apiKey) {
  // Prefix bắt buộc theo spec của model e5-instruct — không phải text tùy ý
  const prefix =
    type === 'passage'
      ? 'passage: '
      : 'Instruct: Given a product search query, retrieve relevant Vietnamese e-commerce products\nQuery: ';
  const resp = await axios.post(
    'https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-large-instruct',
    { inputs: prefix + text },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    },
  );
  const emb = Array.isArray(resp.data[0]) ? resp.data[0] : resp.data;
  if (!emb || emb.length !== EXPECTED_DIM) {
    throw new Error(`e5-instruct: sai chiều ${emb?.length} (mong đợi ${EXPECTED_DIM})`);
  }
  return emb;
}

/**
 * Gọi HuggingFace multilingual-e5-large (base) API — fallback cuối cùng trong chain.
 *
 * Model e5-base (không có "instruct") dùng prefix đơn giản hơn:
 * - Passage: `"passage: "` — giống e5-instruct
 * - Query: `"query: "` — không cần instruction dài như e5-instruct
 *
 * **Tại sao e5-base là fallback cuối (không phải thứ 2)?**
 * e5-instruct thường cho kết quả tốt hơn e5-base trên task retrieval vì được fine-tune
 * với instruction tuning. Cả hai dùng chung HF_API_KEY nên nếu Jina fail → thử instruct trước,
 * chỉ xuống base khi instruct cũng fail (ví dụ: model overloaded trên HF).
 *
 * @param {string} text - Text cần embedding.
 * @param {string} type - 'passage' (indexing sản phẩm) hoặc 'query' (câu hỏi tìm kiếm).
 * @param {string} apiKey - HuggingFace API key (từ env HF_API_KEY).
 * @returns {Promise<number[]>} Vector 1024 chiều (mảng 1024 số thực).
 * @throws {Error} Nếu API trả về vector sai số chiều hoặc request thất bại.
 */
async function hfBaseEmbed(text, type, apiKey) {
  const prefix = type === 'passage' ? 'passage: ' : 'query: ';
  const resp = await axios.post(
    'https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-large',
    { inputs: prefix + text },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    },
  );
  const emb = Array.isArray(resp.data[0]) ? resp.data[0] : resp.data;
  if (!emb || emb.length !== EXPECTED_DIM) {
    throw new Error(`e5-base: sai chiều ${emb?.length} (mong đợi ${EXPECTED_DIM})`);
  }
  return emb;
}

// ──────────────────────────────────────────────────────────────────────────────
// Service chính — quản lý fallback chain giữa các providers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Singleton service quản lý embedding providers với automatic fallback chain.
 *
 * Khởi tạo 1 lần khi `require()` đầu tiên — providers được build từ env vars.
 * Provider nào không có API key tương ứng → không được thêm vào chain.
 *
 * Fallback logic:
 * - Provider hiện tại lỗi (timeout, rate limit 429, server error 500/503) → thử provider tiếp theo
 * - Provider cuối cùng cũng lỗi → throw Error để caller biết và xử lý
 * - Lỗi không phục hồi được (400 Bad Request) → không retry, throw ngay
 *
 * Thứ tự providers (nếu cả JINA_API_KEY lẫn HF_API_KEY đều có):
 * [0] Jina v3, [1] HF e5-large-instruct, [2] HF e5-large (base).
 */
class UnifiedEmbeddingService {
  constructor() {
    this.jinaKey = process.env.JINA_API_KEY;
    this.hfKey = process.env.HF_API_KEY;
    this.providers = this._buildProviders();
    this._logInit();
  }

  _buildProviders() {
    const providers = [];
    if (this.jinaKey) {
      providers.push({
        name: 'Jina v3',
        fn: (text, type) => jinaEmbed(text, type, this.jinaKey),
      });
    }
    if (this.hfKey) {
      providers.push({
        name: 'multilingual-e5-large-instruct',
        fn: (text, type) => hfInstructEmbed(text, type, this.hfKey),
      });
      providers.push({
        name: 'multilingual-e5-large',
        fn: (text, type) => hfBaseEmbed(text, type, this.hfKey),
      });
    }
    return providers;
  }

  _logInit() {
    if (this.providers.length === 0) {
      logger.warn('UnifiedEmbedding: không có provider nào — cần JINA_API_KEY hoặc HF_API_KEY');
      return;
    }
    const primary = this.providers[0].name;
    const fallbacks = this.providers
      .slice(1)
      .map((p) => p.name)
      .join(' → ');
    logger.info(
      `✅ UnifiedEmbedding khởi tạo — primary: [${primary}]${fallbacks ? ` | fallback: ${fallbacks}` : ''}`,
    );
  }

  /**
   * Tên provider ưu tiên cao nhất đã cấu hình. Dùng cho logging bên ngoài.
   * @type {string}
   */
  get activeName() {
    return this.providers[0]?.name ?? 'none';
  }

  /**
   * Kiểm tra có ít nhất 1 provider được cấu hình không.
   * Trả false nếu cả JINA_API_KEY lẫn HF_API_KEY đều không có → generateEmbedding() sẽ throw.
   * @returns {boolean}
   */
  isAvailable() {
    return this.providers.length > 0;
  }

  /**
   * Sinh vector embedding kèm tên provider đã tạo ra nó.
   *
   * Vector của 2 model khác nhau KHÔNG so sánh được bằng cosine (bài học từ eval
   * intent classifier: Jina timeout giữa chừng → query embed bằng e5 trong khi index
   * là vector Jina → score rác). Caller cần biết provider để guard cross-model:
   * vector store chỉ chấm điểm item cùng provider; intent classifier chỉ tin
   * vector cùng provider với examples.
   *
   * @param {string} text - Text cần embedding.
   * @param {string} [type='query'] - 'passage' (indexing) hoặc 'query' (search).
   * @param {Object} [opts]
   * @param {string|null} [opts.pin=null] - Tên provider BẮT BUỘC dùng (không fallback).
   *   Dùng khi caller cần vector nhất quán 1 model (vd: embed bộ examples của classifier).
   * @returns {Promise<{vector: number[], provider: string}>}
   * @throws {Error} Không có provider khả dụng, hoặc tất cả (hoặc provider pin) thất bại.
   */
  async generateEmbeddingWithMeta(text, type = 'query', { pin = null } = {}) {
    const chain = pin ? this.providers.filter((p) => p.name === pin) : this.providers;
    if (chain.length === 0) {
      throw new Error(
        pin
          ? `Provider embedding "${pin}" không được cấu hình`
          : 'Chưa cấu hình provider embedding (JINA_API_KEY hoặc HF_API_KEY)',
      );
    }

    for (let i = 0; i < chain.length; i++) {
      const provider = chain[i];
      try {
        const embeddingVector = await provider.fn(text, type);
        if (!pin && i > 0) {
          // i > 0 nghĩa là đang dùng provider thứ 2 hoặc 3 — primary bị skip
          logger.debug(`UnifiedEmbedding: dùng fallback [${provider.name}]`);
        }
        return { vector: embeddingVector, provider: provider.name };
      } catch (err) {
        const isLastProvider = i === chain.length - 1;
        if (!isLastProvider) {
          logger.warn(
            `UnifiedEmbedding: [${provider.name}] thất bại → thử [${chain[i + 1].name}]: ${err.message}`,
          );
        } else {
          logger.error(`UnifiedEmbedding: tất cả providers thất bại: ${err.message}`);
          throw err;
        }
      }
    }
  }

  /**
   * Sinh vector embedding từ text — thử lần lượt từng provider cho đến khi thành công.
   *
   * Fallback chain: thử từng provider theo thứ tự [0] → [1] → [2].
   * Provider thành công → trả về vector ngay. Provider lỗi (timeout/429/503) → thử tiếp.
   * Provider cuối lỗi → throw Error. Log "dùng fallback" xuất hiện khi skip provider ưu tiên cao hơn.
   *
   * @param {string} text - Text cần embedding (mô tả sản phẩm hoặc câu hỏi của user).
   * @param {string} [type='query'] - Loại embedding:
   *   - `'passage'`: khi indexing sản phẩm vào vector store (text dài, giàu thông tin)
   *   - `'query'`: khi search từ chatbot (câu hỏi ngắn của user)
   * @returns {Promise<number[]>} Vector 1024 chiều (mảng 1024 số thực).
   * @throws {Error} Nếu không có provider nào được cấu hình, hoặc tất cả providers đều thất bại.
   */
  async generateEmbedding(text, type = 'query') {
    return (await this.generateEmbeddingWithMeta(text, type)).vector;
  }
}

module.exports = new UnifiedEmbeddingService();
