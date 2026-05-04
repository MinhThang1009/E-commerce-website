import { api } from './api';
import apiClient from './apiClient';

// Kiểu dữ liệu cho quản lý sản phẩm admin
export interface CreateProductRequest {
  name: string;
  baseName?: string;
  description: string;
  shortDescription: string;
  price?: number | string;
  comparePrice?: number | string | null;
  stock?: number;
  sku?: string;
  images: string[];
  status: 'active' | 'inactive' | 'draft';
  featured?: boolean;
  categoryIds: string[];
  condition?: 'new' | 'like-new' | 'used' | 'refurbished';
  warrantyMonths?: number;
  specifications?: Array<{
    name: string;
    value: string;
    category?: string;
  }>;
  attributes?: Array<{
    name: string;
    value: string;
  }>;
  variants?: Array<{
    name: string;
    variantName?: string;
    sku?: string;
    price: number | string;
    compareAtPrice?: number | string | null;
    stockQuantity?: number;
    stock?: number;
    isDefault?: boolean;
    isAvailable?: boolean;
    attributes?: Record<string, string>;
    specifications?: Record<string, any>;
    images?: string[];
  }>;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  warrantyPackageIds?: string[];
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {
  id: string;
}

export interface AdminProductsFilter {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  priceMin?: number;
  priceMax?: number;
  stockMin?: number;
  stockMax?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface AdminProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  comparePrice?: number;
  stock: number;
  sku: string;
  images: string[];
  status: string;
  Categories: Array<{
    id: string;
    name: string;
  }>;
  attributes?: Array<{
    name: string;
    value: string;
  }>;
  variants?: Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductsResponse {
  status: string;
  data: {
    products: AdminProduct[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  };
}

export interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

export const adminProductApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Lấy danh sách sản phẩm admin có bộ lọc
    getAdminProducts: builder.query<
      AdminProductsResponse,
      AdminProductsFilter | void
    >({
      query: (filters = {}) => ({
        url: '/admin/products',
        params: (filters as AdminProductsFilter | undefined) ?? {},
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.products.map(({ id }) => ({
                type: 'Product' as const,
                id,
              })),
              { type: 'Product', id: 'ADMIN_LIST' },
            ]
          : [{ type: 'Product', id: 'ADMIN_LIST' }],
    }),

    // Tạo sản phẩm mới
    createProduct: builder.mutation<
      ApiResponse<AdminProduct>,
      CreateProductRequest
    >({
      query: (productData) => ({
        url: '/admin/products',
        method: 'POST',
        body: productData,
      }),
      invalidatesTags: [{ type: 'Product', id: 'ADMIN_LIST' }],
    }),

    // Cập nhật sản phẩm
    updateProduct: builder.mutation<
      ApiResponse<AdminProduct>,
      UpdateProductRequest
    >({
      query: ({ id, ...productData }) => ({
        url: `/admin/products/${id}`,
        method: 'PUT',
        body: productData,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Product', id },
        { type: 'Product', id: 'ADMIN_LIST' },
        // Invalidate public product list cache để frontend user thấy thay đổi ngay
        { type: 'Product', id: 'LIST' },
      ],
    }),

    // Xóa sản phẩm
    deleteProduct: builder.mutation<ApiResponse<void>, string>({
      query: (id) => ({
        url: `/admin/products/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'Product', id },
        { type: 'Product', id: 'ADMIN_LIST' },
        // Invalidate public product list cache để sản phẩm bị xóa biến mất ngay
        { type: 'Product', id: 'LIST' },
      ],
    }),

    // Lấy thông tin một sản phẩm dành cho admin
    getAdminProductById: builder.query<ApiResponse<AdminProduct>, string>({
      query: (id) => `/admin/products/${id}`,
      transformResponse: (response: any) => {
        if (response?.data?.product) {
          const product = response.data.product;
          
          // Hàm trợ giúp: parse JSON nếu value là string
          const parseIfString = (val: any) => {
            if (typeof val === 'string') {
              try { return JSON.parse(val); } catch { return {}; }
            }
            return val || {};
          };

          if (product.variants) {
            product.variants = product.variants.map((v: any) => ({
              ...v,
              attributes: parseIfString(v.attributes),
              attributeValues: parseIfString(v.attributeValues || v.attributes)
            }));
          }

          if (product.attributes) {
            product.attributes = product.attributes.map((attr: any) => ({
              ...attr,
              values: typeof attr.values === 'string' ? JSON.parse(attr.values) : (attr.values || [])
            }));
          }
        }
        return response;
      },
      providesTags: (result, error, id) => [{ type: 'Product', id }],
    }),

    // Nhân bản sản phẩm
    cloneProduct: builder.mutation<ApiResponse<AdminProduct>, string>({
      query: (id) => ({
        url: `/admin/products/${id}/clone`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'Product', id: 'ADMIN_LIST' }],
    }),

    // Cập nhật trạng thái sản phẩm
    updateProductStatus: builder.mutation<ApiResponse<AdminProduct>, { id: string; status?: string }>({
      query: ({ id, status }) => ({
        url: `/admin/products/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Product', id },
        { type: 'Product', id: 'ADMIN_LIST' },
      ],
    }),
  }),
});

export const {
  useGetAdminProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useGetAdminProductByIdQuery,
  useCloneProductMutation,
  useUpdateProductStatusMutation,
  useLazyGetAdminProductsQuery,
} = adminProductApi;

class AdminProductService {
  async createProduct(productData: CreateProductRequest) {
    const response = await apiClient.post('/admin/products', productData);
    return response.data;
  }
}

export const adminProductService = new AdminProductService();

