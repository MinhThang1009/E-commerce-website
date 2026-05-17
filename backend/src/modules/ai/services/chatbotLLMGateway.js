/**
 * @file chatbotLLMGateway.js
 * @layer Service
 * @module ai
 * @description Business logic layer cho ai
 */
// Adapter giao tiếp với LLM — chuyển tiếp các lệnh xuống chatbotService.
class ChatbotLLMGateway {
  constructor({ chatbotService }) {
    this.chatbotService = chatbotService;
  }

  handleMessage(message, userId, sessionId, context) {
    return this.chatbotService.handleMessage(message, userId, sessionId, context);
  }

  getAIResponse(userMessage, products, context, history) {
    return this.chatbotService.getAIResponse(userMessage, products, context, history);
  }

  rewriteQuery(message) {
    return this.chatbotService._llmRewrite(message);
  }
}

module.exports = ChatbotLLMGateway;
