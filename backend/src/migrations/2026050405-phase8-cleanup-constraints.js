'use strict';

module.exports = {
  // Dọn dẹp các FK constraint trùng lặp do Sequelize tự sinh (ibfk_) còn lại sau Phase 8,
  // xóa cột discountCodeId cũ không dùng, và xóa duplicate slug index trên products
  async up(queryInterface, Sequelize) {
    // ── Xóa FK cũ trùng lặp trên orders ──────────────────────────────────
    // orders_ibfk_1: FK userId → users.id với ON DELETE CASCADE (SAI — phải RESTRICT)
    // Đã được thay bằng fk_orders_users (RESTRICT) từ Phase 8
    await queryInterface.removeConstraint('orders', 'orders_ibfk_1');

    // orders_ibfk_2: FK trên cột discountCodeId (camelCase cũ, không dùng nữa)
    // discount_code_id (snake_case) là cột đang dùng, có FK riêng orders_discount_code_id_foreign_idx
    await queryInterface.removeConstraint('orders', 'orders_ibfk_2');

    // ── Xóa cột discountCodeId cũ (camelCase) không dùng nữa ─────────────
    // Phase 6 thêm cột discount_code_id (snake_case) thay thế, model đã map sang đó
    await queryInterface.removeColumn('orders', 'discountCodeId');

    // ── Xóa FK cũ trùng lặp trên order_items ─────────────────────────────
    // order_items_ibfk_1: FK orderId → orders.id (CASCADE) — trùng với fk_order_items_orders
    await queryInterface.removeConstraint('order_items', 'order_items_ibfk_1');

    // order_items_ibfk_2: FK productId → products.id với ON DELETE CASCADE (SAI — phải RESTRICT)
    // Đã được thay bằng fk_order_items_products (RESTRICT) từ Phase 8
    await queryInterface.removeConstraint('order_items', 'order_items_ibfk_2');

    // ── Xóa FK cũ trùng lặp trên product_categories ──────────────────────
    await queryInterface.removeConstraint('product_categories', 'product_categories_ibfk_1');
    await queryInterface.removeConstraint('product_categories', 'product_categories_ibfk_2');

    // ── Xóa duplicate slug unique index trên products ─────────────────────
    // Phase 6 đã tạo idx_products_slug (đúng convention), index cũ tên 'slug' là thừa
    await queryInterface.removeIndex('products', 'slug');
  },

  // Rollback: khôi phục cột discountCodeId và các FK cũ (chỉ dùng khi rollback toàn bộ Phase 8+)
  async down(queryInterface, Sequelize) {
    // Thêm lại cột discountCodeId
    await queryInterface.addColumn('orders', 'discountCodeId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Thêm lại index slug cũ trên products
    await queryInterface.addIndex('products', ['slug'], {
      name: 'slug',
      unique: true,
    });

    // Không khôi phục các ibfk_ constraints vì chúng đã được thay bằng fk_ có tên chuẩn
  },
};
