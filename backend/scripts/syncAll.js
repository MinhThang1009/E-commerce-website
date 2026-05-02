require('dotenv').config({ path: '../.env' });
const { sequelize } = require('../src/models');

async function syncAll() {
  try {
    console.log('🔄 BẮT ĐẦU ĐỒNG BỘ SEQUELIZE (TẠO CÁC BẢNG CÒN THIẾU)...');
    
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Chỉ dùng sync() mặc định: Sẽ create những bảng chưa tồn tại, BỎ QUA các bảng đã có
    await sequelize.sync();
    
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('✅ ĐÃ ĐỒNG BỘ THÀNH CÔNG TẤT CẢ CÁC BẢNG THIẾU!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi đồng bộ:', error);
    process.exit(1);
  }
}

syncAll();
