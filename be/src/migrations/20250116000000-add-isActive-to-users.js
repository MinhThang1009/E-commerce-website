'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable('users');

    if (!tableDefinition.isActive) {
      await queryInterface.addColumn('users', 'isActive', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      });

      await queryInterface.sequelize.query(
        'UPDATE users SET "isActive" = true WHERE "isActive" IS NULL'
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable('users');
    if (tableDefinition.isActive) {
      await queryInterface.removeColumn('users', 'isActive');
    }
  },
};
