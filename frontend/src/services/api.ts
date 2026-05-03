import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getValidToken } from '@/utils/tokenManager';
import { handleUnauthorizedError } from '@/utils/authUtils';
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query';

/**
 * Cấu hình API
 */
const API_CONFIG = {
  DEFAULT_URL: 'http://localhost:8888/api',
  TIMEOUT: 300000, // Tăng lên 5 phút để tránh timeout khi gọi AI
  HEADERS: {
    ACCEPT: 'application/json',
    CONTENT_TYPE: 'application/json',
  },
} as const;

/**
 * Lấy URL gốc của API
 */
const getBaseUrl = (): string => {
  const apiBaseUrl = import.meta.env.VITE_API_URL || API_CONFIG.DEFAULT_URL;
  return apiBaseUrl.endsWith('/api') ? apiBaseUrl : `${apiBaseUrl}/api`;
};

/**
 * Ghi log cấu hình API trong môi trường development
 */
const logApiConfig = (): void => {
  if (import.meta.env.DEV) {
  }
};

// Khởi tạo cấu hình API
logApiConfig();

/**
 * Chuẩn bị headers cho các request API
 */
const prepareHeaders = async (headers: Headers): Promise<Headers> => {
  // Lấy token hợp lệ (tự động làm mới nếu cần)
  const token = await getValidToken();

  // Thêm header Authorization nếu có token
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  } else {
    // Dự phòng dùng token từ localStorage
    const localToken = localStorage.getItem('token');
    if (localToken) {
      headers.set('authorization', `Bearer ${localToken}`);
    }
  }

  // Thêm các header chuẩn
  headers.set('Accept', API_CONFIG.HEADERS.ACCEPT);
  headers.set('Content-Type', API_CONFIG.HEADERS.CONTENT_TYPE);

  return headers;
};

/**
 * Base query cho các request API
 */
const baseQuery = fetchBaseQuery({
  baseUrl: getBaseUrl(),
  prepareHeaders,
  timeout: API_CONFIG.TIMEOUT,
});

/**
 * Kiểm tra xem lỗi có phải là 401 Unauthorized không
 */
const isUnauthorizedError = (error: any): boolean => {
  return error?.status === 401 || error?.data?.error?.statusCode === 401;
};

/**
 * Ghi log lỗi API trong môi trường development
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const logApiError = (_args: string | FetchArgs, _error: any): void => {
  // Logging đã được chuyển sang backend logger — frontend không cần log ở đây
};

/**
 * Base query nâng cao: tự động đăng xuất khi nhận lỗi 401
 */
const baseQueryWithAutoLogout: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  try {
    const result = await baseQuery(args, api, extraOptions);

    if (result.error) {
      logApiError(args, result.error);

      // Xử lý lỗi 401
      if (isUnauthorizedError(result.error)) {
        const normalizedError = {
          status: 401,
          data: result.error?.data || result.error,
        };
        handleUnauthorizedError(normalizedError);
      }
    }

    return result;
  } catch (error) {
    console.error('💥 Lỗi API không mong đợi:', error);
    return {
      error: {
        status: 'FETCH_ERROR',
        error: String(error),
      },
    };
  }
};

// Tạo API service
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAutoLogout,
  tagTypes: [
    'Product',
    'Category',
    'User',
    'CurrentUser',
    'Addresses',
    'Cart',
    'CartCount',
    'Order',
    'Review',
    'PaymentMethod',
    'AdminDashboard',
    'AdminStats',
    'AdminOrder',
    'AdminProduct',
    'AdminUser',
    'Upload',
    'WarrantyPackages',
    'Images',
    'News',
    'DiscountCodes',
    'Wishlist',
  ],
  endpoints: () => ({}),
});

// Factory function để tạo baseQuery với prefix URL tùy chỉnh
export const createPrefixedBaseQuery = (
  prefix: string = ''
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> => {
  return async (args, api, extraOptions) => {
    // Thêm prefix vào URL
    const adjustedArgs =
      typeof args === 'string'
        ? `${prefix}${args}`
        : { ...args, url: `${prefix}${args.url}` };

    // Sử dụng baseQueryWithAutoLogout để xử lý request và lỗi 401
    return baseQueryWithAutoLogout(adjustedArgs, api, extraOptions);
  };
};

// Export baseQueryWithAutoLogout để tái sử dụng ở các API service khác
export { baseQueryWithAutoLogout, baseQuery };

// Export hooks dùng trong các component
export const {
  // Chưa có endpoint nào được định nghĩa
} = api;

