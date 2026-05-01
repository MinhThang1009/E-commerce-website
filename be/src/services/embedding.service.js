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
        console.info('✅ Embedding Service initialized successfully with OpenRouter');
      } else {
        console.warn('⚠️ OpenRouter API key not found in Embedding Service');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Embedding Service:', error.message);
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text) {
    if (!this.apiKey || this.apiKey === 'demo-key') {
      throw new Error('Embedding API key not configured');
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
          }
        }
      );

      return response.data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error.response?.data || error.message);
      // Fallback: Return a zero vector of appropriate dimension (1536 for OpenAI) if needed, 
      // but throwing is safer for data integrity
      throw error;
    }
  }

  /**
   * Generate embeddings for a batch of texts
   */
  async generateBatchEmbeddings(texts) {
    if (!this.apiKey || this.apiKey === 'demo-key') {
      throw new Error('Embedding API key not configured');
    }

    try {
      // OpenRouter / OpenAI embeddings API supports batch (input: array of strings)
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
      console.error('Error generating batch embeddings:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new EmbeddingService();
