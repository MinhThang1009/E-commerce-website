'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('categories', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'description_en',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('categories', 'is_active');
  },
};
