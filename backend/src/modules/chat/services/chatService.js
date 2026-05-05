const { AppError } = require('../../../shared/errors');
const ChatPolicy = require('../domain/policies/ChatPolicy');
const ChatMessageSentEvent = require('../domain/events/ChatMessageSentEvent');

// Chat Service — support chat user/admin. Realtime delivery qua Socket bridge
// (port adapter), business logic + access control qua ChatPolicy.
class ChatService {
  constructor({ chatRepository, socketBridge, eventBus, logger }) {
    this.repo = chatRepository;
    this.socketBridge = socketBridge;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  // GET /api/chat/:identifier — lịch sử message + auto-mark-read theo role.
  async getChatHistory({ identifier, currentUserId, isAdmin }) {
    const messages = await this.repo.findMessagesByIdentifier(identifier);

    if (!isAdmin) {
      // Anti-enumeration: trả 404 trước check ownership cho non-admin
      if (messages.length === 0) {
        throw new AppError('Không tìm thấy cuộc trò chuyện', 404);
      }
    }

    if (!ChatPolicy.canAccessSession({ identifier, currentUserId, isAdmin, messages })) {
      throw new AppError('Không có quyền xem cuộc trò chuyện này', 403);
    }

    if (isAdmin) {
      await this.repo.markUserMessagesRead(identifier);
    } else {
      await this.repo.markAdminMessagesRead(identifier);
    }

    return messages;
  }

  // Admin Dashboard — list session với lastMessage + unreadCount.
  async getAdminChatList() {
    const sessions = await this.repo.findAdminChatSessions();

    return Promise.all(sessions.map(async (s) => {
      const sessionKey = s.sessionId || s.userId;
      const [lastMessage, unreadCount, chatUser] = await Promise.all([
        this.repo.findLastMessageBySessionId(sessionKey),
        this.repo.countUnreadFromUserBySession(sessionKey, s.userId),
        s.userId ? this.repo.findUserById(s.userId) : Promise.resolve(null),
      ]);

      return {
        sessionId: sessionKey,
        userId: s.userId,
        user: chatUser,
        lastMessage: lastMessage ? lastMessage.content : '',
        lastMessageAt: s.getDataValue('lastMessageAt'),
        unreadCount,
      };
    }));
  }

  // POST /api/chat — gửi message support (user/guest → admin).
  async sendMessage({ userId, sessionId, content }) {
    const validation = ChatPolicy.validateSendMessage({ userId, sessionId });
    if (!validation.valid) throw new AppError(validation.reason, 400);

    const message = await this.repo.createMessage({
      userId,
      sessionId: sessionId || null,
      content,
      isFromAdmin: false,
      isRead: false,
    });

    // Emit realtime qua socket bridge (nếu có) — tới admin-room + room user.
    if (this.socketBridge) {
      const targetRoom = sessionId || String(userId);
      try {
        this.socketBridge.emitToRoom(targetRoom, 'messageRecieved', message);
        this.socketBridge.emitToAdmin('messageRecieved', message);
      } catch (err) {
        this.logger.warn('[chat] Socket emit thất bại:', err.message);
      }
    }

    await this.eventBus.publish(ChatMessageSentEvent({
      messageId: message.id,
      userId, sessionId: sessionId || null,
      content, isFromAdmin: false,
    }));

    return message;
  }

  async markAsRead({ identifier, isAdmin }) {
    if (isAdmin) {
      await this.repo.markUserMessagesRead(identifier);
    } else {
      await this.repo.markAdminMessagesRead(identifier);
    }
    return { message: 'Đã đánh dấu cuộc trò chuyện là đã đọc' };
  }
}

module.exports = ChatService;
