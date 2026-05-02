const embeddingService = require('./embedding');
const viEmbeddingService = require('./viEmbedding');
const path = require('path');
const fs = require('fs');

function detectLanguage(text) {
  return /[àáâãèéêìíòóôõùúýăđơưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯ]/.test(text) ? 'vi' : 'en';
}

class SimpleVectorStore {
  constructor() {
    this.storagePath = path.join(__dirname, '../../data/vectorDb.json');
    this.items = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const content = fs.readFileSync(this.storagePath, 'utf8');
        if (content && content.trim()) {
           this.items = JSON.parse(content);
           console.log(`✅ Đã tải ${this.items.length} vector từ ổ đĩa`);
        }
      }
    } catch (e) {
      console.error('Lỗi khi tải vector db:', e);
      this.items = [];
    }
  }

  save() {
    try {
      const dataDir = path.dirname(this.storagePath);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

      console.log(`💾 Đang lưu ${this.items.length} mục vào ${this.storagePath}...`);
      fs.writeFileSync(this.storagePath, JSON.stringify(this.items, null, 2));
      console.log('✅ Lưu file thành công');
    } catch (e) {
      console.error('❌ Lỗi khi lưu vector store:', e);
    }
  }

  clear() {
    this.items = [];
    console.log('🗑️ Đã xóa toàn bộ vector store');
  }

  async addProduct(product) {
    try {
      const textToEmbed = `${product.name}. ${product.shortDescription || ''}`.substring(0, 500);

      // Vector tiếng Anh (bắt buộc)
      const vectorEn = await embeddingService.generateEmbedding(textToEmbed);
      if (!vectorEn || !Array.isArray(vectorEn)) throw new Error('vectorEn không hợp lệ');

      // Vector tiếng Việt (tùy chọn — skip nếu HF chưa cấu hình)
      let vectorVi = null;
      if (viEmbeddingService.isAvailable()) {
        try {
          vectorVi = await viEmbeddingService.generateEmbedding(textToEmbed);
        } catch (err) {
          console.warn(`⚠️ Không thể tạo Vietnamese vector cho "${product.name}": ${err.message}`);
        }
      }

      // Xóa bản ghi cũ của sản phẩm này nếu đã tồn tại
      this.items = this.items.filter(item => item.metadata.id !== product.id);

      this.items.push({
        vectorEn,
        vectorVi,
        text: textToEmbed,
        metadata: {
          id: product.id,
          name: product.name,
          price: product.basePrice,
          compareAtPrice: product.compareAtPrice,
          thumbnail: product.thumbnail,
          inStock: product.inStock,
          stockQuantity: product.stockQuantity,
          category: product.categories?.[0]?.name || 'Sản phẩm',
          baseName: product.baseName,
        },
      });
    } catch (error) {
      console.error(`Lỗi khi thêm sản phẩm ${product.id} vào vector store:`, error.message);
      throw error;
    }
  }

  /**
   * Tính độ tương đồng cosine giữa hai vector
   */
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
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  async search(query, limit = 5) {
    try {
      const lang = detectLanguage(query);
      const useViModel = lang === 'vi'
        && viEmbeddingService.isAvailable()
        && this.items.some(item => item.vectorVi);

      let queryVector;
      if (useViModel) {
        queryVector = await viEmbeddingService.generateEmbedding(query);
      } else {
        queryVector = await embeddingService.generateEmbedding(query);
      }

      console.log(`[SEARCH] lang=${lang}, useViModel=${useViModel}`);

      const scores = this.items.map(item => {
        // Fallback: item.vector là field cũ trước khi re-index dual-vector
        const docVector = useViModel
          ? (item.vectorVi || item.vectorEn || item.vector)
          : (item.vectorEn || item.vector);
        return { ...item, score: this.cosineSimilarity(queryVector, docVector) };
      });

      return scores
        .filter(item => isFinite(item.score) && item.score >= 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Lỗi tìm kiếm vector:', error.message);
      return [];
    }
  }
}

module.exports = new SimpleVectorStore();
