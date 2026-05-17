'use strict';
/**
 * i18n: Column-per-locale pattern cho 6 bảng content.
 * Rename existing columns → _vi suffix, thêm _en columns (nullable).
 *
 * Bảng + columns:
 *   products:    name, short_description, description, seo_title, seo_description
 *   categories:  name, description
 *   brands:      name
 *   collections: name, description
 *   news:        title, content, description, category
 *   banners:     title
 *
 * Down: rename _vi → original, drop _en columns.
 */

// [table, original_col, vi_col, en_col, type, allowNull, defaultValue]
const COLUMNS = [
  // products
  ['products', 'name',              'name_vi',              'name_en',              'VARCHAR(200)',  false, null],
  ['products', 'short_description', 'short_description_vi', 'short_description_en', 'TEXT',         true,  null],
  ['products', 'description',       'description_vi',       'description_en',       'TEXT',         true,  null],
  ['products', 'seo_title',         'seo_title_vi',         'seo_title_en',         'VARCHAR(500)', true,  null],
  ['products', 'seo_description',   'seo_description_vi',   'seo_description_en',   'TEXT',         true,  null],
  // categories
  ['categories', 'name',        'name_vi',        'name_en',        'VARCHAR(100)', false, null],
  ['categories', 'description', 'description_vi', 'description_en', 'TEXT',        true,  null],
  // brands
  ['brands', 'name', 'name_vi', 'name_en', 'VARCHAR(100)', false, null],
  // collections
  ['collections', 'name',        'name_vi',        'name_en',        'VARCHAR(200)', false, null],
  ['collections', 'description', 'description_vi', 'description_en', 'TEXT',        true,  null],
  // news
  ['news', 'title',       'title_vi',       'title_en',       'VARCHAR(255)', false, null],
  ['news', 'content',     'content_vi',     'content_en',     'LONGTEXT',     true,  null],
  ['news', 'description', 'description_vi', 'description_en', 'VARCHAR(500)', true,  null],
  ['news', 'category',    'category_vi',    'category_en',    'VARCHAR(100)', true,  'Tin tức'],
  // banners
  ['banners', 'title', 'title_vi', 'title_en', 'VARCHAR(255)', false, null],
];

async function columnExists(queryInterface, table, column) {
  const [results] = await queryInterface.sequelize.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = '${table}' AND column_name = '${column}'`
  );
  return results.length > 0;
}

module.exports = {
  async up(queryInterface) {
    for (const [table, original, vi, en, type, notNull, defaultVal] of COLUMNS) {
      // 1. Rename original → vi (chỉ nếu original còn tồn tại)
      const hasOriginal = await columnExists(queryInterface, table, original);
      const hasVi       = await columnExists(queryInterface, table, vi);

      if (hasOriginal && !hasVi) {
        const nullClause    = notNull ? 'NOT NULL' : 'NULL';
        const defaultClause = defaultVal !== null ? `DEFAULT '${defaultVal}'` : '';
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` CHANGE \`${original}\` \`${vi}\` ${type} ${nullClause} ${defaultClause}`
        );
        console.log(`  RENAMED: ${table}.${original} → ${vi}`);
      } else if (hasVi) {
        console.log(`  SKIP rename: ${table}.${vi} already exists`);
      } else {
        console.log(`  WARN: ${table}.${original} not found — skipping rename`);
      }

      // 2. Add _en column (nếu chưa có)
      if (!(await columnExists(queryInterface, table, en))) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` ADD COLUMN \`${en}\` ${type} NULL AFTER \`${vi}\``
        );
        console.log(`  ADDED: ${table}.${en}`);
      } else {
        console.log(`  SKIP add: ${table}.${en} already exists`);
      }
    }
  },

  async down(queryInterface) {
    for (const [table, original, vi, en, type, notNull, defaultVal] of [...COLUMNS].reverse()) {
      // Drop _en column
      if (await columnExists(queryInterface, table, en)) {
        await queryInterface.sequelize.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${en}\``);
        console.log(`  DROPPED: ${table}.${en}`);
      }
      // Rename vi → original
      if (await columnExists(queryInterface, table, vi)) {
        const nullClause    = notNull ? 'NOT NULL' : 'NULL';
        const defaultClause = defaultVal !== null ? `DEFAULT '${defaultVal}'` : '';
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` CHANGE \`${vi}\` \`${original}\` ${type} ${nullClause} ${defaultClause}`
        );
        console.log(`  RENAMED BACK: ${table}.${vi} → ${original}`);
      }
    }
  },
};
