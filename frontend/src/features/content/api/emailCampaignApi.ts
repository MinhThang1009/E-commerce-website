import { api } from '@/services/api';

export interface Campaign {
  id: string;
  subject: string;
  content: string;
  status: 'draft' | 'sent';
  sentAt: string | null;
  createdAt: string;
}

interface CampaignsResponse { status: string; data: Campaign[] }
interface CampaignResponse  { status: string; data: Campaign }
interface CreateCampaignRequest { subject: string; content: string }

export const emailCampaignApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getEmailCampaigns: builder.query<CampaignsResponse, void>({
      query: () => '/email-campaigns',
      providesTags: ['EmailCampaign'],
    }),
    createEmailCampaign: builder.mutation<CampaignResponse, CreateCampaignRequest>({
      query: (body) => ({ url: '/email-campaigns', method: 'POST', body }),
      invalidatesTags: ['EmailCampaign'],
    }),
    deleteEmailCampaign: builder.mutation<{ status: string }, string>({
      query: (id) => ({ url: `/email-campaigns/${id}`, method: 'DELETE' }),
      invalidatesTags: ['EmailCampaign'],
    }),
    sendEmailCampaign: builder.mutation<{ status: string }, string>({
      query: (id) => ({ url: `/email-campaigns/${id}/send`, method: 'POST' }),
      invalidatesTags: ['EmailCampaign'],
    }),
  }),
});

export const {
  useGetEmailCampaignsQuery,
  useCreateEmailCampaignMutation,
  useDeleteEmailCampaignMutation,
  useSendEmailCampaignMutation,
} = emailCampaignApi;
