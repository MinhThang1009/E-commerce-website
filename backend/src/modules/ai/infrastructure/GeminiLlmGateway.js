const ILlmGateway = require('../domain/ports/ILlmGateway');

// Adapter wrap services/ai/geminiChatbot — service phụ thuộc ILlmGateway.
class GeminiLlmGateway extends ILlmGateway {
  constructor({ geminiChatbotService }) {
    super();
    this.geminiService = geminiChatbotService;
  }

  handleMessage(message, userId, sessionId, context) {
    return this.geminiService.handleMessage(message, userId, sessionId, context);
  }

  getAIResponse(userMessage, products, context, history) {
    return this.geminiService.getAIResponse(userMessage, products, context, history);
  }
}

module.exports = GeminiLlmGateway;
