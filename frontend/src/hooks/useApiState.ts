/**
 * Custom hook xử lý trạng thái API
 * Cung cấp trạng thái loading, error và success nhất quán
 */

import { useCallback, useMemo, useState } from 'react';
import { parseError, isRetryableError } from '@/utils/errorUtils';

interface ApiStateResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
  isError: boolean;
  isSuccess: boolean;
  isEmpty: boolean;
  retry: () => void;
  canRetry: boolean;
}

interface UseApiStateParams<T> {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
  refetch?: () => void;
  isArray?: boolean;
}

/**
 * Custom hook xử lý trạng thái API
 */
export const useApiState = <T = unknown>({
  data,
  isLoading,
  error,
  refetch,
  isArray = false,
}: UseApiStateParams<T>): ApiStateResult<T> => {
  const isError = !!error;
  const isSuccess = !isLoading && !isError && data !== undefined;

  const isEmpty = useMemo(() => {
    if (isLoading || isError) return false;
    if (data === undefined || data === null) return true;

    if (isArray) {
      return Array.isArray(data) && data.length === 0;
    }

    if (typeof data === 'object') {
      return Object.keys(data).length === 0;
    }

    return false;
  }, [data, isLoading, isError, isArray]);

  const canRetry = useMemo(() => {
    if (!isError || !refetch) return false;
    return isRetryableError(error);
  }, [isError, error, refetch]);

  const retry = useCallback(() => {
    if (refetch && canRetry) {
      refetch();
    }
  }, [refetch, canRetry]);

  return {
    data,
    isLoading,
    error,
    isError,
    isSuccess,
    isEmpty,
    retry,
    canRetry,
  };
};

/**
 * Hook xử lý dữ liệu phân trang
 */
export const usePaginatedApiState = <T = unknown>({
  data,
  isLoading,
  error,
  refetch,
}: UseApiStateParams<T>) => {
  const baseState = useApiState({
    data,
    isLoading,
    error,
    refetch,
    isArray: false,
  });

  const items = useMemo(() => {
    if (!data || typeof data !== 'object') return [];

    // Xử lý các cấu trúc response phân trang (data là mảng trực tiếp)
    if ('data' in data && Array.isArray((data as Record<string, unknown>).data)) {
      return (data as Record<string, unknown>).data as T[];
    }

    if (Array.isArray(data)) {
      return data;
    }

    return [];
  }, [data]);

  const pagination = useMemo(() => {
    if (!data || typeof data !== 'object') return null;

    const responseData = ((data as Record<string, unknown>).data || data) as Record<string, unknown>;

    return {
      currentPage: responseData.currentPage || 1,
      totalPages: responseData.totalPages || 1,
      totalItems: responseData.totalItems || 0,
      hasNextPage: responseData.hasNextPage || false,
      hasPreviousPage: responseData.hasPreviousPage || false,
    };
  }, [data]);

  const isEmpty = items.length === 0 && !isLoading && !error;

  return {
    ...baseState,
    items,
    pagination,
    isEmpty,
  };
};

/**
 * Hook xử lý trạng thái submit form
 */
export const useSubmissionState = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (
      submitFn: () => Promise<unknown>,
      options?: {
        onSuccess?: (data: unknown) => void;
        onError?: (error: unknown) => void;
        resetAfter?: number;
      }
    ) => {
      setIsSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(false);

      try {
        const result = await submitFn();
        setSubmitSuccess(true);

        if (options?.onSuccess) {
          options.onSuccess(result);
        }

        // Đặt lại trạng thái success sau khoảng thời gian chỉ định
        if (options?.resetAfter) {
          setTimeout(() => {
            setSubmitSuccess(false);
          }, options.resetAfter);
        }

        return result;
      } catch (error) {
        const parsedError = parseError(error);
        setSubmitError(parsedError);

        if (options?.onError) {
          options.onError(parsedError);
        }

        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, []);

  return {
    isSubmitting,
    submitError,
    submitSuccess,
    handleSubmit,
    reset,
  };
};

