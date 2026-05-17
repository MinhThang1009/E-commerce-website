'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('product_variants', 'attributes_en', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'attributes',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('product_variants', 'attributes_en');
  },
};
