/**
 * @file vector-store.js
 * @layer Service (shared)
 * @description Kho lưu trữ vector sản phẩm + hybrid search engine cho chatbot.
 *
 * Hybrid search kết hợp 2 phương pháp tìm kiếm:
 *   1. Semantic search (cosine similarity) — hiểu ý nghĩa ngữ nghĩa
 *      Ví dụ: "điện thoại Apple" tìm được "iPhone 15 Pro" dù không chứa từ "iPhone"
 *   2. Keyword search (BM25-inspired) — bắt exact match tên/brand
 *      Ví dụ: "iPhone 15" bắt chính xác sản phẩm có "iPhone 15" trong tên
 *
 * Dữ liệu lưu trong mảng JavaScript + persist xuống file JSON (data/vector-db.json).
 * Mỗi item gồm: vector 1024 chiều + text gốc + metadata sản phẩm (tên, giá, stock...).
 */
const logger = require('@utils/logger');
const embeddingService = require('@services/embedding/unified-embedding');
const path = require('path');
const fs = require('fs');

/** Số chiều vector của tất cả providers (Jina v3 / e5-instruct / e5-base đều cho 1024d). */
const EXPECTED_DIM = 1024;

/**
 * Độ dài tối đa (ký tự) của embedding text — cắt bớt để embedding model xử lý hiệu quả.
 * 1500 ký tự đủ chứa tên + brand + category + mô tả ngắn mà không vượt token limit của model.
 */
const MAX_EMBEDDING_TEXT_LENGTH = 1500;

/**
 * Ngưỡng cosine similarity tối thiểu mặc định cho hybrid search.
 * Sản phẩm có score < 0.45 → coi như không liên quan, bị lọc khỏi kết quả.
 * Giá trị này được chọn qua thử nghiệm trên tập sản phẩm công nghệ tiếng Việt:
 *   - Quá cao (≥0.6): bỏ sót nhiều kết quả hợp lệ (ví dụ "điện thoại Apple" không ra "iPhone")
 *   - Quá thấp (≤0.3): trả về quá nhiều sản phẩm không liên quan
 */
const DEFAULT_MIN_SCORE = 0.45;

/**
 * Điểm cộng thêm khi sản phẩm khớp CẢ semantic (vector) LẪN keyword.
 * Sản phẩm xuất hiện ở cả 2 phương pháp → khả năng liên quan cao hơn → boost score.
 * Giữ nhỏ (0.05) để không lấn át semantic score gốc.
 */
const OVERLAP_BOOST = 0.05;

/**
 * Hệ số tối đa cho điểm keyword-only khi inject vào kết quả hybrid.
 * Sản phẩm chỉ match keyword (không match semantic) → score tối đa = DEFAULT_MIN_SCORE + 0.15 = 0.60.
 * Giữ thấp (0.15) vì keyword-only không có xác nhận ngữ nghĩa → kém chắc chắn hơn.
 */
const KEYWORD_INJECTION_MAX_BOOST = 0.15;

/**
 * Trọng số khi từ khóa khớp trong TÊN sản phẩm.
 * Cao hơn KEYWORD_TEXT_WEIGHT vì tên là trường định danh quan trọng nhất —
 * "iPhone 15" trong tên chính xác hơn "iPhone 15" trong đoạn mô tả kỹ thuật.
 */
const KEYWORD_NAME_WEIGHT = 3;

/**
 * Trọng số khi từ khóa khớp trong TEXT mô tả (brand, category, description...).
 * Thấp hơn tên vì mô tả ít đặc trưng cho sản phẩm cụ thể hơn.
 */
const KEYWORD_TEXT_WEIGHT = 1;

/**
 * Singleton hybrid search engine — kết hợp semantic (cosine) + keyword (BM25) search.
 *
 * Vòng đời:
 * 1. Constructor → load file JSON từ disk (async, fire-and-forget)
 * 2. Product model hooks gọi upsertProduct() mỗi khi tạo/sửa sản phẩm
 * 3. ChatbotService gọi hybridSearch() khi user gửi tin nhắn chatbot
 * 4. save() ghi lại file JSON sau mỗi upsert
 */
