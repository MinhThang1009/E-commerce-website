const axios = require('axios');
const logger = require('../../../utils/logger');

// Cache in-memory: tránh gọi API lặp lại với cùng text — Key: text chuẩn hóa, TTL 10 phút, max 500 entries FIFO
const embeddingCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 phút
const CACHE_MAX_SIZE = 500;

// Lấy embedding từ cache nếu còn hạn
function getFromCache(text) {
  const key = text.toLowerCase().trim();
  const entry = embeddingCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    embeddingCache.delete(key);
    return null;
  }
  return entry.vector;
}

// Lưu embedding vào cache, xóa entry cũ nhất nếu đầy (FIFO)
function saveToCache(text, vector) {
  const key = text.toLowerCase().trim();
  if (embeddingCache.size >= CACHE_MAX_SIZE) {
    // Xóa entry đầu tiên (FIFO)
    const firstKey = embeddingCache.keys().next().value;
    embeddingCache.delete(firstKey);
  }
  embeddingCache.set(key, { vector, expiresAt: Date.now() + CACHE_TTL_MS });
}

class EmbeddingService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = 'openai/text-embedding-3-small';
    this.apiUrl = 'https://openrouter.ai/api/v1/embeddings';
    this.initialize();
  }

  initialize() {
    try {
      if (this.apiKey && this.apiKey !== 'demo-key') {
        logger.info('Embedding Service khởi tạo thành công với OpenRouter');
      } else {
        logger.warn('Không tìm thấy OpenRouter API key trong Embedding Service');
      }
    } catch (error) {
      logger.error('Khởi tạo Embedding Service thất bại:', error.message);
    }
  }

  async generateEmbedding(text) {
    if (!this.apiKey || this.apiKey === 'demo-key') {
      throw new Error('Chưa cấu hình API key cho Embedding');
    }

    // Kiểm tra cache trước khi gọi API
    const cached = getFromCache(text);
    if (cached) return cached;

    const maxRetries = 3;
    const backoffMs = [500, 1000, 2000]; // Tăng dần thời gian chờ giữa các lần thử

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(
          this.apiUrl,
          { model: this.model, input: text },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        );

        // Null check: API trả về format sai → TypeError thay vì crash ngầm
        const embedding = response.data?.data?.[0]?.embedding;
        if (!embedding) throw new Error('API trả về embedding rỗng hoặc sai format');

        // Lưu vào cache để tái sử dụng
        saveToCache(text, embedding);
        return embedding;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        if (!isLastAttempt) {
          logger.warn(
            `Embedding thất bại (lần ${attempt}/${maxRetries}), thử lại sau ${backoffMs[attempt - 1]}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs[attempt - 1]));
        } else {
          logger.error(
            'Lỗi khi tạo embedding sau 3 lần thử:',
            error.response?.data || error.message,
          );
          throw error;
        }
      }
    }
  }

  // Batch embedding — dùng khi rebuild vector store, timeout 60s để chứa nhiều items
  async generateBatchEmbeddings(texts) {
    if (!this.apiKey || this.apiKey === 'demo-key') {
      throw new Error('Chưa cấu hình API key cho Embedding');
    }

    const maxRetries = 3;
    const backoffMs = [500, 1000, 2000];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // OpenRouter / OpenAI embeddings API hỗ trợ batch (input: mảng chuỗi)
        const response = await axios.post(
          this.apiUrl,
          { model: this.model, input: texts },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            // Timeout 60s cho batch (gấp đôi single) — nhiều items hơn
            timeout: 60000,
          },
        );

        return response.data.data.map((item) => item.embedding);
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        if (!isLastAttempt) {
          logger.warn(
            `Batch embedding thất bại (lần ${attempt}/${maxRetries}), thử lại sau ${backoffMs[attempt - 1]}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs[attempt - 1]));
        } else {
          logger.error(
            'Lỗi khi tạo batch embeddings sau 3 lần thử:',
            error.response?.data || error.message,
          );
          throw error;
        }
      }
    }
  }
}

module.exports = new EmbeddingService();
