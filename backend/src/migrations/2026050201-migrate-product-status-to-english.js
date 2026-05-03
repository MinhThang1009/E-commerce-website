module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE products SET status = 'active'   WHERE status = 'Đang kinh doanh';
      UPDATE products SET status = 'inactive' WHERE status = 'Ngừng kinh doanh';
    `);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE products SET status = 'Đang kinh doanh' WHERE status = 'active';
      UPDATE products SET status = 'Ngừng kinh doanh' WHERE status = 'inactive';
    `);
  },
};
