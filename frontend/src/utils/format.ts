/**
 * Định dạng giá sang tiền tệ Việt Nam
 * @param price - Giá cần định dạng (có thể là chuỗi hoặc số)
 * @returns Chuỗi giá đã định dạng
 */
export const formatPrice = (price: string | number): string => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;

  // Xử lý giá không hợp lệ
  if (isNaN(numPrice)) {
    return '0đ';
  }

  return `${numPrice.toLocaleString('vi-VN')}đ`;
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
 * Định dạng số theo locale Việt Nam
 * @param num - Số cần định dạng
 * @returns Chuỗi số đã định dạng
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString('vi-VN');
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
