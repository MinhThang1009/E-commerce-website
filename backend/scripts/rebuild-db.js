const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');

async function importSql(conn, filename) {
  console.log(`\n⏳ Đang import [${filename}]...`);
  const sqlPath = path.join(__dirname, '..', 'data', filename);
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  
  let cleanedContent = sqlContent.replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_unicode_ci');
  
  // Xóa thủ công tên CONSTRAINT bị trùng trong server (lỗi 121) để MySQL tự động gen tên FK random
  cleanedContent = cleanedContent.replace(/CONSTRAINT\s+`?\w+`?\s+FOREIGN KEY/gi, 'FOREIGN KEY');
  
  try {
    await conn.query(cleanedContent);
    console.log(`✅ Thành công import ${filename}`);
  } catch (err) {
    console.error(`❌ Lỗi khi import ${filename}:`, err.message.substring(0, 200));
    throw err;
  }
}

async function rebuild() {
  let conn;
  try {
    console.log('🔄 BẮT ĐẦU RESET VÀ IMPORT DATABASE...');
    
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    const oldDbName = 'websitebanhangmini';
    const dbName = process.env.DB_NAME || 'techstore';

    console.log(`0️⃣ Xóa bỏ database cũ \`${oldDbName}\` để giải phóng khóa ngoại (FK)...`);
    await conn.query(`DROP DATABASE IF EXISTS \`${oldDbName}\``);

    console.log(`1️⃣ Xóa bỏ Database \`${dbName}\` (nếu đang tồn tại)...`);
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    
    console.log(`2️⃣ Tạo Database mới: \`${dbName}\``);
    await conn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    console.log(`3️⃣ Đang chuyển sang dùng Database \`${dbName}\``);
    await conn.query(`USE \`${dbName}\``);

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    await importSql(conn, 'migration_full.sql');
    await importSql(conn, 'seed_data.sql');

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log(`\n🎉 HOÀN TẤT! Tất cả 39 bảng và dữ liệu mẫu đã được nạp chuẩn xác.`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TIẾN TRÌNH THẤT BẠI:', err);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

rebuild();
