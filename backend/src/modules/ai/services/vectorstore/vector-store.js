/**
 * @file vectorStore.js
 * @layer Service
 * @module ai
 * @description Business logic layer cho ai
 */
const logger = require('@utils/logger');
const embeddingService = require('@modules/ai/services/embedding/embedding');
const viEmbeddingService = require('@modules/ai/services/embedding/vi-embedding');
const path = require('path');
const fs = require('fs');

// Số chiều chuẩn của từng model embedding
const EXPECTED_DIM_EN = 1536; // text-embedding-3-small (OpenRouter), không truyền dimensions param → default 1536
const EXPECTED_DIM_VI = 1024; // multilingual-e5-large (HuggingFace)

const { detectLanguage } = require('@modules/ai/services/chatbot/language/language-detector');

/**
 * [Indexing — Text Enrichment] Tạo chuỗi text phong phú từ product data để embedding.
 * Gộp tên, thương hiệu, danh mục, mô tả, giá, tình trạng hàng thành 1 đoạn text ≤1500 ký tự.
 * @param {Object} product - Plain object sản phẩm (đã qua enrichProductData + toJSON).
 * @returns {string} Text dùng cho cả EN và VI embedding model.
 */
function buildEmbeddingText(product) {
  const parts = [
    product.name,
    product.baseName ? `Thương hiệu: ${product.baseName}` : '',
    product.categories?.[0]?.name ? `Danh mục: ${product.categories[0].name}` : '',
    product.shortDescription || '',
    // Strip HTML tags từ description để không embed HTML markup
    product.description ? product.description.replace(/<[^>]*>/g, '').substring(0, 500) : '',
    product.basePrice ? `Giá: ${product.basePrice.toLocaleString('vi-VN')} đồng` : '',
    // Stock thực nằm ở variant level — dùng inStock đã compute hoặc tính từ variants
    (product.inStock !== undefined ? product.inStock : product.stockQuantity > 0)
      ? 'Còn hàng'
      : 'Hết hàng',
  ];
  return parts.filter(Boolean).join('. ').substring(0, 1500);
}

class HybridVectorStore {
  constructor() {
    this.storagePath = path.join(__dirname, '../../../../data/vector-db.json');
    this.items = [];
    // Fire-and-forget khi khởi động — server không block chờ load xong
    this.loadPromise = this.load();
  }