class HybridVectorStore {
  /**
   * [Indexing — Text Enrichment] Tạo chuỗi text phong phú từ product data để embedding.
   * Gộp tên, thương hiệu, danh mục, mô tả, giá, tình trạng hàng thành 1 đoạn text ≤1500 ký tự.
   * @param {Object} product - Plain object sản phẩm (đã qua enrichProductData + toJSON).
   * @returns {string} Text dùng cho cả EN và VI embedding model.
   */
  static buildEmbeddingText(product, specKeyMap = {}) {
    const localizeKey = (k) => specKeyMap[k] || k.replace(/_/g, ' ');
    // Tổng hợp tên phiên bản, màu sắc, cấu hình từ variants
    const variantsPart = (() => {
      const variants = product.variants || [];
      if (!variants.length) return '';
      const names = [...new Set(variants.map(v => v.variantName || v.displayName).filter(Boolean))];
      const colors = [...new Set(variants.flatMap(v => {
        const a = v.attributes || {};
        return [a.color, a['Màu sắc']].filter(Boolean);
      }))];
      const storages = [...new Set(variants.flatMap(v => {
        const a = v.attributes || {};
        return [a.storage, a['Dung lượng'], a['RAM']].filter(Boolean);
      }))];
      const parts2 = [];
      if (names.length) parts2.push('Phiên bản: ' + names.slice(0, 6).join(', '));
      if (colors.length) parts2.push('Màu: ' + colors.join(', '));
      if (storages.length) parts2.push('Cấu hình: ' + storages.join(', '));
      return parts2.join('. ');
    })();

    const parts = [
      product.name,
      product.nameEn && product.nameEn !== product.name ? product.nameEn : '',
      product.model ? `Model: ${product.model}` : '',
      product.baseName ? `Thương hiệu: ${product.baseName}` : '',
      product.categories?.[0]?.name ? `Danh mục: ${product.categories[0].name}` : '',
      product.shortDescription || '',
      product.shortDescriptionEn || '',
      // Strip HTML tags từ description để không embed HTML markup
      product.description ? product.description.replace(/<[^>]*>/g, '').substring(0, 500) : '',
      product.descriptionEn ? product.descriptionEn.replace(/<[^>]*>/g, '').substring(0, 300) : '',
      // Thông số kỹ thuật từ JSON column products.specifications (pin, màn hình, RAM, chip...)
      product.specifications && typeof product.specifications === 'object' && Object.keys(product.specifications).length > 0
        ? 'Thông số: ' + Object.entries(product.specifications).map(([k, v]) => `${localizeKey(k)}: ${v}`).join(', ')
        : '',
      // Thông số từ bảng product_specifications (nếu có)
      product.productSpecifications?.length
        ? product.productSpecifications
            .map(s => `${s.name} ${s.value}${s.valueEn && s.valueEn !== s.value ? ' ' + s.valueEn : ''}`)
            .join(', ')
        : '',
      variantsPart,
      product.tags?.length ? 'Tags: ' + (Array.isArray(product.tags) ? product.tags.join(', ') : product.tags) : '',
      product.basePrice ? `Giá: ${product.basePrice.toLocaleString('vi-VN')} đồng` : '',
      // Stock thực nằm ở variant level — dùng inStock đã compute hoặc tính từ variants
      (product.inStock !== undefined ? product.inStock : product.stockQuantity > 0)
        ? 'Còn hàng'
        : 'Hết hàng',
    ];
    return parts.filter(Boolean).join('. ').substring(0, MAX_EMBEDDING_TEXT_LENGTH);
  }

  /** Map spec key EN→VI — set bởi index-products.js, persist ra file để server load lại. */
  setSpecKeyMap(map) {
    this._specKeyMap = map || {};
    // Persist để server đang chạy (hooks) dùng được khi tạo/sửa sản phẩm mới
    try {
      fs.writeFileSync(this._specKeyMapPath, JSON.stringify(this._specKeyMap, null, 2), 'utf8');
    } catch { /* bỏ qua nếu lỗi ghi file */ }
  }

