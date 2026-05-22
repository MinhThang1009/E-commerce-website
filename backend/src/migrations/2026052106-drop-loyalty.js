'use strict';
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('loyalty_histories');
    await queryInterface.removeColumn('users', 'loyalty_points');
    await queryInterface.removeColumn('orders', 'points_earned');
    await queryInterface.removeColumn('orders', 'points_used');
    await queryInterface.removeColumn('orders', 'points_discount');
  },
  async down() {},
};
