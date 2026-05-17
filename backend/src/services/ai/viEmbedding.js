const logger = require('../../utils/logger');
const axios = require('axios');

class VietnameseEmbeddingService {
  constructor() {
    this.apiKey = process.env.HF_API_KEY;
    // multilingual-e5-large: warm model, 1024 dims, hỗ trợ 100+ ngôn ngữ bao gồm tiếng Việt
    this.apiUrl = 'https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-large';
    this.EXPECTED_DIM = 1024;
    if (this.apiKey) {
      logger.info('Vietnamese Embedding Service khởi tạo thành công (multilingual-e5-large via HuggingFace)');
    } else {
      logger.warn('HF_API_KEY chưa được cấu hình — Vietnamese embedding sẽ fallback sang English model');
    }
  }

  isAvailable() {
    return !!this.apiKey;
  }

  // HuggingFace API không ổn định — retry để tránh search() throw exception và mất context chatbot
  async generateEmbedding(text) {
    if (!this.apiKey) throw new Error('HF_API_KEY chưa được cấu hình');

    const maxRetries = 2;
    const backoffMs = [500, 1000];

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const response = await axios.post(
          this.apiUrl,
          { inputs: text },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          }
        );
        // multilingual-e5-large trả về flat array [float, ...] với 1024 dims
        const embedding = Array.isArray(response.data[0]) ? response.data[0] : response.data;
        if (!embedding || embedding.length !== this.EXPECTED_DIM) {
          throw new Error(
            `Invalid embedding: expected ${this.EXPECTED_DIM} dims, got ${embedding?.length}`
          );
        }
        return embedding;
      } catch (error) {
        const isLastAttempt = attempt > maxRetries;
        if (!isLastAttempt) {
          logger.warn(`VI embedding thất bại (lần ${attempt}/${maxRetries + 1}), thử lại sau ${backoffMs[attempt - 1]}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs[attempt - 1]));
        } else {
          logger.error('VI embedding thất bại sau', maxRetries + 1, 'lần thử:', error.message);
          throw error;
        }
      }
    }
  }
}

module.exports = new VietnameseEmbeddingService();