  /** Trả tên spec bằng tiếng Việt nếu có map, fallback snake→space. */
  _localizeSpecKey(key) {
    return this._specKeyMap?.[key] || key.replace(/_/g, ' ');
  }

  constructor() {
    // __dirname = backend/src/services/vector-store → 3 levels up = backend/
    this.storagePath    = path.join(__dirname, '../../../data/vector-db.json');
    this._specKeyMapPath = path.join(__dirname, '../../../data/spec-key-map.json');
    this.items = [];
    // Load spec key map từ file persist (nếu có) để hooks dùng ngay khi server start
    try {
      this._specKeyMap = fs.existsSync(this._specKeyMapPath)
        ? JSON.parse(fs.readFileSync(this._specKeyMapPath, 'utf8'))
        : {};
    } catch { this._specKeyMap = {}; }
    // Fire-and-forget khi khởi động — server không block chờ load xong
    this.loadPromise = this.load();
  }

  /**
   * Tải dữ liệu vector store từ file JSON trên ổ đĩa vào bộ nhớ.
   * Được gọi tự động trong constructor (fire-and-forget) — server không block chờ load xong.
   * Nếu file không tồn tại hoặc lỗi JSON: khởi động với danh sách rỗng, không crash server.
   */
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

  /**
   * Lưu toàn bộ vector store hiện tại xuống file JSON.
   * Phải await khi gọi — đảm bảo file ghi xong trước khi process tiếp theo đọc lại.
   * Lỗi ghi file: chỉ log warning, không throw để tránh làm hỏng request đang xử lý.
   */
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

  /**
   * Xóa toàn bộ vectors khỏi bộ nhớ (không xóa file trên ổ đĩa).
   * Dùng trong test để reset trạng thái giữa các test cases.
   */
  clear() {
    this.items = [];
    logger.debug('🗑️ Đã xóa toàn bộ vector store');
  }

