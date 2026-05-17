const ILLMGateway = require('../domain/ports/ILLMGateway');

// Adapter: implement ILLMGateway bằng cách delegate sang chatbotService.
class ChatbotLLMGateway extends ILLMGateway {
  constructor({ chatbotService }) {
    super();
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
