'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Kiểm tra cột sku đã tồn tại chưa — nếu chưa thì thêm
    const [results] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name='sku';`
    );

    if (results.length === 0) {
      await queryInterface.addColumn('products', 'sku', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      });
    }

    // Kiểm tra cột status đã tồn tại chưa — nếu chưa thì thêm
    const [statusResults] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name='status';`
    );

    if (statusResults.length === 0) {
      // MySQL: ENUM là inline trong column definition, không cần CREATE TYPE riêng
      await queryInterface.addColumn('products', 'status', {
        type: Sequelize.ENUM('active', 'inactive', 'draft'),
        defaultValue: 'active',
        allowNull: false,
      });

      // Gán giá trị mặc định cho sản phẩm cũ — dùng MySQL syntax (backtick, không casting)
      await queryInterface.sequelize.query(`
        UPDATE \`products\`
        SET \`status\` = CASE
          WHEN \`in_stock\` = 1 THEN 'active'
          ELSE 'inactive'
        END
        WHERE \`status\` IS NULL
      `);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'sku');
    // Sequelize tự xóa ENUM column trong MySQL — không cần DROP TYPE riêng
    await queryInterface.removeColumn('products', 'status');
  },
};
