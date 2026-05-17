import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Message } from '@/features/ai/types/message.types';

const STORAGE_KEY_MESSAGES = 'chat_messages';
const STORAGE_KEY_SESSION = 'chat_session_id';

// Tạo sessionId mới cho phiên trò chuyện
export const createSessionId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Tải messages đã lưu từ localStorage để khôi phục lịch sử khi reload
const loadMessagesFromStorage = (): Message[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
};

// Tải sessionId từ localStorage — dùng lại nếu đã có để backend giữ context
const loadSessionId = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SESSION);
    if (saved) return saved;
  } catch {
    /* bỏ qua lỗi localStorage */
  }
  const newId = createSessionId();
  try {
    localStorage.setItem(STORAGE_KEY_SESSION, newId);
  } catch {
    /* bỏ qua lỗi localStorage */
  }
  return newId;
};

// Lưu messages vào localStorage để persist qua navigation
export const saveMessagesToStorage = (messages: Message[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  } catch {
    /* bỏ qua lỗi localStorage */
  }
};

// Lưu sessionId vào localStorage
export const saveSessionIdToStorage = (sessionId: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY_SESSION, sessionId);
  } catch {
    /* bỏ qua lỗi localStorage */
  }
};

interface ChatState {
  messages: Message[];
  isOpen: boolean;
  sessionId: string;
  chatHistory: Record<string, Message[]>;
}

interface ChatActions {
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  clearMessages: (newSessionId: string) => void;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  saveChatHistory: (userId: string) => void;
  loadChatHistory: (userId: string) => void;
}

export const useChatStore = create<ChatState & ChatActions>()(
  immer((set) => ({
    messages: loadMessagesFromStorage(),
    isOpen: false,
    sessionId: loadSessionId(),
    chatHistory: {},

    addMessage: (message) =>
      set((state) => {
        state.messages.push(message);
      }),

    setMessages: (messages) =>
      set((state) => {
        state.messages = messages;
      }),

    clearMessages: (newSessionId) =>
      set((state) => {
        state.messages = [];
        state.sessionId = newSessionId;
      }),

    toggleChat: () =>
      set((state) => {
        state.isOpen = !state.isOpen;
      }),

    openChat: () =>
      set((state) => {
        state.isOpen = true;
      }),

    closeChat: () =>
      set((state) => {
        state.isOpen = false;
      }),

    saveChatHistory: (userId) =>
      set((state) => {
        if (userId && state.messages.length > 0) {
          state.chatHistory[userId] = [...state.messages];
        }
      }),

    loadChatHistory: (userId) =>
      set((state) => {
        if (userId && state.chatHistory[userId]) {
          state.messages = [...state.chatHistory[userId]];
        } else {
          state.messages = [];
        }
      }),
  })),
);
