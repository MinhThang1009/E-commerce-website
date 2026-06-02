'use strict';

/**
 * Thêm role 'staff' (Nhân viên bán hàng) để tách bạch trách nhiệm:
 * - admin: quản trị hệ thống (người dùng, phân quyền, cấu hình, xem-only dashboard/analytics)
 * - staff: nghiệp vụ bán hàng (sản phẩm, đơn hàng, kho, mã giảm giá, đánh giá)
 * Trước đây admin kiêm cả hai — hội đồng đánh giá là hạn chế thiết kế role.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM('customer', 'staff', 'admin'),
      defaultValue: 'customer',
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // Hạ cấp mọi staff về customer trước khi bỏ giá trị enum để tránh dữ liệu mồ côi
    await queryInterface.sequelize.query("UPDATE users SET role = 'customer' WHERE role = 'staff'");
    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM('customer', 'admin'),
      defaultValue: 'customer',
      allowNull: false,
    });
  },
};
