/**
 * @file admin-dto.js
 * @layer DTO
 * @module admin
 * @description Data transfer objects cho admin — shape response data
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
