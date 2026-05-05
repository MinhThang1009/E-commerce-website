const ChatService = require('../modules/chat/services/chatService');

describe('ChatService', () => {
  let repo;
  let socketBridge;
  let eventBus;
  let service;

  beforeEach(() => {
    repo = {
      findMessagesByIdentifier: jest.fn(),
      createMessage: jest.fn(async (p) => ({ id: 1, ...p })),
      markUserMessagesRead: jest.fn().mockResolvedValue(),
      markAdminMessagesRead: jest.fn().mockResolvedValue(),
      findAdminChatSessions: jest.fn(),
      findLastMessageBySessionId: jest.fn(),
      countUnreadFromUserBySession: jest.fn(),
      findUserById: jest.fn(),
    };
    socketBridge = {
      emitToRoom: jest.fn(),
      emitToAdmin: jest.fn(),
    };
    eventBus = { publish: jest.fn().mockResolvedValue() };
    service = new ChatService({
      chatRepository: repo, socketBridge, eventBus,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
  });

  describe('getChatHistory', () => {
    test('non-admin + 0 messages → 404', async () => {
      repo.findMessagesByIdentifier.mockResolvedValue([]);
      await expect(
        service.getChatHistory({ identifier: 'X', isAdmin: false, currentUserId: 1 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('non-admin + không có quyền → 403', async () => {
      repo.findMessagesByIdentifier.mockResolvedValue([{ userId: 99, sessionId: 'X' }]);
      await expect(
        service.getChatHistory({ identifier: 'X', isAdmin: false, currentUserId: 5 })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    test('admin → mark user messages read', async () => {
      repo.findMessagesByIdentifier.mockResolvedValue([{ userId: 1 }]);
      await service.getChatHistory({ identifier: '1', isAdmin: true });
      expect(repo.markUserMessagesRead).toHaveBeenCalledWith('1');
    });

    test('user owner → mark admin messages read', async () => {
      repo.findMessagesByIdentifier.mockResolvedValue([{ userId: 5, sessionId: '5' }]);
      await service.getChatHistory({ identifier: '5', isAdmin: false, currentUserId: 5 });
      expect(repo.markAdminMessagesRead).toHaveBeenCalledWith('5');
    });

    test('admin + 0 messages → trả empty array, không throw', async () => {
      repo.findMessagesByIdentifier.mockResolvedValue([]);
      const result = await service.getChatHistory({ identifier: 'X', isAdmin: true });
      expect(result).toEqual([]);
    });
  });

  describe('sendMessage', () => {
    test('thiếu cả userId + sessionId → 400', async () => {
      await expect(
        service.sendMessage({ userId: null, sessionId: null, content: 'hi' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('có userId → tạo message + emit socket + publish event', async () => {
      await service.sendMessage({ userId: 5, sessionId: null, content: 'hi' });

      expect(repo.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 5, content: 'hi', isFromAdmin: false })
      );
      expect(socketBridge.emitToRoom).toHaveBeenCalledWith('5', 'messageRecieved', expect.any(Object));
      expect(socketBridge.emitToAdmin).toHaveBeenCalledWith('messageRecieved', expect.any(Object));
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'chat.messageSent' })
      );
    });

    test('socket emit fail → log warn nhưng không throw', async () => {
      socketBridge.emitToRoom.mockImplementation(() => { throw new Error('socket dead'); });
      await expect(
        service.sendMessage({ userId: 5, content: 'hi' })
      ).resolves.toBeDefined();
    });
  });

  describe('getAdminChatList', () => {
    test('build list với lastMessage + unreadCount + user info', async () => {
      repo.findAdminChatSessions.mockResolvedValue([
        { sessionId: 'sess-1', userId: 5, getDataValue: () => '2026-01-01' },
        { sessionId: null, userId: 7, getDataValue: () => '2026-01-02' },
      ]);
      repo.findLastMessageBySessionId.mockResolvedValueOnce({ content: 'msg1' })
        .mockResolvedValueOnce({ content: 'msg2' });
      repo.countUnreadFromUserBySession.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
      repo.findUserById.mockResolvedValue({ id: 5, firstName: 'A' });

      const list = await service.getAdminChatList();

      expect(list).toHaveLength(2);
      expect(list[0].lastMessage).toBe('msg1');
      expect(list[0].unreadCount).toBe(2);
      expect(list[1].sessionId).toBe(7); // fallback userId nếu không có sessionId
    });
  });

  describe('markAsRead', () => {
    test('admin → markUserMessagesRead', async () => {
      const result = await service.markAsRead({ identifier: 'X', isAdmin: true });
      expect(repo.markUserMessagesRead).toHaveBeenCalledWith('X');
      expect(result.message).toMatch(/đã đọc/);
    });

    test('user → markAdminMessagesRead', async () => {
      await service.markAsRead({ identifier: 'X', isAdmin: false });
      expect(repo.markAdminMessagesRead).toHaveBeenCalledWith('X');
    });
  });
});
