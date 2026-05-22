/**
 * Xóa toàn bộ test data để lại bởi integration/HTTP/E2E tests.
 * Chạy sau khi test: npm run test:api && npm run db:cleanup-test-data
 */
require('module-alias/register');
require('dotenv').config();

const { sequelize } = require('../src/models');

const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const log = (msg) => console.log(`[${ts()}]  ✅  INFO   ${msg}`);
const warn = (msg) => console.warn(`[${ts()}]  ⚠️   WARN   ${msg}`);

async function cleanupTestData() {
  log('🧹 Bắt đầu dọn test data...');

  // Pattern nhận diện test data: bắt đầu bằng __ (double underscore)
  const testPattern = '^__';

  // Thứ tự quan trọng: child records trước, parent sau
  const tables = [
    { table: 'orders',     column: 'number' },
    { table: 'products',   column: 'name_vi' },
    { table: 'brands',     column: 'name_vi' },
    { table: 'categories', column: 'name_vi' },
    { table: 'users',      column: 'email' },
  ];

  let totalDeleted = 0;

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const { table, column } of tables) {
    try {
      const [rows] = await sequelize.query(
        `DELETE FROM \`${table}\` WHERE \`${column}\` REGEXP ?`,
        { replacements: [testPattern] }
      );
      const count = rows.affectedRows ?? 0;
      if (count > 0) log(`  ${table}: xóa ${count} test records`);
      totalDeleted += count;
    } catch (e) {
      warn(`  ${table}: ${e.message.slice(0, 80)}`);
    }
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

  log(`✅ Xong! Đã xóa ${totalDeleted} test records.`);
  await sequelize.close();
  process.exit(0);
}

cleanupTestData().catch((e) => {
  console.error('❌ Cleanup thất bại:', e.message);
  process.exit(1);
});
