// Barrel export feature chat — public surface

// Components
export { default as SupportChat } from './components/SupportChat';

// API endpoints (TanStack Query)
export {
  useGetChatHistoryQuery,
  useGetAdminChatListQuery,
} from './api/chatApi';
export type { ChatMessage, AdminChatListResponse } from './api/chatApi';
