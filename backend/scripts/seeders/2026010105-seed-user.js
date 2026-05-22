'use strict';
/**
 * Seeder: user mẫu cho development.
 * Idempotent: INSERT IGNORE theo email.
 * PASSWORD: User@123 (CHỈ DÙNG DEV)
 */
const CUSTOMER_EMAIL = 'user@techstore.vn';

module.exports = {
  async up(queryInterface) {
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash('User@123', 10);
    const now = new Date();

    await queryInterface.sequelize.query(
      `INSERT IGNORE INTO users
         (email, password, first_name, last_name, phone, role,
          is_email_verified, is_active, created_at, updated_at)
       VALUES (?, ?, 'Nguyễn', 'Văn An', '0901234567', 'customer', 1, 1, ?, ?)`,
      { replacements: [CUSTOMER_EMAIL, passwordHash, now, now] },
    );

    // Lấy id vừa insert để tạo địa chỉ
    const [[user]] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      { replacements: [CUSTOMER_EMAIL] },
    );
    if (!user) return;

    await queryInterface.sequelize.query(
      `INSERT IGNORE INTO addresses
         (user_id, first_name, last_name, phone, address1, city, state, zip, country,
          is_default, created_at, updated_at)
       VALUES (?, 'Nguyễn', 'Văn An', '0901234567',
               '123 Nguyễn Huệ, Phường Bến Nghé', 'Hồ Chí Minh', 'Quận 1', '700000', 'Việt Nam',
               1, ?, ?)`,
      { replacements: [user.id, now, now] },
    );
  },

  async down(queryInterface) {
    const [[user]] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      { replacements: [CUSTOMER_EMAIL] },
    );
    if (user) {
      await queryInterface.bulkDelete('addresses', { user_id: user.id });
    }
    await queryInterface.bulkDelete('users', { email: CUSTOMER_EMAIL });
  },
};
