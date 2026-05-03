import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Message } from '../types/Message';

const STORAGE_KEY_MESSAGES = 'chat_messages';
const STORAGE_KEY_SESSION = 'chat_session_id';

// Tạo sessionId mới cho phiên trò chuyện — gọi từ ngoài reducer, truyền vào qua payload
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
  } catch {}
  const newId = createSessionId();
  try { localStorage.setItem(STORAGE_KEY_SESSION, newId); } catch {}
  return newId;
};

// Lưu messages vào localStorage để persist qua navigation
export const saveMessagesToStorage = (messages: Message[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  } catch {}
};

// Lưu sessionId vào localStorage — gọi từ component qua useEffect, không gọi trong reducer
export const saveSessionIdToStorage = (sessionId: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY_SESSION, sessionId);
  } catch {}
};

interface ChatState {
  messages: Message[];
  isOpen: boolean;
  sessionId: string;
  chatHistory: Record<string, Message[]>; // userId -> danh sách tin nhắn
}

const initialState: ChatState = {
  messages: loadMessagesFromStorage(),
  isOpen: false,
  sessionId: loadSessionId(),
  chatHistory: {},
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    setMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages = action.payload;
    },
    // Nhận newSessionId từ payload — non-deterministic calls (Date.now, Math.random) phải ở ngoài reducer
    clearMessages: (state, action: PayloadAction<string>) => {
      state.messages = [];
      state.sessionId = action.payload;
    },
    toggleChat: (state) => {
      state.isOpen = !state.isOpen;
    },
    openChat: (state) => {
      state.isOpen = true;
    },
    closeChat: (state) => {
      state.isOpen = false;
    },
    // Lưu lịch sử chat cho một người dùng
    saveChatHistory: (state, action: PayloadAction<{ userId: string }>) => {
      const { userId } = action.payload;
      if (userId && state.messages.length > 0) {
        state.chatHistory[userId] = [...state.messages];
      }
    },
    // Tải lịch sử chat của một người dùng
    loadChatHistory: (state, action: PayloadAction<{ userId: string }>) => {
      const { userId } = action.payload;
      if (userId && state.chatHistory[userId]) {
        state.messages = [...state.chatHistory[userId]];
      } else {
        state.messages = [];
      }
    },
  },
});

export const {
  addMessage,
  setMessages,
  clearMessages,
  toggleChat,
  openChat,
  closeChat,
  saveChatHistory,
  loadChatHistory,
} = chatSlice.actions;

export default chatSlice.reducer;
