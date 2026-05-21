const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');

const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const log  = (msg) => console.log(`[${ts()}]  ✅  INFO   ${msg}`);
const warn = (msg) => console.warn(`[${ts()}]  ⚠️   WARN   ${msg}`);
const err  = (msg) => console.error(`[${ts()}]  ❌  ERROR  ${msg}`);

async function importSql(conn, filename) {
  log(`📂 Đang import \`${filename}\`...`);
  const sqlPath = path.join(__dirname, '..', 'data', filename);
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  let cleaned = sqlContent.replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_unicode_ci');
  // Xóa tên CONSTRAINT trùng (lỗi 121) để MySQL tự sinh tên FK
  cleaned = cleaned.replace(/CONSTRAINT\s+`?\w+`?\s+FOREIGN KEY/gi, 'FOREIGN KEY');

  try {
    await conn.query(cleaned);
    log(`✔  Import \`${filename}\` thành công`);
  } catch (e) {
    err(`Import \`${filename}\` thất bại: ${e.message.slice(0, 200)}`);
    throw e;
  }
}

async function rebuild() {
  let conn;
  try {
    log('🚀 Bắt đầu khởi tạo lại database...');

    conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });

    const dbName = process.env.DB_NAME || 'techstore';

    log(`🗑️  Xóa database \`${dbName}\` (nếu tồn tại)...`);
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);

    log(`🏗️  Tạo database \`${dbName}\`...`);
    await conn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${dbName}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    await importSql(conn, 'migration_full.sql');
    await importSql(conn, 'seed_data.sql');

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    log('✅ Hoàn tất! Database đã sẵn sàng.');
    process.exit(0);
  } catch (e) {
    err(`❌ Khởi tạo thất bại: ${e.message}`);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

rebuild();
