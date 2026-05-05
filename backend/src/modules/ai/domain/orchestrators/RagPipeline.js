const { validateMessage } = require('../policies/AiPolicy');
const { AppError } = require('../../../../shared/errors');

// RagPipeline — orchestrate Retrieve-Augment-Generate cho AI chatbot.
//
// Steps:
//   1. Validate message qua AiPolicy
//   2. (Future) Retrieve: vectorStore.search(message embedding)
//   3. Augment: pass relevant context vào LLM prompt
//   4. Generate: llmGateway.handleMessage()
//
// Hiện tại Pipeline thin — delegate hết LLM logic xuống gateway. Khi Phase 5
// cleanup hoàn tất, refactor thật RAG steps qua repos/embeddings.
class RagPipeline {
  constructor({ llmGateway, vectorStore = null }) {
    if (!llmGateway) throw new Error('RagPipeline: llmGateway bắt buộc');
    this.llmGateway = llmGateway;
    this.vectorStore = vectorStore;
  }

  async run({ message, userId, sessionId, context = {} }) {
    const validation = validateMessage(message);
    if (!validation.valid) throw new AppError(validation.reason, 400);

    // (Future) RAG retrieve step — vector search products related to query
    // const relevant = await this.vectorStore.search(...) — defer to Phase 5

    return this.llmGateway.handleMessage(message, userId, sessionId, context);
  }
}

module.exports = RagPipeline;