  async load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const content = await fs.promises.readFile(this.storagePath, 'utf8');
        if (content && content.trim()) {
          this.items = JSON.parse(content);
          logger.debug(`Đã tải ${this.items.length} vector từ ổ đĩa`);
        }
      }
    } catch (e) {
      logger.error('Lỗi khi tải vector db:', e);
      this.items = [];
    }
  }

  // Phải await khi gọi — đảm bảo file ghi xong trước khi process tiếp theo đọc
  async save() {
    try {
      const dataDir = path.dirname(this.storagePath);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

      logger.debug(`💾 Đang lưu ${this.items.length} mục vào ${this.storagePath}...`);
      await fs.promises.writeFile(this.storagePath, JSON.stringify(this.items, null, 2));
      logger.debug('Lưu file thành công');
    } catch (e) {
      logger.error('Lỗi khi lưu vector store:', e);
    }
  }

  clear() {
    this.items = [];
    logger.debug('🗑️ Đã xóa toàn bộ vector store');
  }

  /**
   * [Indexing — Upsert] Thêm hoặc cập nhật 1 sản phẩm vào vector store.
   * Tạo dual embedding (EN bắt buộc, VI tùy chọn), xóa bản cũ nếu trùng id, lưu metadata cho frontend.
   * @param {Object} product - Plain object sản phẩm (đã qua enrichProductData + toJSON).
   * @throws {Error} Nếu embedding EN thất bại hoặc sai chiều.
   */
  async upsertProduct(product) {
    try {
      // Đảm bảo load đã xong trước khi thêm (tránh race condition khi server mới start)
      await this.loadPromise;

      // Tạo text embedding phong phú hơn thay vì chỉ name + shortDescription
      const textToEmbed = buildEmbeddingText(product);

      // Vector tiếng Anh (bắt buộc) — kiểm tra kích thước chiều
      const vectorEn = await embeddingService.generateEmbedding(textToEmbed);
      if (!vectorEn || !Array.isArray(vectorEn)) throw new Error('vectorEn không hợp lệ');
      if (vectorEn.length !== EXPECTED_DIM_EN) {
        throw new Error(
          `vectorEn sai chiều: mong đợi ${EXPECTED_DIM_EN}, nhận được ${vectorEn.length}`,
        );
      }

      // Vector tiếng Việt (tùy chọn — skip nếu HF chưa cấu hình)
      let vectorVi = null;
      if (viEmbeddingService.isAvailable()) {
        try {
          vectorVi = await viEmbeddingService.generateEmbedding(textToEmbed, 'passage');
          if (vectorVi && vectorVi.length !== EXPECTED_DIM_VI) {
            logger.warn(
              `vectorVi sai chiều cho "${product.name}": ${vectorVi.length} (mong đợi ${EXPECTED_DIM_VI})`,
            );
            vectorVi = null;
          }
        } catch (err) {
          logger.warn(`Không thể tạo Vietnamese vector cho "${product.name}": ${err.message}`);
        }
      }

      // Xóa bản ghi cũ của sản phẩm này nếu đã tồn tại
      this.items = this.items.filter((item) => item.metadata.id !== product.id);

      this.items.push({
        vectorEn,
        vectorVi,
        text: textToEmbed,
        metadata: {
          id: product.id,
          name: product.name,
          slug: product.slug, // Cần cho link sản phẩm trong chatbot card
          price: product.basePrice,
          compareAtPrice: product.compareAtPrice,
          thumbnail: product.thumbnail,
          inStock: product.inStock,
          stockQuantity: product.stockQuantity,
          category: product.categories?.[0]?.name || product.category?.name || 'Sản phẩm',
          baseName: product.baseName,
          shortDescription: product.shortDescription || '', // createPrompt() dùng p.shortDescription
          createdAt: product.createdAt, // simpleKeywordMatch "hàng mới" sort theo ngày
        },
      });
    } catch (error) {
      logger.error(`Lỗi khi thêm sản phẩm ${product.id} vào vector store:`, error.message);
      throw error;
    }
  }

  cosineSimilarity(v1, v2) {
    if (!v1 || !v2 || v1.length !== v2.length) return 0;
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      mag1 += v1[i] * v1[i];
      mag2 += v2[i] * v2[i];
    }
    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    // Guard: magnitude 0 hoặc Infinity → trả 0 thay vì NaN
    if (magnitude === 0 || !isFinite(magnitude)) return 0;
    const similarity = dotProduct / magnitude;
    // Guard: kết quả NaN/Infinity (embedding API trả NaN) → trả 0
    /* istanbul ignore next */
    return isFinite(similarity) ? similarity : 0;
  }

  _tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  /**
   * [Retrieval — Keyword] BM25-inspired keyword search — bắt exact match mà vector embedding có thể miss.
   * Tokenize query + item text bằng Unicode-aware regex, tính score (name ×3, text ×1) × coverage ratio.
   * @param {string} query - Query text đã normalize.
   * @param {number} [limit=5] - Số kết quả tối đa.
   * @returns {Array<Object>} Items có keywordScore > 0, sắp xếp giảm dần.
   */
  _keywordSearch(query, limit = 5) {
    const queryTokens = [...new Set(this._tokenize(query))];
    if (queryTokens.length === 0) return [];

    const results = [];
    for (const item of this.items) {
      const nameTokens = new Set(this._tokenize(item.metadata.name || ''));
      const textTokens = new Set(this._tokenize(item.text || ''));
      let score = 0;
      let matched = 0;

      for (const token of queryTokens) {
        const inName = nameTokens.has(token);
        const inText = textTokens.has(token);
        if (inName || inText) {
          matched++;
          score += (inName ? 3 : 0) + (inText ? 1 : 0);
        }
      }

      if (matched > 0) {
        score *= matched / queryTokens.length;
        results.push({ ...item, keywordScore: score });
      }
    }

    return results.sort((a, b) => b.keywordScore - a.keywordScore).slice(0, limit);
  }

  /**
   * [Retrieval — Semantic] Vector-only cosine similarity search.
   * Chọn embedding model theo ngôn ngữ query (VI → VI model nếu có, fallback EN).
   * @param {string} query - Query text.
   * @param {number} [limit=5] - Số kết quả tối đa.
   * @param {number} [minScore=0] - Ngưỡng similarity tối thiểu.
   * @returns {Promise<Array<Object>>} Items có score ≥ minScore, sắp xếp giảm dần.
   */
  async _vectorSearch(query, limit = 5, minScore = 0) {
    const lang = detectLanguage(query);
    const useViModel =
      lang === 'vi' && viEmbeddingService.isAvailable() && this.items.some((item) => item.vectorVi);

    if (lang === 'vi' && !useViModel) {
      logger.warn(
        `[BILINGUAL] VI query nhưng VI model không khả dụng — fallback sang EN embedding (accuracy giảm)`,
      );
    }
    logger.debug(`[SEARCH] lang=${lang}, useViModel=${useViModel}`);

    let queryVectorVi = null;
    let queryVectorEn = null;

    if (useViModel) {
      queryVectorVi = await viEmbeddingService.generateEmbedding(query);
      queryVectorEn = await embeddingService.generateEmbedding(query);
    } else {
      queryVectorEn = await embeddingService.generateEmbedding(query);
    }

    const scores = this.items.map((item) => {
      let docVector = useViModel ? item.vectorVi : item.vectorEn;
      let qVector = useViModel ? queryVectorVi : queryVectorEn;

      if (!docVector || (qVector && docVector.length !== qVector.length)) {
        docVector = item.vectorEn || item.vector;
        qVector = queryVectorEn;
      }

      return { ...item, score: this.cosineSimilarity(qVector, docVector) };
    });

    return scores
      .filter((item) => isFinite(item.score) && item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * [Retrieval — Fusion] Hybrid search: kết hợp semantic (cosine) + keyword (BM25-inspired).
   * Chạy song song _vectorSearch + _keywordSearch, boost overlap (+0.05), inject keyword-only results.
   * @param {string} query - Query text đã normalize.
   * @param {number} [limit=5] - Số kết quả tối đa trả về.
   * @param {number} [minScore=0.45] - Ngưỡng similarity tối thiểu cho vector search.
   * @returns {Promise<Array<Object>>} Kết quả merged, sắp xếp theo score giảm dần.
   */
  async hybridSearch(query, limit = 5, minScore = 0.45) {
    try {
      await this.loadPromise;

      const [vectorResults, keywordResults] = await Promise.all([
        this._vectorSearch(query, limit * 2, minScore),
        Promise.resolve(this._keywordSearch(query, limit * 2)),
      ]);

      if (vectorResults.length === 0 && keywordResults.length === 0) return [];

      const vectorIds = new Set(vectorResults.map((r) => r.metadata.id));
      const keywordIds = new Set(keywordResults.map((r) => r.metadata.id));

      // Boost vector results cũng khớp keyword
      vectorResults.forEach((r) => {
        if (keywordIds.has(r.metadata.id)) {
          r.score = Math.min(1, r.score + 0.05);
        }
      });

      // Inject keyword-only results (vector missed) — score dựa trên keyword quality
      const maxKw = keywordResults.reduce((m, r) => Math.max(m, r.keywordScore), 1);
      const injected = keywordResults
        .filter((r) => !vectorIds.has(r.metadata.id))
        .map((r) => ({
          ...r,
          score: minScore + (r.keywordScore / maxKw) * 0.15,
          lowConfidence: true,
        }));

      if (injected.length > 0) {
        logger.debug(`[HYBRID] Injected ${injected.length} keyword-only results`);
      }

      return [...vectorResults, ...injected].sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      logger.error('Lỗi tìm kiếm vector:', error.message);
      return [];
    }
  }
}

const vectorStoreInstance = new HybridVectorStore();
module.exports = vectorStoreInstance;
// Re-export backward compat — callers import từ vectorStore, dần chuyển sang file gốc
module.exports.enrichProductData = require('@modules/ai/services/product/product-enricher').enrichProductData;
module.exports.detectLanguage = detectLanguage;
