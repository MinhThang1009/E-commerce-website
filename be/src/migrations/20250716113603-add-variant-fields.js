const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const productDefinition = await queryInterface.describeTable('products');
    const variantDefinition = await queryInterface.describeTable(
      'product_variants'
    );

    if (!productDefinition.base_name) {
      await queryInterface.addColumn('products', 'base_name', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    if (!productDefinition.is_variant_product) {
      await queryInterface.addColumn('products', 'is_variant_product', {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      });
    }

    if (!variantDefinition.compare_at_price) {
      await queryInterface.addColumn('product_variants', 'compare_at_price', {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      });
    }

    if (!variantDefinition.specifications) {
      await queryInterface.addColumn('product_variants', 'specifications', {
        type: DataTypes.JSON,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE products SET base_name = name WHERE base_name IS NULL;
    `);
  },

  down: async (queryInterface) => {
    const productDefinition = await queryInterface.describeTable('products');
    const variantDefinition = await queryInterface.describeTable(
      'product_variants'
    );

    if (productDefinition.base_name) {
      await queryInterface.removeColumn('products', 'base_name');
    }

    if (productDefinition.is_variant_product) {
      await queryInterface.removeColumn('products', 'is_variant_product');
    }

    if (variantDefinition.compare_at_price) {
      await queryInterface.removeColumn(
        'product_variants',
        'compare_at_price'
      );
    }

    if (variantDefinition.specifications) {
      await queryInterface.removeColumn('product_variants', 'specifications');
    }
  },
};
