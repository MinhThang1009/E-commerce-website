const { validateMessage, expandAbbreviations } = require('../policies/AiPolicy');
const { AppError } = require('../../../../shared/errors');
const logger = require('../../../../utils/logger');

// RagPipeline — orchestrate Retrieve-Augment-Generate cho AI chatbot.
//
// Steps:
//   1. Validate message qua AiPolicy
//   2. Normalize: expand abbreviations (ip → iPhone, ss → Samsung...)
//   3. Retrieve: vectorStore.search(normalized query) → sản phẩm liên quan
//   4. Augment + Generate: llmGateway nhận products, build prompt, gọi LLM
class RagPipeline {
  constructor({ llmGateway, vectorStore = null }) {
    if (!llmGateway) throw new Error('RagPipeline: llmGateway bắt buộc');
    this.llmGateway = llmGateway;
    this.vectorStore = vectorStore;
  }

  async run({ message, userId, sessionId, context = {} }) {
    const validation = validateMessage(message);
    if (!validation.valid) throw new AppError(validation.reason, 400);

    // Normalize: expand viết tắt tiếng Việt trước khi search
    const normalizedQuery = expandAbbreviations(message);

    // Retrieve: vector search sản phẩm liên quan đến query
    let retrievedProducts = null;
    if (this.vectorStore) {
      try {
        const results = await this.vectorStore.search(normalizedQuery, 10);
        retrievedProducts = results.map((r) => ({ ...r.metadata, score: r.score }));
        logger.debug(`[RagPipeline] Retrieved ${retrievedProducts.length} products`);
      } catch (err) {
        logger.warn(
          '[RagPipeline] Vector search thất bại, tiếp tục không có retrieval:',
          err.message,
        );
      }
    }

    // Augment + Generate: truyền products đã retrieve xuống gateway
    return this.llmGateway.handleMessage(message, userId, sessionId, {
      ...context,
      ...(retrievedProducts !== null && { retrievedProducts }),
    });
  }
}

module.exports = RagPipeline;
