// LLM gateway — delegate sang chatbotService (Phase 1: đã xóa ILLMGateway interface).
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
