/**
 * @file apiClient.ts
 * @layer Service
 * @feature global
 * @description Global service/API client setup
 */
// services/apiClient.ts — Plain Axios instance.
// Dùng cho calls không qua TanStack Query cache: file upload (multipart/form-data), OAuth flow, raw HTTP.
// Các API hook (TanStack Query) dùng instance này làm base cho mọi endpoint có cache + hook React.

import axios from 'axios';
import { getValidToken } from '@/utils/token-manager';
import { handleUnauthorizedError } from '@/utils/auth-utils';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8888/api';

// Tạo axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor để thêm auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getValidToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor để xử lý lỗi
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Xử lý lỗi 401 — bỏ qua auth endpoints (login/register/refresh)
    // vì 401 ở đây là sai credentials, không phải session expired
    const url = error.config?.url || '';
    const isAuthEndpoint = /\/(login|register|refresh-token|google)/.test(url);

    if (error.response?.status === 401 && !isAuthEndpoint) {
      handleUnauthorizedError({
        status: 401,
        data: error.response.data,
      });
    }

    return Promise.reject(error);
  },
);

export default apiClient;
