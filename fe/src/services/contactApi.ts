import { api } from './api';

export interface NewsletterSubscriptionRequest {
  email: string;
}

export interface FeedbackRequest {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  content: string;
}

export interface ContactResponse {
  status: string;
  message: string;
  data?: any;
}

export const contactApi = api.injectEndpoints({
  endpoints: (builder) => ({
    subscribeNewsletter: builder.mutation<ContactResponse, NewsletterSubscriptionRequest>({
      query: (body) => ({
        url: '/contact/newsletter',
        method: 'POST',
        body,
      }),
    }),
    sendFeedback: builder.mutation<ContactResponse, FeedbackRequest>({
      query: (body) => ({
        url: '/contact/feedback',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useSubscribeNewsletterMutation,
  useSendFeedbackMutation,
} = contactApi;
