import { useCallback } from 'react';
import { handleUnauthorizedError, getErrorMessage } from '@/utils/authUtils';
import { toast } from '@/utils/toast';

/**
 * Custom hook xử lý lỗi API một cách nhất quán trong toàn ứng dụng
 */
export const useErrorHandler = () => {
  const handleError = useCallback((error: any, showToast: boolean = true) => {
    // Xử lý lỗi 401 với tự động đăng xuất
    if (handleUnauthorizedError(error)) {
      return; // Đã xử lý auto logout, không cần hiển thị toast thêm
    }

    // Xử lý các lỗi khác
    if (showToast) {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    }

    // Ghi log lỗi để debug
    console.error('Lỗi API:', error);
  }, []);

  const handleSuccess = useCallback((message: string, duration?: number) => {
    toast.success(message, duration);
  }, []);

  const handleWarning = useCallback((message: string, duration?: number) => {
    toast.warning(message, duration);
  }, []);

  return {
    handleError,
    handleSuccess,
    handleWarning,
  };
};

export default useErrorHandler;
