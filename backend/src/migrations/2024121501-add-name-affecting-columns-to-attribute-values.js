'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable(
      'attribute_values'
    );

    if (!tableDefinition.affects_name) {
      await queryInterface.addColumn('attribute_values', 'affects_name', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this attribute value affects the product name',
      });
    }

    if (!tableDefinition.name_template) {
      await queryInterface.addColumn('attribute_values', 'name_template', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Template for product name (e.g., "I9", "RTX 4080", "32GB")',
      });
    }
  },

  async down(queryInterface) {
    const tableDefinition = await queryInterface.describeTable(
      'attribute_values'
    );

    if (tableDefinition.affects_name) {
      await queryInterface.removeColumn('attribute_values', 'affects_name');
    }

    if (tableDefinition.name_template) {
      await queryInterface.removeColumn('attribute_values', 'name_template');
    }
  },
};
