'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('import_logs');
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('import_logs', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      adminId: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      filename: { type: Sequelize.STRING(255), allowNull: false },
      totalRows: { type: Sequelize.INTEGER, defaultValue: 0 },
      successRows: { type: Sequelize.INTEGER, defaultValue: 0 },
      failedRows: { type: Sequelize.INTEGER, defaultValue: 0 },
      errorDetail: { type: Sequelize.JSON, allowNull: true },
      importedAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
};
