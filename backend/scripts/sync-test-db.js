/**
 * Sync (copy) database nguồn (techstore — DB_NAME) → đích (techstore_test) qua mysql2.
 *
 * Mục đích: để API HTTP tests chạy trên BẢN SAO dữ liệu thật mà KHÔNG ghi rác vào
 * techstore gốc. API tests vốn đã trỏ techstore_test (src/__api__/setup.js), script này
 * chỉ làm techstore_test = bản sao mới nhất của techstore.
 *
 * Cơ chế: CREATE TABLE LIKE + INSERT ... SELECT cross-database (cùng MySQL server) —
 * không cần mysqldump CLI. CHỈ ĐỌC techstore (nguồn); DROP/recreate techstore_test (đích).
 *
 * Chạy: npm run db:sync-test
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const SOURCE = (process.env.DB_NAME || 'techstore').trim();
const TARGET = 'techstore_test';

async function main() {
  if (SOURCE === TARGET) {
    throw new Error(`Nguồn và đích trùng nhau (${SOURCE}) — hủy để tránh tự xóa DB.`);
  }

  const conn = await mysql.createConnection({
    host: (process.env.DB_HOST || '127.0.0.1').trim(),
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    multipleStatements: true,
  });

  try {
    console.log(`[sync-test-db] Copy ${SOURCE} → ${TARGET} ...`);

    // Đích phải tồn tại + cùng charset/collation với app (utf8mb4).
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${TARGET}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );

    const [srcTables] = await conn.query(
      `SELECT TABLE_NAME AS t FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
      [SOURCE],
    );
    if (srcTables.length === 0) {
      throw new Error(`Nguồn ${SOURCE} không có bảng nào — kiểm tra DB_NAME trong .env.`);
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // Drop bảng cũ trong đích (chỉ techstore_test) để bản sao luôn mới.
    const [oldTables] = await conn.query(
      `SELECT TABLE_NAME AS t FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
      [TARGET],
    );
    for (const { t } of oldTables) {
      await conn.query(`DROP TABLE IF EXISTS \`${TARGET}\`.\`${t}\``);
    }

    // Copy structure + data từng bảng.
    let rows = 0;
    for (const { t } of srcTables) {
      await conn.query(`CREATE TABLE \`${TARGET}\`.\`${t}\` LIKE \`${SOURCE}\`.\`${t}\``);
      const [res] = await conn.query(
        `INSERT INTO \`${TARGET}\`.\`${t}\` SELECT * FROM \`${SOURCE}\`.\`${t}\``,
      );
      rows += res.affectedRows || 0;
      console.log(`  ✓ ${t} (${res.affectedRows || 0} rows)`);
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(
      `[sync-test-db] Xong: ${srcTables.length} bảng, ${rows} rows từ ${SOURCE} → ${TARGET}.`,
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[sync-test-db] Lỗi:', err.message);
  process.exit(1);
});
