/**
 * @file discount-code-dto.js
 * @layer DTO
 * @module discount-code
 * @description Data transfer objects cho discount-code — shape response data
 */

// Trả về plain object từ Sequelize instance, loại bỏ metadata nội bộ
function toDto(entity) {
  if (!entity) return null;
  return typeof entity.toJSON === 'function' ? entity.toJSON() : { ...entity };
}

function toDtoList(entities) {
  return (entities || []).map(toDto);
}

module.exports = { toDto, toDtoList };
