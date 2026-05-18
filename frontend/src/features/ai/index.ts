/**
 * @file index.ts
 * @layer Barrel
 * @feature ai
 * @description Public API exports cho feature ai
 */
// Barrel export feature AI — public surface

// Giao diện
export { default as ChatWidget } from './components/ChatWidget';

export { default as ChatWidgetPortal } from './components/ChatWidgetPortal';
export { default as ChatbotErrorBoundary } from './components/ChatbotErrorBoundary';
export { default as ChatMessage } from './components/ChatMessage';
export { default as ChatInput } from './components/ChatInput';
export { default as ChatSuggestions } from './components/ChatSuggestions';

// Hooks
export { useSpeechRecognition } from './hooks/use-speech-recognition';

// Dịch vụ API (TanStack Query)
export { useSendChatbotMessageMutation } from './services/chatbot-api';
