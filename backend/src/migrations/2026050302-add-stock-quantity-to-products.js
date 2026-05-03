'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('products');
    if (!tableDesc.stock_quantity) {
      await queryInterface.addColumn('products', 'stock_quantity', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        after: 'rating_average',
      });
    }
  },

  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable('products');
    if (tableDesc.stock_quantity) {
      await queryInterface.removeColumn('products', 'stock_quantity');
    }
  },
};
