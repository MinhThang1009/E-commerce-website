// ChatPolicy — pure rules cho chat session access + ownership.

// canAccessSession: kiểm tra user/guest có quyền xem session messages.
// Rules:
//   - Admin: luôn có quyền
//   - User đã login: phải match userId (identifier === userId) HOẶC ít nhất 1 msg có userId của họ
//   - Guest: identifier phải là sessionId của họ + tất cả messages có sessionId trùng + không message nào có userId
function canAccessSession({ identifier, currentUserId, isAdmin, messages }) {
  if (isAdmin) return true;

  if (currentUserId) {
    return String(currentUserId) === String(identifier)
      || messages.some((m) => m.userId === currentUserId);
  }

  // Guest: messages phải hoàn toàn không có userId + đúng sessionId
  return messages.every((m) => m.sessionId === identifier && !m.userId);
}

// validateSendMessage: kiểm tra định danh để gửi message.
function validateSendMessage({ userId, sessionId }) {
  if (!userId && !sessionId) {
    return { valid: false, reason: 'Cần cung cấp sessionId cho guest chat' };
  }
  return { valid: true };
}

module.exports = {
  canAccessSession,
  validateSendMessage,
};
