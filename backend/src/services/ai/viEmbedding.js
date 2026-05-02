const axios = require('axios');

class VietnameseEmbeddingService {
  constructor() {
    this.apiKey = process.env.HF_API_KEY;
    // multilingual-e5-large: warm model, 1024 dims, hỗ trợ 100+ ngôn ngữ bao gồm tiếng Việt
    this.apiUrl = 'https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-large';
    this.EXPECTED_DIM = 1024;
    if (this.apiKey) {
      console.info('✅ Vietnamese Embedding Service khởi tạo thành công (multilingual-e5-large via HuggingFace)');
    } else {
      console.warn('⚠️ HF_API_KEY chưa được cấu hình — Vietnamese embedding sẽ fallback sang English model');
    }
  }

  isAvailable() {
    return !!this.apiKey;
  }

  async generateEmbedding(text) {
    if (!this.apiKey) throw new Error('HF_API_KEY chưa được cấu hình');
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
  }
}

module.exports = new VietnameseEmbeddingService();
