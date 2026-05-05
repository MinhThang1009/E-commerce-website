// Phase 42.14 — Unit tests cho Chat domain (ChatPolicy).
const ChatPolicy = require('../modules/chat/domain/policies/ChatPolicy');

describe('Chat Domain — ChatPolicy', () => {
  describe('canAccessSession', () => {
    test('admin → luôn true', () => {
      expect(ChatPolicy.canAccessSession({
        identifier: 'X', currentUserId: null, isAdmin: true, messages: [],
      })).toBe(true);
    });

    test('user login + identifier match userId → true', () => {
      expect(ChatPolicy.canAccessSession({
        identifier: '5', currentUserId: 5, isAdmin: false, messages: [],
      })).toBe(true);
    });

    test('user login + 1 message có userId của họ → true', () => {
      expect(ChatPolicy.canAccessSession({
        identifier: 'sess-1', currentUserId: 5, isAdmin: false,
        messages: [{ userId: 5, sessionId: 'sess-1' }, { userId: null, sessionId: 'sess-1' }],
      })).toBe(true);
    });

    test('user login + không match → false', () => {
      expect(ChatPolicy.canAccessSession({
        identifier: 'sess-other', currentUserId: 5, isAdmin: false,
        messages: [{ userId: 99, sessionId: 'sess-other' }],
      })).toBe(false);
    });

    test('guest + tất cả messages có sessionId match + không có userId → true', () => {
      expect(ChatPolicy.canAccessSession({
        identifier: 'sess-1', currentUserId: null, isAdmin: false,
        messages: [
          { userId: null, sessionId: 'sess-1' },
          { userId: null, sessionId: 'sess-1' },
        ],
      })).toBe(true);
    });

    test('guest + có message với userId → false (chiếm session của user)', () => {
      expect(ChatPolicy.canAccessSession({
        identifier: 'sess-1', currentUserId: null, isAdmin: false,
        messages: [{ userId: 99, sessionId: 'sess-1' }],
      })).toBe(false);
    });
  });

  describe('validateSendMessage', () => {
    test('có userId → valid', () => {
      expect(ChatPolicy.validateSendMessage({ userId: 5, sessionId: null })).toEqual({ valid: true });
    });

    test('có sessionId → valid', () => {
      expect(ChatPolicy.validateSendMessage({ userId: null, sessionId: 'sess' })).toEqual({ valid: true });
    });

    test('không có cả 2 → invalid', () => {
      const result = ChatPolicy.validateSendMessage({ userId: null, sessionId: null });
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/sessionId/);
    });
  });
});
