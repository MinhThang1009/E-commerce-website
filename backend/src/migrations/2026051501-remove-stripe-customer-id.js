'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('users', 'stripe_customer_id');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'stripe_customer_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
