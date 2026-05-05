const AiController = require('./controllers/aiController');
const AiService = require('./services/aiService');
const SequelizeAiRepository = require('./repositories/SequelizeAiRepository');
const RagPipeline = require('./domain/orchestrators/RagPipeline');
const GeminiLlmGateway = require('./infrastructure/GeminiLlmGateway');
const buildRoutes = require('./routes');

// AI module — DDD-lite. RagPipeline orchestrate validation → LLM gateway.
// Plan Sprint 11 ports: ILlmGateway + IVectorStore + IConversationStore.
// Hiện tại VectorStore + ConversationStore defer đến Phase 5 (legacy services
// dùng đủ).
module.exports = ({
  Product, Category,
  geminiChatbotService, ruleBasedChatbot,
  sequelize, eventBus, logger,
}) => {
  if (!Product) throw new Error('ai module: Product model bắt buộc');
  if (!geminiChatbotService) throw new Error('ai module: geminiChatbotService bắt buộc');

  const aiRepository = new SequelizeAiRepository({ Product, Category, sequelize });
  const llmGateway = new GeminiLlmGateway({ geminiChatbotService });
  const ragPipeline = new RagPipeline({ llmGateway });

  const aiService = new AiService({
    aiRepository, ragPipeline, ruleBasedChatbot, logger,
  });
  const aiController = new AiController({ aiService, logger });
  const router = buildRoutes({ aiController });

  return {
    basePath: '/chatbot',
    router,
    subscribeEvents() {},
  };
};
