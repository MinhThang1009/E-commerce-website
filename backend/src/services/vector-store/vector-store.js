/**
 * @file vectorStore.js
 * @layer Service
 * @module ai
 * @description Business logic layer cho ai
 */
const logger = require('@utils/logger');
const embeddingService = require('@services/embedding/unified-embedding');
const path = require('path');
const fs = require('fs');

// Jina v3 / multilingual-e5-large-instruct / multilingual-e5-large đều cho 1024d
const EXPECTED_DIM = 1024;

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
    // __dirname = backend/src/services/vector-store → 3 levels up = backend/
    this.storagePath = path.join(__dirname, '../../../data/vector-db.json');
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
   * Dùng unified embedding service (Jina v3 → e5-instruct → e5-base), 1024d.
   * @param {Object} product - Plain object sản phẩm (đã qua enrichProductData + toJSON).
   * @throws {Error} Nếu embedding thất bại hoặc sai chiều.
   */
  async upsertProduct(product) {
    try {
      await this.loadPromise;

      const textToEmbed = buildEmbeddingText(product);

      const vector = await embeddingService.generateEmbedding(textToEmbed, 'passage');
      if (!vector || !Array.isArray(vector)) throw new Error('vector không hợp lệ');
      if (vector.length !== EXPECTED_DIM) {
        throw new Error(`vector sai chiều: mong đợi ${EXPECTED_DIM}, nhận được ${vector.length}`);
      }

      this.items = this.items.filter((item) => item.metadata.id !== product.id);

      this.items.push({
        vector,
        text: textToEmbed,
        metadata: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: product.basePrice,
          compareAtPrice: product.compareAtPrice,
          thumbnail: product.thumbnail,
          inStock: product.inStock,
          stockQuantity: product.stockQuantity,
          category: product.categories?.[0]?.name || product.category?.name || 'Sản phẩm',
          baseName: product.baseName,
          shortDescription: product.shortDescription || '',
          createdAt: product.createdAt,
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
    // Guard: magnitude 0 hoặc Infinity/NaN → trả 0 thay vì NaN/Infinity
    if (magnitude === 0 || !isFinite(magnitude)) return 0;
    return dotProduct / magnitude;
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
   * Unified model (Jina v3 / e5-instruct / e5-base) xử lý cả VI lẫn EN.
   * @param {string} query - Query text.
   * @param {number} [limit=5] - Số kết quả tối đa.
   * @param {number} [minScore=0] - Ngưỡng similarity tối thiểu.
   * @returns {Promise<Array<Object>>} Items có score ≥ minScore, sắp xếp giảm dần.
   */
  async _vectorSearch(query, limit, minScore) {
    const queryVector = await embeddingService.generateEmbedding(query, 'query');

    const scores = this.items.map((item) => {
      // Tương thích ngược với vector-db.json cũ (field vectorEn)
      const docVector = item.vector || item.vectorEn;
      return { ...item, score: this.cosineSimilarity(queryVector, docVector) };
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
