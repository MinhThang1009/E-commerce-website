const axios = require('axios');

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
        console.info('✅ Embedding Service khởi tạo thành công với OpenRouter');
      } else {
        console.warn('⚠️ Không tìm thấy OpenRouter API key trong Embedding Service');
      }
    } catch (error) {
      console.error('❌ Khởi tạo Embedding Service thất bại:', error.message);
    }
  }

  /**
   * Tạo embedding cho một đoạn văn bản
   */
  async generateEmbedding(text) {
    if (!this.apiKey || this.apiKey === 'demo-key') {
      throw new Error('Chưa cấu hình API key cho Embedding');
    }

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          input: text
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000,
        }
      );

      return response.data.data[0].embedding;
    } catch (error) {
      console.error('Lỗi khi tạo embedding:', error.response?.data || error.message);
      // Dự phòng: Trả về vector zero có kích thước phù hợp (1536 cho OpenAI) nếu cần,
      // nhưng throw lỗi an toàn hơn để đảm bảo tính toàn vẹn dữ liệu
      throw error;
    }
  }

  /**
   * Tạo embeddings cho một loạt văn bản (batch)
   */
  async generateBatchEmbeddings(texts) {
    if (!this.apiKey || this.apiKey === 'demo-key') {
      throw new Error('Chưa cấu hình API key cho Embedding');
    }

    try {
      // OpenRouter / OpenAI embeddings API hỗ trợ batch (input: mảng chuỗi)
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          input: texts
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data.map(item => item.embedding);
    } catch (error) {
      console.error('Lỗi khi tạo batch embeddings:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new EmbeddingService();
