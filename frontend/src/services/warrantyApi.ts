import { api } from './api';
import { WarrantyPackage } from '@/features/catalog';

// Kiểu dữ liệu phản hồi
export interface WarrantyPackagesResponse {
  status: string;
  data: {
    warrantyPackages: WarrantyPackage[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface WarrantyPackageResponse {
  status: string;
  data: WarrantyPackage;
}

// Kiểu dữ liệu yêu cầu
export interface CreateWarrantyPackageRequest {
  name: string;
  description?: string;
  durationMonths: number;
  price: number;
  terms?: Record<string, any>;
  coverage?: string[];
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateWarrantyPackageRequest
  extends CreateWarrantyPackageRequest {
  id: string;
}

export interface WarrantyPackageFilters {
  page?: number;
  limit?: number;
  isActive?: boolean;
}

// Các endpoint API
export const warrantyApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Lấy tất cả gói bảo hành
    getWarrantyPackages: builder.query<
      WarrantyPackagesResponse,
      WarrantyPackageFilters | void
    >({
      query: (filters = {}) => ({
        url: '/warranty-packages',
        params: filters || {},
      }),
      providesTags: ['WarrantyPackages'],
    }),

    // Lấy gói bảo hành theo ID
    getWarrantyPackageById: builder.query<WarrantyPackageResponse, string>({
      query: (id) => `/warranty-packages/${id}`,
      providesTags: (result, error, id) => [{ type: 'WarrantyPackages', id }],
    }),

    // Tạo gói bảo hành mới
    createWarrantyPackage: builder.mutation<
      WarrantyPackageResponse,
      CreateWarrantyPackageRequest
    >({
      query: (data) => ({
        url: '/warranty-packages',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['WarrantyPackages'],
    }),

    // Cập nhật gói bảo hành
    updateWarrantyPackage: builder.mutation<
      WarrantyPackageResponse,
      UpdateWarrantyPackageRequest
    >({
      query: ({ id, ...data }) => ({
        url: `/warranty-packages/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        'WarrantyPackages',
        { type: 'WarrantyPackages', id },
      ],
    }),

    // Xóa gói bảo hành
    deleteWarrantyPackage: builder.mutation<
      { status: string; message: string },
      string
    >({
      query: (id) => ({
        url: `/warranty-packages/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        'WarrantyPackages',
        { type: 'WarrantyPackages', id },
      ],
    }),
  }),
});

// Export các hooks
export const {
  useGetWarrantyPackagesQuery,
  useGetWarrantyPackageByIdQuery,
  useCreateWarrantyPackageMutation,
  useUpdateWarrantyPackageMutation,
  useDeleteWarrantyPackageMutation,
} = warrantyApi;

