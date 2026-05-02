import axios from 'axios';
import { getValidToken } from '@/utils/tokenManager';
import { handleUnauthorizedError } from '@/utils/authUtils';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8888/api';

// Tạo axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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
  }
);

// Response interceptor để xử lý lỗi
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Ghi log lỗi trong môi trường development
    if (import.meta.env.DEV) {
      console.group('🚨 Lỗi API Client');
      console.log('URL:', error.config?.url);
      console.log('Status:', error.response?.status);
      console.log('Data:', error.response?.data);
      console.groupEnd();
    }

    // Xử lý lỗi 401
    if (error.response?.status === 401) {
      handleUnauthorizedError({
        status: 401,
        data: error.response.data,
      });
    }

    return Promise.reject(error);
  }
);

export default apiClient;
