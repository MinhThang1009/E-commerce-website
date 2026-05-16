const logger = require('../../utils/logger');
const embeddingService = require('./embedding');
const viEmbeddingService = require('./viEmbedding');
const path = require('path');
const fs = require('fs');

// Số chiều chuẩn của từng model embedding
const EXPECTED_DIM_EN = 1536; // text-embedding-3-small (OpenRouter), không truyền dimensions param → default 1536
const EXPECTED_DIM_VI = 1024; // multilingual-e5-large (HuggingFace)

// Phát hiện ngôn ngữ bằng ký tự đặc trưng tiếng Việt
function detectLanguage(text) {
  return /[àáâãèéêìíòóôõùúýăđơưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯ]/.test(text) ? 'vi' : 'en';
}

// Tạo text đầy đủ để embed — bao gồm tên, thương hiệu, danh mục, mô tả, giá, tình trạng hàng
// Text phong phú giúp vector search tìm đúng sản phẩm hơn so với chỉ dùng tên
function generateProductText(product) {
  const parts = [
    product.name,
    product.baseName ? `Thương hiệu: ${product.baseName}` : '',
    product.categories?.[0]?.name ? `Danh mục: ${product.categories[0].name}` : '',
    product.shortDescription || '',
    // Strip HTML tags từ description để không embed HTML markup
    product.description ? product.description.replace(/<[^>]*>/g, '').substring(0, 500) : '',
    product.basePrice ? `Giá: ${product.basePrice.toLocaleString('vi-VN')} đồng` : '',
    // Stock thực nằm ở variant level — dùng inStock đã compute hoặc tính từ variants
    (product.inStock !== undefined ? product.inStock : product.stockQuantity > 0) ? 'Còn hàng' : 'Hết hàng',
  ];
  return parts.filter(Boolean).join('. ').substring(0, 1500);
}

class SimpleVectorStore {
  constructor() {
    this.storagePath = path.join(__dirname, '../../../data/vectorDb.json');
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
          logger.debug(`✅ Đã tải ${this.items.length} vector từ ổ đĩa`);
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
      logger.debug('✅ Lưu file thành công');
    } catch (e) {
      logger.error('❌ Lỗi khi lưu vector store:', e);
    }
  }

  clear() {
    this.items = [];
    logger.debug('🗑️ Đã xóa toàn bộ vector store');
  }

  // Thêm hoặc cập nhật sản phẩm vào vector store
  async addProduct(product) {
    try {
      // Đảm bảo load đã xong trước khi thêm (tránh race condition khi server mới start)
      await this.loadPromise;

      // Tạo text embedding phong phú hơn thay vì chỉ name + shortDescription
      const textToEmbed = generateProductText(product);

      // Vector tiếng Anh (bắt buộc) — kiểm tra kích thước chiều
      const vectorEn = await embeddingService.generateEmbedding(textToEmbed);
      if (!vectorEn || !Array.isArray(vectorEn)) throw new Error('vectorEn không hợp lệ');
      if (vectorEn.length !== EXPECTED_DIM_EN) {
        throw new Error(`vectorEn sai chiều: mong đợi ${EXPECTED_DIM_EN}, nhận được ${vectorEn.length}`);
      }

      // Vector tiếng Việt (tùy chọn — skip nếu HF chưa cấu hình)
      let vectorVi = null;
      if (viEmbeddingService.isAvailable()) {
        try {
          vectorVi = await viEmbeddingService.generateEmbedding(textToEmbed);
          if (vectorVi && vectorVi.length !== EXPECTED_DIM_VI) {
            logger.warn(`⚠️ vectorVi sai chiều cho "${product.name}": ${vectorVi.length} (mong đợi ${EXPECTED_DIM_VI})`);
            vectorVi = null;
          }
        } catch (err) {
          logger.warn(`⚠️ Không thể tạo Vietnamese vector cho "${product.name}": ${err.message}`);
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
          slug: product.slug,                               // Cần cho link sản phẩm trong chatbot card
          price: product.basePrice,
          compareAtPrice: product.compareAtPrice,
          thumbnail: product.thumbnail,
          inStock: product.inStock,
          stockQuantity: product.stockQuantity,
          category: product.categories?.[0]?.name || product.category?.name || 'Sản phẩm',
          baseName: product.baseName,
          shortDescription: product.shortDescription || '', // createPrompt() dùng p.shortDescription
          createdAt: product.createdAt,                     // simpleKeywordMatch "hàng mới" sort theo ngày
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
    return isFinite(similarity) ? similarity : 0;
  }

  async search(query, limit = 5) {
    try {
      // Đảm bảo load đã xong
      await this.loadPromise;

      const lang = detectLanguage(query);
      const useViModel = lang === 'vi'
        && viEmbeddingService.isAvailable()
        && this.items.some(item => item.vectorVi);

      logger.debug(`[SEARCH] lang=${lang}, useViModel=${useViModel}`);

      // Chuẩn bị cả 2 query vectors khi dùng VI model để fallback đúng pair
      // cho sản phẩm không có vectorVi (indexed khi HF API fail)
      let queryVectorVi = null;
      let queryVectorEn = null;

      if (useViModel) {
        queryVectorVi = await viEmbeddingService.generateEmbedding(query);
        // Tạo thêm EN vector để fallback cho sản phẩm không có vectorVi
        queryVectorEn = await embeddingService.generateEmbedding(query);
      } else {
        queryVectorEn = await embeddingService.generateEmbedding(query);
      }

      const scores = this.items.map(item => {
        // Chọn cặp (docVector, queryVector) đúng chiều — tránh dim mismatch silent failure
        let docVector = useViModel ? item.vectorVi : item.vectorEn;
        let qVector = useViModel ? queryVectorVi : queryVectorEn;

        // Fallback: nếu item thiếu vectorVi (indexed khi HF API fail) → dùng EN pair
        if (!docVector || (qVector && docVector.length !== qVector.length)) {
          docVector = item.vectorEn || item.vector; // item.vector = field cũ trước khi re-index
          qVector = queryVectorEn;
        }

        return { ...item, score: this.cosineSimilarity(qVector, docVector) };
      });

      return scores
        .filter(item => isFinite(item.score) && item.score >= 0.45)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      logger.error('Lỗi tìm kiếm vector:', error.message);
      return [];
    }
  }
}

// Compute thumbnail + inStock từ product associations — dùng chung cho indexProducts, model hooks, chatbot fallback
function enrichProductData(productData) {
  const thumbImg = productData.productImages?.find(img => img.isThumbnail);
  productData.thumbnail = thumbImg?.imageUrl || productData.productImages?.[0]?.imageUrl || null;
  const variantStock = (productData.variants || []).reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
  productData.inStock = variantStock > 0 || productData.stockQuantity > 0;
  return productData;
}

const vectorStoreInstance = new SimpleVectorStore();
module.exports = vectorStoreInstance;
module.exports.enrichProductData = enrichProductData;

