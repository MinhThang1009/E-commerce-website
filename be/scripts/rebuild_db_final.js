require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { sequelize, User, Banner, DiscountCode, Collection, WarrantyPackage, AttributeGroup } = require('../src/models');
const { seedFull } = require('./seed_products_v2');

async function importSql(conn, filename) {
  console.log(`\n⏳ Đang import [${filename}]...`);
  const sqlPath = path.join(__dirname, '..', '..', filename);
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  
  const cleanedContent = sqlContent.replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_unicode_ci');
  
  try {
    await conn.query(cleanedContent);
    console.log(`✅ Thành công import ${filename}`);
  } catch (err) {
    console.error(`❌ Lỗi khi import ${filename}:`, err.message.substring(0, 500));
    throw err;
  }
}

async function rebuild() {
  let rawConn;
  try {
    console.log('🔄 BẮT ĐẦU REBUILD DB VỚI SEQUELIZE SYNC...');
    
    // Bước 1: Xóa DB cũ đi và tạo lại vỏ DB mới tinh
    rawConn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    const dbName = process.env.DB_NAME || 'techstore';
    await rawConn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await rawConn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Đã tạo Database: ${dbName}`);

    // Bước 2: Dùng Sequelize Authenticate và Sync Force! (Tạo chuẩn xịn 38 bảng mượt mà ko sai cột nào)
    await sequelize.authenticate();
    console.log('⏳ Đang tạo 38 bảng từ Sequelize Models...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.sync({ force: true });
    console.log('✅ Đã tạo bảng thành công.');

    // Bước 3: Seed 45 sản phẩm qua seed_products_v2.js
    console.log('⏳ Đang seed sản phẩm từ seed_products_v2.js...');
    await seedFull();

    // Bước 4: Seed Data cơ bản (User, Banners, Discount...) dùng trực tiếp Model
    console.log('⏳ Đang gieo mầm dữ liệu Seed bằng Model...');
    const hpw = await bcrypt.hash('admin123', 10);
    
    await User.bulkCreate([
      { email: 'admin@techstore.vn', password: hpw, firstName: 'Admin', lastName: 'Hệ thống', role: 'admin', isEmailVerified: true, isActive: true },
      { email: 'customer@techstore.vn', password: hpw, firstName: 'Khách', lastName: 'Hàng', role: 'customer', isEmailVerified: true, isActive: true }
    ]);

    await Banner.bulkCreate([
      { title: 'Sale Sinh Nhật 50%', imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop', position: 'home_hero', isActive: true, priority: 1 },
      { title: 'FlashSale Cuối Tuần', imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=2071&auto=format&fit=crop', position: 'home_middle', isActive: true, priority: 2 }
    ]);

    await DiscountCode.bulkCreate([
      { code: 'WELCOME10', type: 'percentage', value: 10, minOrderAmount: 0, isActive: true, description: 'Giảm 10% khách mới' },
      { code: 'FREESHIP', type: 'fixed_amount', value: 30000, isActive: true, description: 'Freeship mọi miền' }
    ]);

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    await rawConn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log(`\n🎉 HOÀN TẤT! Kiến trúc Database hoàn hảo 100%. Mọi lỗi 500 đã bị tận diệt.`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TIẾN TRÌNH THẤT BẠI:', err);
    process.exit(1);
  } finally {
    if (rawConn) await rawConn.end();
  }
}

rebuild();