  /**
   * [Indexing — Upsert] Thêm hoặc cập nhật 1 sản phẩm vào vector store (bộ nhớ).
   *
   * Sau khi gọi hàm này, vector mới chỉ tồn tại trong `this.items` (RAM).
   * Để lưu xuống file JSON (data/vector-db.json) và không mất khi server restart,
   * caller phải gọi `await this.save()` sau đó.
   *
   * Trong thực tế, Product model hooks (afterCreate/afterUpdate) gọi hàm này và
   * sau đó tự gọi `save()` — nên từ phía ngoài không cần lo việc này.
   * Chỉ cần chú ý khi gọi `upsertProduct` trực tiếp trong script hoặc test.
   *
   * @param {Object} product - Plain object sản phẩm (đã qua enrichProductData + toJSON).
   * @throws {Error} Nếu embedding thất bại hoặc vector trả về sai số chiều (không phải 1024d).
   */
  async upsertProduct(product) {
    try {
      await this.loadPromise;

      const textToEmbed = HybridVectorStore.buildEmbeddingText(product, this._specKeyMap);

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
          nameEn: product.nameEn || '',
          slug: product.slug,
          model: product.model || '',
          price: product.basePrice != null ? Number(product.basePrice) : null,
          compareAtPrice: product.compareAtPrice != null ? Number(product.compareAtPrice) : null,
          thumbnail: product.thumbnail,
          inStock: product.inStock,
          stockQuantity: product.stockQuantity,
          category: product.categories?.[0]?.name || product.category?.name || 'Sản phẩm',
          baseName: product.baseName,
          shortDescription: product.shortDescription || '',
          shortDescriptionEn: product.shortDescriptionEn || '',
          description: product.description
            ? product.description.replace(/<[^>]*>/g, '').substring(0, 800)
            : '',
          ratingAverage: product.ratingAverage != null ? Number(product.ratingAverage) : null,
          // Kết hợp specs từ JSON column + bảng product_specifications
          specifications: [
            ...(product.specifications && typeof product.specifications === 'object'
              ? Object.entries(product.specifications).map(([k, v]) => `${this._localizeSpecKey(k)}: ${v}`)
              : []),
            ...(product.productSpecifications || []).map(
              s => `${s.name}: ${s.value}${s.valueEn && s.valueEn !== s.value ? ' (' + s.valueEn + ')' : ''}`,
            ),
          ].join(' | '),
          // Biến thể: màu sắc, cấu hình, giá từng phiên bản
          variants: (product.variants || []).map(v => ({
            variantName: v.variantName || '',
            displayName: v.displayName || '',
            price: v.price != null ? Number(v.price) : null,
            compareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
            stockQuantity: v.stockQuantity || 0,
            isDefault: v.isDefault || false,
            attributes: v.attributes || {},
          })),
          tags: Array.isArray(product.tags) ? product.tags : [],
          createdAt: product.createdAt,
        },
      });
    } catch (error) {
      logger.error(`Lỗi khi thêm sản phẩm ${product.id} vào vector store:`, error.message);
      throw error;
    }
  }

  /**
   * Tính cosine similarity giữa 2 vector — đo độ tương đồng ngữ nghĩa.
   *
   * **Cosine similarity là gì?**
   * Đo góc giữa 2 vector trong không gian nhiều chiều (ở đây 1024 chiều).
   * Hai vector cùng hướng (cùng ý nghĩa) → cos = 1; vuông góc (không liên quan) → cos = 0.
   *
   * **Công thức toán học:**
   * ```
   *   cos(θ) = (A·B) / (|A| × |B|)
   *
   *   Trong đó:
   *   - A·B (dot product) = Σ(a_i × b_i) — tích vô hướng, đo mức "đồng hướng"
   *   - |A| (magnitude)   = √Σ(a_i²)     — độ dài vector A
   *   - |B| (magnitude)   = √Σ(b_i²)     — độ dài vector B
   * ```
   *
   * Chia cho tích magnitude giúp normalize: vector dài hay ngắn không ảnh hưởng kết quả,
   * chỉ hướng (ý nghĩa ngữ nghĩa) mới quan trọng.
   *
   * **Tại sao loop qua 1024 chiều?**
   * Mỗi embedding model đặt "ý nghĩa" vào 1024 con số — mỗi chiều đại diện cho 1 khía cạnh
   * ngữ nghĩa trừu tượng (không đặt tên được). Để so sánh 2 vector phải tính trên toàn bộ
   * 1024 chiều — không thể bỏ bớt mà không mất thông tin.
   *
   * **Phạm vi kết quả (thực tế với embedding vectors):**
   * - ≥ 0.70: rất liên quan
   * - ≥ 0.45: có liên quan (ngưỡng mặc định DEFAULT_MIN_SCORE)
   * - < 0.30: không liên quan
   *
   * **Tại sao trả 0 khi magnitude = 0?**
   * Magnitude = 0 → vector toàn số 0 (zero vector) → không mang thông tin ngữ nghĩa.
   * Chia cho 0 → Infinity/NaN → trả 0 là giá trị an toàn nhất (không liên quan).
   *
   * @param {number[]} v1 - Vector thứ nhất (1024 chiều).
   * @param {number[]} v2 - Vector thứ hai (1024 chiều).
   * @returns {number} Cosine similarity (0-1), trả 0 nếu input không hợp lệ hoặc zero vector.
   */
  cosineSimilarity(v1, v2) {
    // Bước 1: Kiểm tra input — 2 vector phải tồn tại và cùng số chiều
    if (!v1 || !v2 || v1.length !== v2.length) return 0;

    // Bước 2: Duyệt 1 lần qua tất cả 1024 chiều, tính đồng thời 3 giá trị:
    //   - dotProduct: tích vô hướng A·B (tử số trong công thức)
    //   - mag1, mag2: bình phương magnitude |A|², |B|² (sẽ sqrt ở bước 3)
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      mag1 += v1[i] * v1[i];
      mag2 += v2[i] * v2[i];
    }

    // Bước 3: Tính mẫu số = |A| × |B| (tích 2 magnitude)
    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);

    // Bước 4: Guard — magnitude 0 (zero vector) hoặc Infinity/NaN → trả 0 thay vì NaN/Infinity
    if (magnitude === 0 || !isFinite(magnitude)) return 0;

    // Bước 5: Cosine similarity = tử / mẫu
    return dotProduct / magnitude;
  }

  /**
   * Tách text thành danh sách từ (token) để dùng cho keyword search.
   *
   * **Regex Unicode `\p{L}\p{N}` là gì?**
   * - `\p{L}` = bất kỳ ký tự "Letter" nào trong Unicode, bao gồm:
   *   - Tiếng Việt có dấu: ă, â, ê, ô, ơ, ư, đ và tất cả tổ hợp dấu (à, á, ả, ã, ạ...)
   *   - Tiếng Anh: a-z, A-Z
   *   - Các ngôn ngữ khác: CJK, Cyrillic, Arabic...
   * - `\p{N}` = bất kỳ ký tự "Number" nào (0-9 và các chữ số Unicode khác)
   * - Flag `u` (unicode) bật chế độ Unicode cho regex — bắt buộc để `\p{...}` hoạt động
   * - `[^\p{L}\p{N}]` = ký tự KHÔNG phải chữ cái/số → thay bằng khoảng trắng (dấu câu, emoji...)
   *
   * Nếu dùng regex thông thường `[^a-zA-Z0-9]` thì "điện thoại" bị tách thành "i n tho i"
   * vì ệ, ạ không nằm trong a-z. Unicode regex giữ nguyên "điện" và "thoại".
   *
   * @param {string} text - Text cần tokenize.
   * @returns {string[]} Mảng các từ viết thường, mỗi từ dài ≥2 ký tự (loại bỏ noise 1 ký tự).
   */
  _tokenize(text) {
    return (
      text
        .toLowerCase()
        // Thay mọi ký tự không phải chữ/số bằng space — giữ nguyên dấu tiếng Việt
        .replace(/[^\p{L}\p{N}]/gu, ' ')
        // Tách theo khoảng trắng (1 hoặc nhiều space liên tiếp)
        .split(/\s+/)
        // Lọc bỏ token 1 ký tự (noise: "a", "1") — chỉ giữ từ có nghĩa ≥2 ký tự
        .filter((t) => t.length > 1)
    );
  }

  /**
   * [Retrieval — Keyword] BM25-inspired keyword search — bắt exact match mà vector embedding có thể miss.
   *
   * **Tại sao cần keyword search bên cạnh vector search?**
   * Vector embedding giỏi hiểu ý nghĩa ("điện thoại Apple" → "iPhone") nhưng đôi khi miss
   * exact match quan trọng. Ví dụ: user gõ "iPhone 15 Pro Max 256GB" — embedding có thể match
   * sản phẩm iPhone khác, trong khi keyword search sẽ bắt đúng model "15 Pro Max".
   *
   * **Cách tính score:**
   * ```
   * score_thô = Σ (mỗi token khớp):
   *   + KEYWORD_NAME_WEIGHT (3) nếu token có trong TÊN sản phẩm
   *   + KEYWORD_TEXT_WEIGHT (1) nếu token có trong TEXT mô tả
   *
   * score_cuối = score_thô × (số_token_khớp / tổng_token_query)
   * ```
   *
   * **Tại sao name weight × 3?**
   * Tên sản phẩm ("iPhone 15 Pro") đặc trưng hơn nhiều so với mô tả ("Hỗ trợ Apple iPhone...").
   * Nếu "iPhone 15" xuất hiện trong tên → đây là match chắc chắn hơn trong đoạn mô tả kỹ thuật.
   *
   * **Coverage ratio (nhân với matched/total) là gì?**
   * Ngăn sản phẩm match 1 từ trong query 5 từ được score cao.
   * Ví dụ: query "iPhone 15 Pro Max 256" (5 tokens) — sản phẩm khớp 4/5 token
   * sẽ được score cao hơn sản phẩm chỉ khớp 1/5 token.
   *
   * @param {string} query - Query text đã normalize.
   * @param {number} [limit=5] - Số kết quả tối đa trả về.
   * @returns {Array<Object>} Items có keywordScore > 0, sắp xếp giảm dần theo keywordScore.
   */
  _keywordSearch(query, limit = 5) {
    // Loại bỏ token trùng lặp trong query — "iPhone iPhone 15" → ["iphone", "15"]
    const uniqueQueryTokens = [...new Set(this._tokenize(query))];
    if (uniqueQueryTokens.length === 0) return [];

    const results = [];
    for (const item of this.items) {
      const nameTokens = new Set(this._tokenize(item.metadata.name || ''));
      const textTokens = new Set(this._tokenize(item.text || ''));
      let rawScore = 0;
      let matchedTokenCount = 0;

      for (const token of uniqueQueryTokens) {
        const inName = nameTokens.has(token);
        const inText = textTokens.has(token);
        if (inName || inText) {
          matchedTokenCount++;
          // Token trong tên sản phẩm có giá trị gấp 3 lần so với trong mô tả kỹ thuật
          rawScore += (inName ? KEYWORD_NAME_WEIGHT : 0) + (inText ? KEYWORD_TEXT_WEIGHT : 0);
        }
      }

      if (matchedTokenCount > 0) {
        // Nhân với tỷ lệ token khớp để ưu tiên sản phẩm khớp nhiều từ hơn
        const coverageRatio = matchedTokenCount / uniqueQueryTokens.length;
        const finalScore = rawScore * coverageRatio;
        results.push({ ...item, keywordScore: finalScore });
      }
    }

    return results.sort((a, b) => b.keywordScore - a.keywordScore).slice(0, limit);
  }

  /**
   * [Retrieval — Semantic] Vector-only cosine similarity search — tìm kiếm theo ý nghĩa ngữ nghĩa.
   *
   * Chuyển câu query thành vector 1024 chiều (type='query'), sau đó so sánh với tất cả
   * vectors trong store bằng cosine similarity. Trả về các sản phẩm có score ≥ minScore.
   *
   * Unified model (Jina v3 / e5-instruct / e5-base) hỗ trợ cả tiếng Việt lẫn tiếng Anh —
   * không cần dịch query trước khi search.
   *
   * @param {string} query - Query text (câu hỏi của user).
   * @param {number} [limit=5] - Số kết quả tối đa trả về.
   * @param {number} [minScore=0] - Ngưỡng cosine similarity tối thiểu (0-1).
   *   Mặc định 0 để lấy tất cả — caller tự lọc. hybridSearch truyền DEFAULT_MIN_SCORE (0.45).
   * @returns {Promise<Array<Object>>} Items có score ≥ minScore, sắp xếp giảm dần theo score.
   */
  async _semanticSearch(query, limit, minScore) {
    const queryVector = await embeddingService.generateEmbedding(query, 'query');

    const scoredItems = this.items.map((item) => {
      // Tương thích ngược với vector-db.json cũ (field vectorEn từ schema trước khi unified)
      const docVector = item.vector || item.vectorEn;
      return { ...item, score: this.cosineSimilarity(queryVector, docVector) };
    });

    return scoredItems
      .filter((item) => isFinite(item.score) && item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * [Retrieval — Fusion] Hybrid search: kết hợp semantic (cosine) + keyword (BM25-inspired).
   *
   * **Tại sao kết hợp 2 phương pháp?**
   * - Semantic search giỏi hiểu ý nghĩa nhưng có thể miss exact match quan trọng.
   * - Keyword search bắt exact match nhưng không hiểu đồng nghĩa.
   * - Kết hợp (Reciprocal Rank Fusion) → bù nhược điểm của nhau.
   *
   * **Reciprocal Rank Fusion là gì?**
   * Kỹ thuật kết hợp 2 danh sách xếp hạng thành 1 danh sách tốt hơn.
   * Sản phẩm xuất hiện ở cả 2 danh sách → được boost score → nằm trên cao.
   * Sản phẩm chỉ có ở keyword list → inject vào với score thấp hơn.
   *
   * **Công thức score:**
   * 1. Vector results: score = cosine similarity (0.45 → 1.0)
   *    + OVERLAP_BOOST (0.05) nếu cũng match keyword
   *
   * 2. Keyword-only results (không có trong vector results):
   *    score = DEFAULT_MIN_SCORE + (keywordScore / maxKw) × KEYWORD_INJECTION_MAX_BOOST
   *    = 0.45 + tỷ_lệ × 0.15  →  tối đa 0.60  →  luôn thấp hơn vector results tốt
   *    Flag `lowConfidence: true` để ChatbotService biết xử lý cẩn thận hơn.
   *
   * @param {string} query - Query text đã normalize.
   * @param {number} [limit=5] - Số kết quả tối đa trả về.
   * @param {number} [minScore=0.45] - Ngưỡng cosine similarity tối thiểu (DEFAULT_MIN_SCORE).
   * @returns {Promise<Array<Object>>} Kết quả merged, sắp xếp theo score giảm dần.
   *   Mỗi item có `score` (0-1) và optional `lowConfidence: true` (keyword-only).
   */
  async hybridSearch(query, limit = 5, minScore = DEFAULT_MIN_SCORE) {
    try {
      await this.loadPromise;

      // Bước 1: Chạy song song 2 phương pháp search — lấy gấp đôi limit để có dư cho merge
      const [vectorResults, keywordResults] = await Promise.all([
        this._semanticSearch(query, limit * 2, minScore),
        Promise.resolve(this._keywordSearch(query, limit * 2)),
      ]);

      if (vectorResults.length === 0 && keywordResults.length === 0) return [];

      // Bước 2: Tạo Sets để kiểm tra overlap O(1) — sản phẩm nào xuất hiện ở CẢ 2 phương pháp
      const vectorIds = new Set(vectorResults.map((r) => r.metadata.id));
      const keywordIds = new Set(keywordResults.map((r) => r.metadata.id));

      // Bước 3: Overlap boost — sản phẩm match cả semantic LẪN keyword → đáng tin hơn
      // Math.min(1, ...) đảm bảo score không vượt 1.0
      vectorResults.forEach((r) => {
        if (keywordIds.has(r.metadata.id)) {
          r.score = Math.min(1, r.score + OVERLAP_BOOST);
        }
      });

      // Bước 4: Inject keyword-only results (vector missed)
      // Ví dụ: "iPhone 15" match exact trong tên sản phẩm nhưng embedding không nhận ra
      // maxKw defaults to 1: prevent chia cho 0 khi mảng rỗng, đảm bảo tỷ lệ ≤ 1
      const maxKeywordScore = keywordResults.reduce((max, r) => Math.max(max, r.keywordScore), 1);
      const keywordOnlyResults = keywordResults
        .filter((r) => !vectorIds.has(r.metadata.id))
        .map((r) => ({
          ...r,
          // Score = sàn (minScore) + phần thưởng tỷ lệ với chất lượng keyword match
          score: minScore + (r.keywordScore / maxKeywordScore) * KEYWORD_INJECTION_MAX_BOOST,
          // Flag cho ChatbotService biết result này chỉ dựa trên keyword, chưa có xác nhận ngữ nghĩa
          lowConfidence: true,
        }));

      if (keywordOnlyResults.length > 0) {
        logger.debug(`[HYBRID] Injected ${keywordOnlyResults.length} keyword-only results`);
      }

      // Bước 5: Merge cả 2 nguồn, sort theo score giảm dần, cắt lấy top N
      return [...vectorResults, ...keywordOnlyResults].sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      logger.error('Lỗi tìm kiếm vector:', error.message);
      return [];
    }
  }
}

const vectorStoreInstance = new HybridVectorStore();
module.exports = vectorStoreInstance;
