class ChatController {
  constructor({ chatService }) {
    this.chatService = chatService;
  }

  getChatHistory = async (req, res, next) => {
    try {
      const data = await this.chatService.getChatHistory({
        identifier: req.params.identifier,
        currentUserId: req.user?.id ?? null,
        isAdmin: req.user?.role === 'admin',
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getAdminChatList = async (req, res, next) => {
    try {
      const data = await this.chatService.getAdminChatList();
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  sendMessage = async (req, res, next) => {
    try {
      const message = await this.chatService.sendMessage({
        userId: req.user?.id ?? null,
        sessionId: req.body.sessionId,
        content: req.body.content,
      });
      res.status(201).json({ status: 'success', data: message });
    } catch (err) { next(err); }
  };

  markAsRead = async (req, res, next) => {
    try {
      const result = await this.chatService.markAsRead({
        identifier: req.params.identifier,
        isAdmin: req.user?.role === 'admin',
      });
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) { next(err); }
  };
}

module.exports = ChatController;
