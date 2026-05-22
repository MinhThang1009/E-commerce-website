'use strict';
/**
 * Seeder: admin user mặc định cho development.
 * Idempotent: INSERT IGNORE theo email.
 * PASSWORD: Admin@123 (bcrypt hash — CHỈ DÙNG DEV, thay đổi trước production)
 */
const ADMIN_EMAIL = 'admin@techstore.vn';

module.exports = {
  async up(queryInterface) {
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash('Admin@123', 10);

    await queryInterface.sequelize.query(
      `INSERT IGNORE INTO users
         (email, password, first_name, last_name, role, is_email_verified, is_active, created_at, updated_at)
       VALUES (?, ?, 'Admin', 'TechStore', 'admin', 1, 1, NOW(), NOW())`,
      { replacements: [ADMIN_EMAIL, passwordHash] }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { email: ADMIN_EMAIL });
  },
};
