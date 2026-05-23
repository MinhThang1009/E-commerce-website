// Hằng số toàn cục — tập trung tại đây, không hardcode rải rác trong controllers
module.exports = {
  // Phí vận chuyển
  SHIPPING_FREE_THRESHOLD: 5000000, // Miễn phí ship nếu subtotal >= 5,000,000 VND

  // JWT tokens — access expiry dùng từ env JWT_EXPIRES_IN, không cần constant
  JWT_REFRESH_EXPIRY: '30d',

  // Phân trang
  PAGINATION_DEFAULT_LIMIT: 20,
  PAGINATION_MAX_LIMIT: 100,

  // Upload
  MAX_UPLOAD_SIZE: 5 * 1024 * 1024, // 5MB — giới hạn kích thước file upload

  // OTP
  OTP_EXPIRY_MINUTES: 10,

  // Giỏ hàng
  MAX_CART_QUANTITY: 99,
};
