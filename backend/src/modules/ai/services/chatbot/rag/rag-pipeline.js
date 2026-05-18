/**
 * @file ragPipeline.js
 * @layer Service
 * @module ai
 * @description Business logic layer cho ai
 */
const { validateMessage, expandAbbreviations, isOffTopic, classifyIntent } = require('@modules/ai/services/core/ai-policy');
const { AppError } = require('@shared/errors');
const logger = require('@utils/logger');

// RAGPipeline — orchestrate Retrieve-Augment-Generate cho AI chatbot.
//
// Steps:
//   1. Validate message qua AIPolicy
//   2. Normalize: expand abbreviations (ip → iPhone, ss → Samsung...)
//   3. Parallel: LLM rewrite query + initial hybrid search
//   4. Nếu LLM rewrite khác → refined search với query mới
//   5. Augment + Generate: llmGateway nhận products, build prompt, gọi LLM
class RAGPipeline {
  constructor({ llmGateway, vectorStore = null }) {
    if (!llmGateway) throw new Error('RAGPipeline: llmGateway bắt buộc');
    this.llmGateway = llmGateway;
    this.vectorStore = vectorStore;
  }

  /**
   * [Orchestration] Entry point RAG pipeline: Validate → Normalize → Retrieve (hybrid) → Augment+Generate (LLM).
   * @param {Object} params
   * @param {string} params.message - Tin nhắn gốc từ user.
   * @param {number} [params.userId] - ID user (null nếu anonymous).
   * @param {string} [params.sessionId] - Session ID cho conversation history.
   * @param {Object} [params.context={}] - Context bổ sung truyền xuống LLM gateway.
   * @returns {Promise<Object>} Response từ LLM gateway {response, products, suggestions, intent}.
   * @throws {AppError} 400 nếu message rỗng hoặc quá dài.
   */
  async run({ message, userId, sessionId, context = {} }) {
    const validation = validateMessage(message);
    if (!validation.valid) throw new AppError(validation.reason, 400);

    const normalizedQuery = expandAbbreviations(message);

    // Off-topic → skip retrieval, tiết kiệm LLM rewrite + vector search
    if (isOffTopic(normalizedQuery)) {
      return this.llmGateway.handleMessage(message, userId, sessionId, {
        ...context,
        normalizedQuery,
        preClassifiedIntent: 'off_topic',
      });
    }

    let retrievedProducts = null;
    let rewrittenQuery = null;

    if (this.vectorStore) {
      try {
        // Song song: LLM rewrite + initial hybrid search
        const [llmRewrite, initialResults] = await Promise.all([
          this.llmGateway.rewriteQuery(normalizedQuery).catch(() => null),
          this.vectorStore.hybridSearch(normalizedQuery, 10),
        ]);

        // Nếu LLM rewrite khác → refined search, chọn kết quả tốt hơn
        if (llmRewrite && llmRewrite.toLowerCase() !== normalizedQuery.toLowerCase()) {
          rewrittenQuery = llmRewrite;
          logger.debug(`[RAGPipeline] LLM rewrite: "${normalizedQuery}" → "${llmRewrite}"`);
          try {
            const refinedResults = await this.vectorStore.hybridSearch(llmRewrite, 10);
            const results = refinedResults.length > 0 ? refinedResults : initialResults;
            retrievedProducts = results.map((r) => ({ ...r.metadata, score: r.score }));
          } catch {
            retrievedProducts = initialResults.map((r) => ({ ...r.metadata, score: r.score }));
          }
        } else {
          retrievedProducts = initialResults.map((r) => ({ ...r.metadata, score: r.score }));
        }

        // Fallback: hạ threshold lấy top-3 khi không đạt minScore mặc định
        if (retrievedProducts.length === 0) {
          logger.warn('[RAGPipeline] Không có kết quả trên threshold — hạ minScore lấy top-3');
          try {
            const fallbackQuery = rewrittenQuery || normalizedQuery;
            const lowResults = await this.vectorStore.hybridSearch(fallbackQuery, 3, 0);
            retrievedProducts = lowResults.map((r) => ({
              ...r.metadata,
              score: r.score,
              lowConfidence: true,
            }));
          } catch {
            retrievedProducts = [];
          }
        }

        logger.debug(`[RAGPipeline] Retrieved ${retrievedProducts.length} products`);
      } catch (err) {
        logger.warn(
          '[RAGPipeline] Vector search thất bại, tiếp tục không có retrieval:',
          err.message,
        );
      }
    }

    return this.llmGateway.handleMessage(message, userId, sessionId, {
      ...context,
      normalizedQuery,
      preClassifiedIntent: classifyIntent(normalizedQuery),
      ...(retrievedProducts !== null && { retrievedProducts }),
      ...(rewrittenQuery && { llmRewrittenQuery: rewrittenQuery }),
    });
  }
}

module.exports = RAGPipeline;
