const { Op, fn, col, literal } = require('sequelize');
const IChatRepository = require('./IChatRepository');

class SequelizeChatRepository extends IChatRepository {
  constructor({ ChatMessage, User }) {
    super();
    this.ChatMessage = ChatMessage;
    this.User = User;
  }

  // identifier có thể là sessionId (UUID) hoặc userId (number) — match cả 2
  async findMessagesByIdentifier(identifier) {
    return this.ChatMessage.findAll({
      where: { [Op.or]: [{ sessionId: identifier }, { userId: identifier }] },
      order: [['createdAt', 'ASC']],
    });
  }

  async createMessage(payload) {
    return this.ChatMessage.create(payload);
  }

  async markUserMessagesRead(identifier) {
    return this.ChatMessage.update({ isRead: true }, {
      where: {
        [Op.or]: [{ sessionId: identifier }, { userId: identifier }],
        isFromAdmin: false, isRead: false,
      },
    });
  }

  async markAdminMessagesRead(identifier) {
    return this.ChatMessage.update({ isRead: true }, {
      where: {
        [Op.or]: [{ sessionId: identifier }, { userId: identifier }],
        isFromAdmin: true, isRead: false,
      },
    });
  }

  // List support chat sessions cho admin dashboard. Loại trừ AI chatbot messages.
  async findAdminChatSessions() {
    return this.ChatMessage.findAll({
      attributes: [
        'sessionId', 'userId',
        [fn('MAX', col('created_at')), 'lastMessageAt'],
      ],
      where: {
        [Op.or]: [{ messageType: 'support_chat' }, { messageType: null }],
      },
      group: ['sessionId', 'userId'],
      order: [[literal('MAX(created_at)'), 'DESC']],
    });
  }

  async findLastMessageBySessionId(sessionIdOrUserId) {
    return this.ChatMessage.findOne({
      where: { sessionId: sessionIdOrUserId },
      order: [['createdAt', 'DESC']],
    });
  }

  async countUnreadFromUserBySession(sessionIdOrUserId, userId) {
    return this.ChatMessage.count({
      where: {
        [Op.or]: [{ sessionId: sessionIdOrUserId }, { userId }],
        isFromAdmin: false, isRead: false,
      },
    });
  }

  async findUserById(id) {
    return this.User.findByPk(id, {
      attributes: ['id', 'firstName', 'lastName', 'email', 'avatar'],
    });
  }
}

module.exports = SequelizeChatRepository;
