'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDefinition = await queryInterface.describeTable('users');

    if (!tableDefinition.stripe_customer_id) {
      await queryInterface.addColumn('users', 'stripe_customer_id', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const tableDefinition = await queryInterface.describeTable('users');
    if (tableDefinition.stripe_customer_id) {
      await queryInterface.removeColumn('users', 'stripe_customer_id');
    }
  },
};
