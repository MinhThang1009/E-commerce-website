// ILlmGateway — port abstract cho LLM provider (OpenRouter Gemini hiện tại;
// future PaLM/Claude/GPT có thể swap qua adapter).
//
// Service phụ thuộc interface này — không phụ thuộc geminiChatbotService trực tiếp.

class ILlmGateway {
  // Generate response cho user message với context (products + history + intent).
  async handleMessage(_message, _userId, _sessionId, _context) {
    throw new Error('not implemented');
  }
  async getAIResponse(_prompt, _products, _context) {
    throw new Error('not implemented');
  }
}

module.exports = ILlmGateway;
