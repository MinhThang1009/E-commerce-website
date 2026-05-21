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

  const tables = [
    { table: 'news',       column: 'title_vi' },
    { table: 'products',   column: 'name_vi' },
    { table: 'brands',     column: 'name_vi' },
    { table: 'categories', column: 'name_vi' },
    { table: 'users',      column: 'email' },
    { table: 'orders',     column: 'number' },
  ];

  let totalDeleted = 0;

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

  // Reseed news nếu bị xóa
  const [[{ cnt }]] = await sequelize.query('SELECT COUNT(*) as cnt FROM news WHERE is_published = 1');
  if (cnt === 0) {
    log('📰 Reseed news sau cleanup...');
    const { execSync } = require('child_process');
    execSync('npx sequelize-cli db:seed:undo --seed 20260101000004-seed-news.js 2>/dev/null; npx sequelize-cli db:seed --seed 20260101000004-seed-news.js', {
      cwd: __dirname + '/..',
      stdio: 'pipe',
    });
    log('✔  News reseeded');
  }

  log(`✅ Xong! Đã xóa ${totalDeleted} test records.`);
  await sequelize.close();
  process.exit(0);
}

cleanupTestData().catch((e) => {
  console.error('❌ Cleanup thất bại:', e.message);
  process.exit(1);
});
