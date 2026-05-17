const AiController = require('./controllers/aiController');
const AiService = require('./services/aiService');
const SequelizeAiRepository = require('./repositories/SequelizeAiRepository');
const RagPipeline = require('./domain/orchestrators/RagPipeline');
const GeminiLlmGateway = require('./infrastructure/GeminiLlmGateway');
const vectorStoreService = require('../../services/ai/vectorStore');
const buildRoutes = require('./routes');

module.exports = ({
  Product,
  ProductVariant,
  Category,
  geminiChatbotService,
  sequelize,
  eventBus,
  logger,
}) => {
  if (!Product) throw new Error('ai module: Product model bắt buộc');
  if (!geminiChatbotService) throw new Error('ai module: geminiChatbotService bắt buộc');

  const aiRepository = new SequelizeAiRepository({ Product, ProductVariant, Category, sequelize });
  const llmGateway = new GeminiLlmGateway({ geminiChatbotService });
  const ragPipeline = new RagPipeline({ llmGateway, vectorStore: vectorStoreService });

  const aiService = new AiService({
    aiRepository,
    ragPipeline,
    logger,
  });
  const aiController = new AiController({ aiService, logger });
  const router = buildRoutes({ aiController });

  return {
    basePath: '/chatbot',
    router,
    subscribeEvents() {},
  };
};
