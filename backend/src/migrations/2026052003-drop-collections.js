'use strict';
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('product_collections');
    await queryInterface.dropTable('collections');
  },
  async down() {},
};
