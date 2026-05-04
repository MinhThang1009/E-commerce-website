// Hằng số toàn cục — tập trung tại đây, không hardcode rải rác trong controllers
module.exports = {
  // Điểm tích lũy loyalty
  POINTS_EARN_RATE: 100000,  // Cứ 100,000 VND chi tiêu = 1 điểm tích lũy
  POINTS_VALUE: 1000,        // 1 điểm = 1,000 VND giảm giá khi đổi

  // Phí vận chuyển
  SHIPPING_FREE_THRESHOLD: 2000000,  // Miễn phí ship nếu subtotal >= 2,000,000 VND
  SHIPPING_BASE_RATE: 30000,         // Phí ship cơ bản (VND)
  SHIPPING_WEIGHT_RATE: 5000,        // Thêm 5,000 VND mỗi kg vượt quá 2kg

  // JWT tokens
  JWT_ACCESS_EXPIRY: '7d',
  JWT_REFRESH_EXPIRY: '30d',

  // Phân trang
  PAGINATION_DEFAULT_LIMIT: 20,
  PAGINATION_MAX_LIMIT: 100,

  // Upload
  MAX_UPLOAD_SIZE: 5 * 1024 * 1024,  // 5MB — giới hạn kích thước file upload

  // OTP
  OTP_EXPIRY_MINUTES: 10,

  // Giỏ hàng
  MAX_CART_QUANTITY: 99,
};
