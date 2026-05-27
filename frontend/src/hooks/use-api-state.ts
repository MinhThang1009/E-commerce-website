/**
 * @file useApiState.ts
 * @layer Hook
 * @feature global
 * @description Shared React hook
 */
/**
 * Custom hook xử lý trạng thái API
 * Cung cấp trạng thái loading, error và success nhất quán
 */

import { useCallback, useMemo } from 'react';
import { isRetryableError } from '@/utils/error-utils';

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
