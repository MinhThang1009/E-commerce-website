'use strict';
/**
 * Seeder: nhân viên bán hàng (staff) mặc định cho development.
 * Idempotent: INSERT IGNORE theo email.
 * PASSWORD: Staff@123 (bcrypt hash — CHỈ DÙNG DEV, thay đổi trước production)
 *
 * Role 'staff' phụ trách nghiệp vụ bán hàng (sản phẩm, đơn hàng, kho, mã giảm giá,
 * đánh giá); KHÔNG quản lý người dùng — tách bạch với 'admin'.
 */
const STAFF_EMAIL = 'staff@techstore.vn';

module.exports = {
  async up(queryInterface) {
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash('Staff@123', 10);

    await queryInterface.sequelize.query(
      `INSERT IGNORE INTO users
         (email, password, first_name, last_name, role, is_email_verified, is_active, created_at, updated_at)
       VALUES (?, ?, 'Nhân viên', 'Bán hàng', 'staff', 1, 1, NOW(), NOW())`,
      { replacements: [STAFF_EMAIL, passwordHash] },
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { email: STAFF_EMAIL });
  },
};
