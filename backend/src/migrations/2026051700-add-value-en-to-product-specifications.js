'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('product_specifications', 'value_en', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'value',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('product_specifications', 'value_en');
  },
};
