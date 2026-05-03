'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
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
    } catch (error) {
      console.error('Error updating price precision:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      const productsDesc = await queryInterface.describeTable('products');
      if (productsDesc.price) {
        await queryInterface.changeColumn('products', 'price', {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
        });
      }
      if (productsDesc.compare_at_price) {
        await queryInterface.changeColumn('products', 'compare_at_price', {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        });
      }

      const variantsDesc = await queryInterface.describeTable('product_variants');
      if (variantsDesc.price) {
        await queryInterface.changeColumn('product_variants', 'price', {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
        });
      }
    } catch (error) {
      console.error('Error reverting price precision:', error);
      throw error;
    }
  },
};
