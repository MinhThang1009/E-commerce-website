/**
 * @file emailCampaignApi.ts
 * @layer API Client
 * @feature content
 * @description API client functions cho feature content
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface Campaign {
  id: string;
  subject: string;
  content: string;
  status: 'draft' | 'sent';
  sentAt: string | null;
  createdAt: string;
}

interface CampaignsResponse {
  status: string;
  data: Campaign[];
}
interface CampaignResponse {
  status: string;
  data: Campaign;
}
interface CreateCampaignRequest {
  subject: string;
  content: string;
}

// === Query Keys ===

export const emailCampaignKeys = {
  all: ['email-campaigns'] as const,
  list: () => [...emailCampaignKeys.all, 'list'] as const,
};

// === Query Hooks ===

export function useGetEmailCampaignsQuery() {
  return useQuery<CampaignsResponse>({
    queryKey: emailCampaignKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get('/email-campaigns');
      return data;
    },
  });
}

// === Mutation Hooks ===

export function useCreateEmailCampaignMutation() {
  const queryClient = useQueryClient();
  return useMutation<CampaignResponse, Error, CreateCampaignRequest>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post('/email-campaigns', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailCampaignKeys.all });
    },
  });
}

export function useDeleteEmailCampaignMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ status: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/email-campaigns/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailCampaignKeys.all });
    },
  });
}

export function useSendEmailCampaignMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ status: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await apiClient.post(`/email-campaigns/${id}/send`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailCampaignKeys.all });
    },
  });
}
