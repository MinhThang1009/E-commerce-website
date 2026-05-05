// Auth DTO factory — pure function. Strip mọi trường nhạy cảm trước khi trả response.
// User model có toJSON() đã loại bỏ password/otp/resetToken/stripeCustomerId — DTO
// delegate vào đó để giữ 1 nơi quản lý sanitization (nếu thêm field nhạy cảm thì
// chỉ cần update toJSON).

function toAuthUserDto(user) {
  if (!user) return null;
  return typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
}

module.exports = { toAuthUserDto };
