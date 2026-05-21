const axios = require('axios');
const logger = require('@utils/logger');

const EXPECTED_DIM = 1024;

// --- Providers ---

async function jinaEmbed(text, type, apiKey) {
  const task = type === 'passage' ? 'retrieval.passage' : 'retrieval.query';
  const resp = await axios.post(
    'https://api.jina.ai/v1/embeddings',
    { model: 'jina-embeddings-v3', input: [text], task },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    },
  );
  const emb = resp.data?.data?.[0]?.embedding;
  if (!emb || emb.length !== EXPECTED_DIM) {
    throw new Error(`Jina: sai chiều ${emb?.length} (mong đợi ${EXPECTED_DIM})`);
  }
  return emb;
}

async function hfInstructEmbed(text, type, apiKey) {
  const prefix =
    type === 'passage'
      ? 'passage: '
      : 'Instruct: Given a product search query, retrieve relevant Vietnamese e-commerce products\nQuery: ';
  const resp = await axios.post(
    'https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-large-instruct',
    { inputs: prefix + text },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    },
  );
  const emb = Array.isArray(resp.data[0]) ? resp.data[0] : resp.data;
  if (!emb || emb.length !== EXPECTED_DIM) {
    throw new Error(`e5-instruct: sai chiều ${emb?.length} (mong đợi ${EXPECTED_DIM})`);
  }
  return emb;
}

async function hfBaseEmbed(text, type, apiKey) {
  const prefix = type === 'passage' ? 'passage: ' : 'query: ';
  const resp = await axios.post(
    'https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-large',
    { inputs: prefix + text },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    },
  );
  const emb = Array.isArray(resp.data[0]) ? resp.data[0] : resp.data;
  if (!emb || emb.length !== EXPECTED_DIM) {
    throw new Error(`e5-base: sai chiều ${emb?.length} (mong đợi ${EXPECTED_DIM})`);
  }
  return emb;
}

// --- Service ---

class UnifiedEmbeddingService {
  constructor() {
    this.jinaKey = process.env.JINA_API_KEY;
    this.hfKey = process.env.HF_API_KEY;
    this.providers = this._buildProviders();
    this._logInit();
  }

  _buildProviders() {
    const providers = [];
    if (this.jinaKey) {
      providers.push({
        name: 'Jina v3',
        fn: (text, type) => jinaEmbed(text, type, this.jinaKey),
      });
    }
    if (this.hfKey) {
      providers.push({
        name: 'multilingual-e5-large-instruct',
        fn: (text, type) => hfInstructEmbed(text, type, this.hfKey),
      });
      providers.push({
        name: 'multilingual-e5-large',
        fn: (text, type) => hfBaseEmbed(text, type, this.hfKey),
      });
    }
    return providers;
  }

  _logInit() {
    if (this.providers.length === 0) {
      logger.warn('UnifiedEmbedding: không có provider nào — cần JINA_API_KEY hoặc HF_API_KEY');
      return;
    }
    const primary = this.providers[0].name;
    const fallbacks = this.providers
      .slice(1)
      .map((p) => p.name)
      .join(' → ');
    logger.info(
      `✅ UnifiedEmbedding khởi tạo — primary: [${primary}]${fallbacks ? ` | fallback: ${fallbacks}` : ''}`,
    );
  }

  // Trả về tên provider đang active (dùng cho logging bên ngoài)
  get activeName() {
    return this.providers[0]?.name ?? 'none';
  }

  isAvailable() {
    return this.providers.length > 0;
  }

  // type: 'passage' khi indexing documents, 'query' khi search
  async generateEmbedding(text, type = 'query') {
    if (this.providers.length === 0) {
      throw new Error('Chưa cấu hình provider embedding (JINA_API_KEY hoặc HF_API_KEY)');
    }

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      try {
        const embedding = await provider.fn(text, type);
        if (i > 0) {
          logger.debug(`UnifiedEmbedding: dùng fallback [${provider.name}]`);
        }
        return embedding;
      } catch (err) {
        const isLast = i === this.providers.length - 1;
        if (!isLast) {
          logger.warn(
            `UnifiedEmbedding: [${provider.name}] thất bại → thử [${this.providers[i + 1].name}]: ${err.message}`,
          );
        } else {
          logger.error(`UnifiedEmbedding: tất cả providers thất bại: ${err.message}`);
          throw err;
        }
      }
    }
  }
}

module.exports = new UnifiedEmbeddingService();
