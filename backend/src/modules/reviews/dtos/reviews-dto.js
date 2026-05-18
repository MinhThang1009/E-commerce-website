/**
 * @file reviewsDto.js
 * @layer DTO
 * @module reviews
 * @description Data transfer objects cho reviews
 */
// Reviews DTO — service đã trả Sequelize instance kèm Product/User include.
// Pass-through cho phép Express serialize qua toJSON() tự động.
function toReviewDto(review) {
  if (!review) return null;
  return review;
}

module.exports = { toReviewDto };
