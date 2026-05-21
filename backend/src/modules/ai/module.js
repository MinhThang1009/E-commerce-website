/**
 * @file module.js
 * @layer Module
 * @module ai
 * @description Entry point ai module — khởi tạo dependencies và đăng ký routes
 */
const AIController = require('@modules/ai/controllers/ai-controller');
const AIService = require('@modules/ai/services/core/ai-service');
const SequelizeAIRepository = require('@modules/ai/repositories/sequelize-ai-repository');
const RAGPipeline = require('@modules/ai/services/chatbot/rag/rag-pipeline');
const ChatbotLLMGateway = require('@modules/ai/services/chatbot/chatbot-llm-gateway');
let vectorStoreService;
try {
  vectorStoreService = require('@services/vector-store/vector-store');
} catch (e) {
  vectorStoreService = null;
}
const buildRoutes = require('@modules/ai/routes');

module.exports = ({
  Product,
  ProductVariant,
  Category,
  chatbotService,
  sequelize,
  eventBus,
  logger,
}) => {
  if (!Product) throw new Error('ai module: Product model bắt buộc');
  if (!chatbotService) throw new Error('ai module: chatbotService bắt buộc');

  const aiRepository = new SequelizeAIRepository({ Product, ProductVariant, Category, sequelize });
  const llmGateway = new ChatbotLLMGateway({ chatbotService });
  const ragPipeline = new RAGPipeline({ llmGateway, vectorStore: vectorStoreService });

  const aiService = new AIService({
    aiRepository,
    ragPipeline,
    logger,
  });
  const aiController = new AIController({ aiService, logger });
  const router = buildRoutes({ aiController });

  return {
    basePath: '/chatbot',
    router,
    subscribeEvents() {},
  };
};
