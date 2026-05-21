'use strict';
/**
 * @file localize.js
 * @layer Utility
 * @module global
 * @description Helper utility: localize
 */

/**
 * Map field → [viKey, enKey] cho từng loại entity được i18n.
 */
const FIELD_MAPS = {
  product: [
    ['name', 'nameVi', 'nameEn'],
    ['shortDescription', 'shortDescriptionVi', 'shortDescriptionEn'],
    ['description', 'descriptionVi', 'descriptionEn'],
    ['seoTitle', 'seoTitleVi', 'seoTitleEn'],
    ['seoDescription', 'seoDescriptionVi', 'seoDescriptionEn'],
  ],
  category: [
    ['name', 'nameVi', 'nameEn'],
    ['description', 'descriptionVi', 'descriptionEn'],
  ],
  brand: [['name', 'nameVi', 'nameEn']],
  news: [
    ['title', 'titleVi', 'titleEn'],
    ['content', 'contentVi', 'contentEn'],
    ['description', 'descriptionVi', 'descriptionEn'],
    ['category', 'categoryVi', 'categoryEn'],
  ],
  banner: [['title', 'titleVi', 'titleEn']],
};

/**
 * Localize một plain object (hoặc Sequelize instance.toJSON()).
 * - locale='vi' → trả về giá trị _vi cho mỗi field (fallback _en nếu thiếu)
 * - locale='en' → trả về giá trị _en cho mỗi field (fallback _vi nếu thiếu)
 * - Luôn giữ lại cả _vi và _en trong response (để admin edit)
 *
 * @param {object} entity  - plain object
 * @param {'vi'|'en'} locale
 * @param {string} type    - key trong FIELD_MAPS
 * @returns {object}
 */
function localizeEntity(entity, locale = 'vi', type) {
  if (!entity || !type || !FIELD_MAPS[type]) return entity;
  const obj = entity && typeof entity.toJSON === 'function' ? entity.toJSON() : { ...entity };
  const fieldMap = FIELD_MAPS[type];

  for (const [field, viKey, enKey] of fieldMap) {
    const vi = obj[viKey];
    const en = obj[enKey];
    // Localized value: ưu tiên ngôn ngữ được chọn, fallback sang ngôn ngữ còn lại
    obj[field] = locale === 'en' ? en || vi || null : vi || en || null;
  }
  return obj;
}

/**
 * Localize một mảng entities.
 */
function localizeList(entities, locale, type) {
  return (entities || []).map((e) => localizeEntity(e, locale, type));
}

module.exports = { localizeEntity, localizeList, FIELD_MAPS };
