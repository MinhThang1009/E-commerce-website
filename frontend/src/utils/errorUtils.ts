/**
 * @file errorUtils.ts
 * @layer Utility
 * @feature global
 * @description Helper utility function
 */
import i18next from 'i18next';

/**
 * Các loại lỗi phổ biến trong ứng dụng
 */
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Interface lỗi chuẩn
 */
export interface AppError {
  type: ErrorType;
  message: string;
  code?: string | number;
  details?: unknown;
}

const ERROR_TYPE_TO_KEY: Record<ErrorType, string> = {
  [ErrorType.NETWORK_ERROR]: 'errors.network',
  [ErrorType.VALIDATION_ERROR]: 'errors.validation',
  [ErrorType.AUTHENTICATION_ERROR]: 'errors.authentication',
  [ErrorType.AUTHORIZATION_ERROR]: 'errors.authorization',
  [ErrorType.NOT_FOUND_ERROR]: 'errors.notFound',
  [ErrorType.SERVER_ERROR]: 'errors.server',
  [ErrorType.UNKNOWN_ERROR]: 'errors.unknown',
};

// Helper: truy cập thuộc tính an toàn trên unknown object
function prop(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

function str(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

function num(val: unknown): number | undefined {
  return typeof val === 'number' ? val : undefined;
}

// Lấy error type theo status code
function errorTypeByStatus(status: number): ErrorType | undefined {
  if (status === 400) return ErrorType.VALIDATION_ERROR;
  if (status === 401) return ErrorType.AUTHENTICATION_ERROR;
  if (status === 403) return ErrorType.AUTHORIZATION_ERROR;
  if (status === 404) return ErrorType.NOT_FOUND_ERROR;
  if (status >= 500) return ErrorType.SERVER_ERROR;
  return undefined;
}

// Trích xuất message từ data object (hỗ trợ data.message và data.error.message)
function extractMessage(data: unknown): string {
  const msg = str(prop(data, 'message'));
  if (msg) return msg;
  const errObj = prop(data, 'error');
  const errMsg = str(prop(errObj, 'message'));
  if (errMsg) return errMsg;
  return 'Unknown error';
}

/**
 * Phân tích lỗi từ các nguồn khác nhau
 */
export const parseError = (error: unknown): AppError => {
  // Lỗi có status trực tiếp (legacy format hoặc error object tự tạo)
  const status = num(prop(error, 'status'));
  const statusStr = str(prop(error, 'status'));
  const data = prop(error, 'data');

  if (status) {
    const message = extractMessage(data);
    const errorType = errorTypeByStatus(status);
    if (errorType) {
      return { type: errorType, message, code: status, details: data };
    }
  }

  if (statusStr === 'ERR_NETWORK') {
    return {
      type: ErrorType.NETWORK_ERROR,
      message: extractMessage(data),
      code: statusStr,
      details: error,
    };
  }

  // Lỗi axios (AxiosError có thuộc tính code)
  const code = str(prop(error, 'code'));
  if (code === 'ERR_NETWORK' || code === 'ECONNABORTED') {
    return {
      type: ErrorType.NETWORK_ERROR,
      message: str(prop(error, 'message')) || i18next.t('errors.network'),
      code,
      details: error,
    };
  }

  // Lỗi axios với response (error.response.status)
  const response = prop(error, 'response');
  const axiosStatus = num(prop(response, 'status'));
  if (axiosStatus) {
    const responseData = prop(response, 'data');
    const axiosMessage =
      extractMessage(responseData) !== 'Unknown error'
        ? extractMessage(responseData)
        : str(prop(error, 'message')) || 'Unknown error';

    const errorType = errorTypeByStatus(axiosStatus);
    if (errorType) {
      return { type: errorType, message: axiosMessage, code: axiosStatus, details: responseData };
    }
  }

  // Lỗi JavaScript
  if (error instanceof Error) {
    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: error.message,
      details: error,
    };
  }

  // Lỗi dạng chuỗi
  if (typeof error === 'string') {
    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: error,
    };
  }

  // Lỗi không xác định mặc định
  return {
    type: ErrorType.UNKNOWN_ERROR,
    message: i18next.t('errors.unknown'),
    details: error,
  };
};

/**
 * Lấy thông báo lỗi thân thiện với người dùng
 */
export const getErrorMessage = (error: unknown): string => {
  const parsedError = parseError(error);

  if (parsedError.message && !parsedError.message.includes('Unknown error')) {
    return parsedError.message;
  }

  return i18next.t(ERROR_TYPE_TO_KEY[parsedError.type]);
};

/**
 * Tạo hàm xử lý lỗi cho component
 */
export const createErrorHandler = (onError?: (error: AppError) => void) => {
  return (error: unknown) => {
    const parsedError = parseError(error);

    if (onError) {
      onError(parsedError);
    }

    return parsedError;
  };
};

/**
 * Hàm thử lại với chiến lược tăng dần thời gian chờ (exponential backoff)
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> => {
  let lastError: unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (i === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, i);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Kiểm tra xem lỗi có thể thử lại không
 */
export const isRetryableError = (error: unknown): boolean => {
  const parsedError = parseError(error);

  return [ErrorType.NETWORK_ERROR, ErrorType.SERVER_ERROR].includes(parsedError.type);
};

/**
 * Định dạng lỗi để ghi log
 */
export const formatErrorForLogging = (error: unknown): string => {
  const parsedError = parseError(error);

  return JSON.stringify(
    {
      type: parsedError.type,
      message: parsedError.message,
      code: parsedError.code,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    },
    null,
    2,
  );
};

// Alias để backward compat với errorMessage.ts
export function getErrorMsg(error: unknown, fallback?: string): string {
  // Wrapper của getErrorMessage với fallback param tùy chọn
  const msg = getErrorMessage(error);
  return fallback && msg.includes('không xác định') ? fallback : msg;
}
