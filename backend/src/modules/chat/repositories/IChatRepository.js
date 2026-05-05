// IChatRepository — interface chat data access (ChatMessage + User).
class IChatRepository {
  async findMessagesByIdentifier(_identifier) { throw new Error('not implemented'); }
  async createMessage(_payload) { throw new Error('not implemented'); }
  async markUserMessagesRead(_identifier) { throw new Error('not implemented'); }
  async markAdminMessagesRead(_identifier) { throw new Error('not implemented'); }
  async findAdminChatSessions() { throw new Error('not implemented'); }
  async findLastMessageBySessionId(_sessionIdOrUserId) { throw new Error('not implemented'); }
  async countUnreadFromUserBySession(_sessionIdOrUserId, _userId) { throw new Error('not implemented'); }
  async findUserById(_id) { throw new Error('not implemented'); }
}

module.exports = IChatRepository;
