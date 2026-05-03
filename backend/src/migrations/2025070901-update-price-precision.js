'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // products.price was renamed to base_price — skip if column doesn't exist
    const productsDesc = await queryInterface.describeTable('products');
    if (productsDesc.price) {
      await queryInterface.changeColumn('products', 'price', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      });
    }
    if (productsDesc.compare_at_price) {
      await queryInterface.changeColumn('products', 'compare_at_price', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      });
    }

    const variantsDesc = await queryInterface.describeTable('product_variants');
    if (variantsDesc.price) {
      await queryInterface.changeColumn('product_variants', 'price', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const productsDesc = await queryInterface.describeTable('products');
    if (productsDesc.price) {
      await queryInterface.changeColumn('products', 'price', {
        type: Sequelize.DECIMAL(19, 2),
        allowNull: false,
      });
    }
    if (productsDesc.compare_at_price) {
      await queryInterface.changeColumn('products', 'compare_at_price', {
        type: Sequelize.DECIMAL(19, 2),
        allowNull: true,
      });
    }

    const variantsDesc = await queryInterface.describeTable('product_variants');
    if (variantsDesc.price) {
      await queryInterface.changeColumn('product_variants', 'price', {
        type: Sequelize.DECIMAL(19, 2),
        allowNull: false,
      });
    }
  },
};
