import { api } from './api';

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

export const chatApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getChatHistory: builder.query<{ status: string; data: ChatMessage[] }, string>({
      query: (identifier) => ({
        url: `/chat/${identifier}`,
        method: 'GET',
      }),
      providesTags: (result, error, identifier) => [{ type: 'Chat' as any, id: identifier }],
    }),

    getAdminChatList: builder.query<{ status: string; data: AdminChatListResponse[] }, void>({
      query: () => ({
        url: '/chat/admin/list',
        method: 'GET',
      }),
      providesTags: ['Chat' as any],
    }),
  }),
});

export const { useGetChatHistoryQuery, useGetAdminChatListQuery } = chatApi;
