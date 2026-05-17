'use strict';

// Bảng brand_categories không có association và không được dùng bởi bất kỳ business code nào.
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('brand_categories');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('brand_categories', {
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'brands', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    });
  },
};
