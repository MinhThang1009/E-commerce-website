'use strict';

// Migration: thêm missing UNIQUE constraints + indexes theo audit schema
// Idempotent — skip nếu index đã tồn tại

async function indexExists(qi, table, indexName) {
  const [rows] = await qi.sequelize.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    { replacements: [table, indexName] }
  );
  return rows.length > 0;
}

async function tableExists(qi, table) {
  const [rows] = await qi.sequelize.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    { replacements: [table] }
  );
  return rows.length > 0;
}

async function columnExists(qi, table, column) {
  const [rows] = await qi.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    { replacements: [table, column] }
  );
  return rows.length > 0;
}

// ── Định nghĩa indexes ──────────────────────────────────────────────────────

// HIGH — Missing UNIQUE constraints
const UNIQUE_INDEXES = [
  // [table, indexName, columns]
  ['orders',               'uq_orders_number',                    ['number']],
  ['newsletter_subscribers','uq_newsletter_subscribers_email',     ['email']],
  ['news',                 'uq_news_slug',                        ['slug']],
  ['wishlists',            'uq_wishlists_user_product',            ['user_id', 'product_id']],
  ['product_categories',   'uq_pcat_product_category',            ['product_id', 'category_id']],
  ['review_feedbacks',     'uq_review_feedbacks_review_user',     ['review_id', 'user_id']],
];

// MEDIUM — Missing indexes
const REGULAR_INDEXES = [
  // [table, indexName, columns]
  ['orders',           'idx_orders_status',        ['status']],
  ['orders',           'idx_orders_created_at',    ['created_at']],
  ['orders',           'idx_orders_payment_status',['payment_status']],
  ['products',         'idx_products_status',      ['status']],
  ['products',         'idx_products_is_featured', ['is_featured']],
  ['users',            'idx_users_role',           ['role']],
  ['recently_viewed',  'idx_rv_user_product',      ['user_id', 'product_id']],
];

module.exports = {
  async up(queryInterface) {
    // ── HIGH: UNIQUE constraints ───────────────────────────────────────────
    for (const [table, indexName, columns] of UNIQUE_INDEXES) {
      if (!(await tableExists(queryInterface, table))) {
        console.log(`  SKIP: table "${table}" does not exist`);
        continue;
      }
      // Kiểm tra tất cả columns tồn tại
      let allColumnsExist = true;
      for (const col of columns) {
        if (!(await columnExists(queryInterface, table, col))) {
          console.log(`  SKIP: column "${table}.${col}" does not exist`);
          allColumnsExist = false;
          break;
        }
      }
      if (!allColumnsExist) continue;

      if (await indexExists(queryInterface, table, indexName)) {
        console.log(`  EXISTS: ${indexName}`);
        continue;
      }
      const colList = columns.map((c) => `\`${c}\``).join(', ');
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${indexName}\` (${colList})`
      );
      console.log(`  ADDED: ${indexName} (UNIQUE) on ${table}(${columns.join(', ')})`);
    }

    // ── MEDIUM: Regular indexes ────────────────────────────────────────────
    for (const [table, indexName, columns] of REGULAR_INDEXES) {
      if (!(await tableExists(queryInterface, table))) {
        console.log(`  SKIP: table "${table}" does not exist`);
        continue;
      }
      let allColumnsExist = true;
      for (const col of columns) {
        if (!(await columnExists(queryInterface, table, col))) {
          console.log(`  SKIP: column "${table}.${col}" does not exist`);
          allColumnsExist = false;
          break;
        }
      }
      if (!allColumnsExist) continue;

      if (await indexExists(queryInterface, table, indexName)) {
        console.log(`  EXISTS: ${indexName}`);
        continue;
      }
      const colList = columns.map((c) => `\`${c}\``).join(', ');
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${colList})`
      );
      console.log(`  ADDED: ${indexName} on ${table}(${columns.join(', ')})`);
    }
  },

  async down(queryInterface) {
    // Remove regular indexes trước (reverse order)
    for (const [table, indexName] of [...REGULAR_INDEXES].reverse()) {
      if (await indexExists(queryInterface, table, indexName)) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` DROP INDEX \`${indexName}\``
        );
        console.log(`  DROPPED: ${indexName}`);
      }
    }

    // Remove UNIQUE constraints (reverse order)
    for (const [table, indexName] of [...UNIQUE_INDEXES].reverse()) {
      if (await indexExists(queryInterface, table, indexName)) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` DROP INDEX \`${indexName}\``
        );
        console.log(`  DROPPED: ${indexName}`);
      }
    }
  },
};
