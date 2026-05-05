'use strict';

// Phase 40.23 — Add soft delete (deleted_at + index) cho 3 tables thiếu: collections, news, addresses
// Idempotent: skip nếu column/index đã tồn tại

const TABLES = ['collections', 'news', 'addresses'];

async function columnExists(qi, table, column) {
  const [rows] = await qi.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  return rows.length > 0;
}

async function indexExists(qi, table, indexName) {
  const [rows] = await qi.sequelize.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    { replacements: [table, indexName] }
  );
  return rows.length > 0;
}

module.exports = {
  async up(queryInterface) {
    for (const table of TABLES) {
      if (!(await columnExists(queryInterface, table, 'deleted_at'))) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` ADD COLUMN \`deleted_at\` DATETIME NULL DEFAULT NULL`
        );
      }
      const indexName = `idx_${table}_deleted_at`;
      if (!(await indexExists(queryInterface, table, indexName))) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (\`deleted_at\`)`
        );
      }
    }
  },

  async down(queryInterface) {
    for (const table of TABLES) {
      const indexName = `idx_${table}_deleted_at`;
      if (await indexExists(queryInterface, table, indexName)) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` DROP INDEX \`${indexName}\``
        );
      }
      if (await columnExists(queryInterface, table, 'deleted_at')) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` DROP COLUMN \`deleted_at\``
        );
      }
    }
  },
};
