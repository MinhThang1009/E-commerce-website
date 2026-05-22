'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('brands', 'description_vi', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'logo_url',
    });
    await queryInterface.addColumn('brands', 'description_en', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'description_vi',
    });
    await queryInterface.addColumn('brands', 'website', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'description_en',
    });
    await queryInterface.addColumn('brands', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'website',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('brands', 'is_active');
    await queryInterface.removeColumn('brands', 'website');
    await queryInterface.removeColumn('brands', 'description_en');
    await queryInterface.removeColumn('brands', 'description_vi');
  },
};
