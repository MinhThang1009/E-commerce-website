// ChatMessageSentEvent — publish khi user/guest gửi tin nhắn support chat.
// Socket bridge có thể subscribe để emit realtime tới admin-room (Sprint 10
// adapter Socket).
module.exports = function ChatMessageSentEvent({ messageId, userId, sessionId, content, isFromAdmin }) {
  return {
    type: 'chat.messageSent',
    payload: { messageId, userId, sessionId, content, isFromAdmin },
    occurredAt: new Date().toISOString(),
  };
};
