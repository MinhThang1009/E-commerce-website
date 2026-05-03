// Giao diện
export { default as ChatWidget } from './components/ChatWidget';
export { default as ChatWidgetSimple } from './components/ChatWidgetSimple';
export { default as ChatWidgetPortal } from './components/ChatWidgetPortal';
export { default as ChatMessage } from './components/ChatMessage';
export { default as ChatInput } from './components/ChatInput';
export { default as ChatSuggestions } from './components/ChatSuggestions';

// Hooks
export { useSpeechRecognition } from './hooks/useSpeechRecognition';

// Dịch vụ API
export { useSendChatbotMessageMutation } from './services/chatbotApi';

// Store Redux
export {
  addMessage,
  setMessages,
  clearMessages,
  toggleChat,
  openChat,
  closeChat,
  saveChatHistory,
  loadChatHistory,
} from './store/chatSlice';
