const AIController = require('./controllers/aiController');
const AIService = require('./services/aiService');
const SequelizeAIRepository = require('./repositories/SequelizeAIRepository');
const RAGPipeline = require('./services/ragPipeline');
const ChatbotLLMGateway = require('./services/chatbotLLMGateway');
let vectorStoreService;
try {
  vectorStoreService = require('../../services/ai/vectorStore');
} catch (e) {
  vectorStoreService = null;
}
const buildRoutes = require('./routes');

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
