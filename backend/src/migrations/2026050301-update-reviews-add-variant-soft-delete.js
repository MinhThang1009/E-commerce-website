'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('reviews');

    if (!tableDesc.variantId) {
      await queryInterface.addColumn('reviews', 'variantId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        after: 'userId',
      });
    }

    if (!tableDesc.deletedAt) {
      await queryInterface.addColumn('reviews', 'deletedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        after: 'updatedAt',
      });
    }
  },

  down: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('reviews');
    if (tableDesc.variantId) {
      await queryInterface.removeColumn('reviews', 'variantId');
    }
    if (tableDesc.deletedAt) {
      await queryInterface.removeColumn('reviews', 'deletedAt');
    }
  },
};
