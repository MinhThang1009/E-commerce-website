import { useState, useEffect } from 'react';

/**
 * Hook trì hoãn cập nhật giá trị cho đến khi hết thời gian delay
 * Hữu ích cho ô tìm kiếm để tránh gọi API quá nhiều khi đang gõ
 *
 * @param value Giá trị cần debounce
 * @param delay Thời gian trì hoãn tính bằng millisecond
 * @returns Giá trị sau khi debounce
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Đặt timeout để cập nhật giá trị debounce sau khoảng delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Hủy timeout nếu giá trị thay đổi trước khi hết delay
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

