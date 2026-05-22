'use strict';
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('product_warranties');
    await queryInterface.dropTable('warranty_packages');
    await queryInterface.removeColumn('cart_items', 'warranty_package_ids');
    await queryInterface.removeColumn('orders', 'warranty_cost');
  },
  async down() {},
};
