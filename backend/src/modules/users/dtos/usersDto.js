/**
 * @file usersDto.js
 * @layer DTO
 * @module users
 * @description Data transfer objects cho users
 */
// Users DTO factory — pure function, không class.
// User.toJSON() đã strip password/otp/resetToken. Address là plain row, trả
// nguyên dữ liệu (không sensitive).

function toUserDto(user) {
  if (!user) return null;
  return typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
}

function toAddressDto(address) {
  if (!address) return null;
  return typeof address.toJSON === 'function' ? address.toJSON() : { ...address };
}

module.exports = { toUserDto, toAddressDto };
