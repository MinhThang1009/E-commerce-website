// ILLMGateway — port abstract cho LLM provider (Gemini + configurable LLM_BASE_URL hiện tại;
// future providers có thể swap qua adapter).
//
// Service phụ thuộc interface này — không phụ thuộc chatbotService trực tiếp.

class ILLMGateway {
  // Generate response cho user message với context (products + history + intent).
  async handleMessage(_message, _userId, _sessionId, _context) {
    throw new Error('not implemented');
  }
  async getAIResponse(_prompt, _products, _context, _history) {
    throw new Error('not implemented');
  }
  // Chuẩn hóa query qua LLM: sửa typo, expand viết tắt mà regex không bắt được
  async rewriteQuery(_message) {
    return null;
  }
}

module.exports = ILLMGateway;
