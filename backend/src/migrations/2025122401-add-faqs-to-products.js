'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const [results] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name='faqs';`
    );

    if (results.length === 0) {
      await queryInterface.addColumn('products', 'faqs', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'faqs');
  },
};
