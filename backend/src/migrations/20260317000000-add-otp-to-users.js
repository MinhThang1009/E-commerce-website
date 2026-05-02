'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add otpCode column
    await queryInterface.addColumn('users', 'otpCode', {
      type: Sequelize.STRING(6),
      allowNull: true,
      defaultValue: null,
    });

    // Add otpExpires column
    await queryInterface.addColumn('users', 'otpExpires', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });

    // Remove old verificationToken column if it exists
    try {
      await queryInterface.removeColumn('users', 'verificationToken');
    } catch (e) {
      // Column might not exist, ignore
    }
  },

  async down(queryInterface, Sequelize) {
    // Reverse: re-add verificationToken, remove otp columns
    try {
      await queryInterface.addColumn('users', 'verificationToken', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      });
    } catch (e) {
      // Column verificationToken có thể đã tồn tại — bỏ qua lỗi ER_DUP_FIELDNAME
    }

    await queryInterface.removeColumn('users', 'otpCode');
    await queryInterface.removeColumn('users', 'otpExpires');
  },
};
