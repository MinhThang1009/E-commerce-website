'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const [res] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'specifications_en'`,
    );
    if (res.length === 0) {
      await queryInterface.addColumn('products', 'specifications_en', {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        after: 'specifications',
      });
      console.log('  ADDED: products.specifications_en');
    } else {
      console.log('  SKIP: products.specifications_en already exists');
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('products', 'specifications_en');
  },
};
