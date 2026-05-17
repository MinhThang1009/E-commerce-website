/**
 * @file format.ts
 * @layer Utility
 * @feature global
 * @description Helper utility function
 */
import i18next from 'i18next';

export const getLocale = (): 'vi-VN' | 'en-US' =>
  i18next.language === 'vi' ? 'vi-VN' : 'en-US';

export const formatPrice = (price: string | number): string => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;

  // Xử lý giá không hợp lệ
  if (isNaN(numPrice)) {
    return `0 ${i18next.t('common.currencySymbol')}`;
  }

  // Luôn dùng vi-VN locale cho VND — trang thương mại Việt Nam, en-US trả về ₫1,299,000 (prefix) không đúng
  // vi-VN trả về "1.299.000 ₫" (suffix với khoảng trắng)
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(numPrice);
};

/**
 * Định dạng giá sang tiền tệ USD
 * @param price - Giá cần định dạng (có thể là chuỗi hoặc số)
 * @returns Chuỗi giá đã định dạng
 */
export const formatPriceUSD = (price: string | number): string => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;

  // Xử lý giá không hợp lệ
  if (isNaN(numPrice)) {
    return '$0.00';
  }

  return `$${numPrice.toFixed(2)}`;
};

/**
 * Định dạng số theo locale hiện tại
 * @param num - Số cần định dạng
 * @returns Chuỗi số đã định dạng
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString(getLocale());
};

// Định dạng ngày theo locale hiện tại — dùng chung thay cho các formatDate local trong từng component
export const formatDate = (d: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(getLocale(), options ?? { dateStyle: 'medium' }).format(date);
};

/**
 * Phân tích giá từ chuỗi sang số
 * @param price - Chuỗi giá cần phân tích
 * @returns Số sau khi phân tích hoặc 0 nếu không hợp lệ
 */
export const parsePrice = (price: string | number): number => {
  if (typeof price === 'number') {
    return price;
  }

  const parsed = parseFloat(price);
  return isNaN(parsed) ? 0 : parsed;
};

