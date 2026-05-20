/**
 * @file api-client.ts
 * @layer Lib
 * @feature global
 * @description Global Axios instance — dùng chung cho mọi feature API call.
 * Các API hook (TanStack Query) dùng instance này làm base.
 */
import axios from 'axios';
import { getValidToken } from '@/utils/token-manager';
import { handleUnauthorizedError } from '@/utils/auth-utils';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8888/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await getValidToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthEndpoint = /\/(login|register|refresh-token|google)/.test(url);

    if (error.response?.status === 401 && !isAuthEndpoint) {
      handleUnauthorizedError({ status: 401, data: error.response.data });
    }

    return Promise.reject(error);
  },
);

export default apiClient;
