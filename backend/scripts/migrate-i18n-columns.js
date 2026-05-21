/**
 * One-time script: đổi tên cột sang i18n schema (name → name_vi, thêm name_en v.v.)
 * Chạy 1 lần để sync DB với model definitions hiện tại.
 * Idempotent — dùng CHANGE COLUMN (fail gracefully nếu cột đã đúng tên).
 */
require('module-alias/register');
require('dotenv').config();
const sequelize = require('@config/sequelize');

const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const log = (msg) => console.log(`[${ts()}]  ✅  INFO   ${msg}`);
const warn = (msg) => console.warn(`[${ts()}]  ⚠️   WARN   ${msg}`);

const migrations = [
  {
    table: 'categories',
    sql: `ALTER TABLE categories
      CHANGE COLUMN \`name\` \`name_vi\` VARCHAR(100) NOT NULL,
      ADD COLUMN \`name_en\` VARCHAR(100) NULL AFTER \`name_vi\`,
      CHANGE COLUMN \`description\` \`description_vi\` TEXT NULL,
      ADD COLUMN \`description_en\` TEXT NULL AFTER \`description_vi\``,
  },
  {
    table: 'brands',
    sql: `ALTER TABLE brands
      CHANGE COLUMN \`name\` \`name_vi\` VARCHAR(100) NOT NULL,
      ADD COLUMN \`name_en\` VARCHAR(100) NULL AFTER \`name_vi\``,
  },
  {
    table: 'products',
    sql: `ALTER TABLE products
      CHANGE COLUMN \`name\` \`name_vi\` VARCHAR(255) NOT NULL,
      ADD COLUMN \`name_en\` VARCHAR(255) NULL AFTER \`name_vi\`,
      CHANGE COLUMN \`short_description\` \`short_description_vi\` TEXT NULL,
      ADD COLUMN \`short_description_en\` TEXT NULL AFTER \`short_description_vi\`,
      CHANGE COLUMN \`description\` \`description_vi\` LONGTEXT NULL,
      ADD COLUMN \`description_en\` LONGTEXT NULL AFTER \`description_vi\`,
      CHANGE COLUMN \`seo_title\` \`seo_title_vi\` VARCHAR(255) NULL,
      ADD COLUMN \`seo_title_en\` VARCHAR(255) NULL AFTER \`seo_title_vi\`,
      CHANGE COLUMN \`seo_description\` \`seo_description_vi\` TEXT NULL,
      ADD COLUMN \`seo_description_en\` TEXT NULL AFTER \`seo_description_vi\``,
  },
  {
    table: 'news',
    sql: `ALTER TABLE news
      CHANGE COLUMN \`title\` \`title_vi\` VARCHAR(255) NOT NULL,
      ADD COLUMN \`title_en\` VARCHAR(255) NULL AFTER \`title_vi\`,
      CHANGE COLUMN \`description\` \`description_vi\` TEXT NULL,
      ADD COLUMN \`description_en\` TEXT NULL AFTER \`description_vi\``,
  },
  {
    table: 'banners',
    sql: `ALTER TABLE banners
      CHANGE COLUMN \`title\` \`title_vi\` VARCHAR(255) NOT NULL,
      ADD COLUMN \`title_en\` VARCHAR(255) NULL AFTER \`title_vi\``,
  },
  {
    table: 'products (faqs)',
    sql: `ALTER TABLE products ADD COLUMN \`faqs\` JSON NULL`,
  },
  {
    table: 'news (i18n content + category)',
    sql: `ALTER TABLE news
      CHANGE COLUMN \`content\` \`content_vi\` LONGTEXT NULL,
      ADD COLUMN \`content_en\` LONGTEXT NULL AFTER \`content_vi\`,
      CHANGE COLUMN \`category\` \`category_vi\` VARCHAR(100) NULL,
      ADD COLUMN \`category_en\` VARCHAR(100) NULL AFTER \`category_vi\``,
  },
  {
    table: 'product_variants (add attributes_en)',
    sql: `ALTER TABLE product_variants ADD COLUMN \`attributes_en\` JSON NULL`,
  },
  {
    table: 'product_reviews (rating_value → rating)',
    sql: `ALTER TABLE product_reviews CHANGE COLUMN \`rating_value\` \`rating\` TINYINT NOT NULL DEFAULT 5`,
  },
  {
    table: 'product_reviews (add title)',
    sql: `ALTER TABLE product_reviews ADD COLUMN \`title\` VARCHAR(255) NULL`,
  },
  {
    table: 'product_reviews (add is_verified)',
    sql: `ALTER TABLE product_reviews ADD COLUMN \`is_verified\` TINYINT(1) NOT NULL DEFAULT 0`,
  },
  {
    table: 'product_reviews (add likes)',
    sql: `ALTER TABLE product_reviews ADD COLUMN \`likes\` INT NOT NULL DEFAULT 0`,
  },
  {
    table: 'product_reviews (add dislikes)',
    sql: `ALTER TABLE product_reviews ADD COLUMN \`dislikes\` INT NOT NULL DEFAULT 0`,
  },
  {
    table: 'product_reviews (add images)',
    sql: `ALTER TABLE product_reviews ADD COLUMN \`images\` JSON NULL`,
  },
];

(async () => {
  log('Bắt đầu migrate i18n columns...');
  for (const { table, sql } of migrations) {
    try {
      await sequelize.query(sql);
      log(`${table} — ✔ đã đổi tên cột`);
    } catch (e) {
      // Nếu cột đã đúng tên → skip
      if (e.message.includes('Unknown column') || e.message.includes("Can't DROP") || e.message.includes('Duplicate column')) {
        warn(`${table} — đã migrate hoặc cột không tồn tại, bỏ qua`);
      } else {
        warn(`${table} — ${e.message.slice(0, 120)}`);
      }
    }
  }
  log('Hoàn tất migrate i18n columns.');
  await sequelize.close();
  process.exit(0);
})();
