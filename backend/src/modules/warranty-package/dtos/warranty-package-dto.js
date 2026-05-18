/**
 * @file warranty-package-dto.js
 * @layer DTO
 * @module warranty-package
 * @description Data transfer objects cho warranty-package — shape response data
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
