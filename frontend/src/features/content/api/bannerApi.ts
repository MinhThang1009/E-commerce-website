import { api } from '@/services/api';

export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  position: 'home_hero' | 'home_middle' | 'sidebar';
  isActive: boolean;
  priority: number;
}

interface BannersResponse { status: string; data: Banner[] }
interface BannerResponse  { status: string; data: Banner }

interface BannerPayload {
  title: string;
  imageUrl: string;
  linkUrl?: string;
  position: 'home_hero' | 'home_middle' | 'sidebar';
  isActive: boolean;
  priority: number;
}

export const bannerApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBanners: builder.query<BannersResponse, { position?: string; isActive?: boolean } | void>({
      query: (params) => ({ url: '/banners', params: params ?? {} }),
      providesTags: ['Banner'],
    }),
    createBanner: builder.mutation<BannerResponse, BannerPayload>({
      query: (body) => ({ url: '/banners', method: 'POST', body }),
      invalidatesTags: ['Banner'],
    }),
    updateBanner: builder.mutation<BannerResponse, { id: string } & Partial<BannerPayload>>({
      query: ({ id, ...body }) => ({ url: `/banners/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Banner'],
    }),
    deleteBanner: builder.mutation<{ status: string }, string>({
      query: (id) => ({ url: `/banners/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Banner'],
    }),
  }),
});

export const {
  useGetBannersQuery,
  useCreateBannerMutation,
  useUpdateBannerMutation,
  useDeleteBannerMutation,
} = bannerApi;
