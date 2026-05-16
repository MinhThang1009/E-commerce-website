import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

export interface ChatMessage {
  id: string;
  userId: string;
  sessionId: string;
  senderId: string;
  content: string;
  isFromAdmin: boolean;
  isRead: boolean;
  createdAt: string;
}

export interface AdminChatListResponse {
  userId: string;
  sessionId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  } | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

// === Query Keys ===

export const chatKeys = {
  all: ['chat'] as const,
  history: (identifier: string) => [...chatKeys.all, 'history', identifier] as const,
  adminList: () => [...chatKeys.all, 'admin-list'] as const,
};

// === Query Hooks ===

export function useGetChatHistoryQuery(
  identifier: string,
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery<{ status: string; data: ChatMessage[] }>({
    queryKey: chatKeys.history(identifier),
    queryFn: async () => {
      const { data } = await apiClient.get(`/chat/${identifier}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!identifier,
  });
}

export function useGetAdminChatListQuery() {
  return useQuery<{ status: string; data: AdminChatListResponse[] }>({
    queryKey: chatKeys.adminList(),
    queryFn: async () => {
      const { data } = await apiClient.get('/chat/admin/list');
      return data;
    },
  });
}
