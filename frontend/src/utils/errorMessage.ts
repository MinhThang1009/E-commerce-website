/**
 * Helper trích xuất thông báo lỗi từ error unknown.
 * Hỗ trợ: Error instance, RTK/axios response shape, plain string.
 */
export function getErrorMsg(
  error: unknown,
  fallback = 'Lỗi không xác định'
): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;

    // RTK Query shape: error.data.message
    const data = e.data as Record<string, unknown> | undefined;
    if (data && typeof data.message === 'string') return data.message;

    // Axios shape: error.response.data.message
    const response = e.response as Record<string, unknown> | undefined;
    if (response) {
      const rData = response.data as Record<string, unknown> | undefined;
      if (rData && typeof rData.message === 'string') return rData.message;
    }

    // Generic: error.message
    if (typeof e.message === 'string') return e.message;
  }

  if (typeof error === 'string') return error;

  return fallback;
}
