'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── 6.1 Rename price → unit_price in cart_items ──────────────────────────
    await queryInterface.renameColumn('cart_items', 'price', 'unit_price');

    // ── 6.1 Rename price → unit_price in order_items ─────────────────────────
    await queryInterface.renameColumn('order_items', 'price', 'unit_price');

    // ── 6.2 Add discountAmount to order_items ────────────────────────────────
    await queryInterface.addColumn('order_items', 'discount_amount', {
      type: Sequelize.DECIMAL(19, 2),
      allowNull: false,
      defaultValue: 0,
    });

    // ── 6.2 Add missing fields to orders ─────────────────────────────────────
    await queryInterface.addColumn('orders', 'discount_code_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'discount_codes', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('orders', 'cancelled_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('orders', 'refunded_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('orders', 'refund_amount', {
      type: Sequelize.DECIMAL(19, 2),
      allowNull: true,
    });

    // ── 6.2 Add weight & dimensions to product_variants ──────────────────────
    await queryInterface.addColumn('product_variants', 'weight', {
      type: Sequelize.DECIMAL(10, 3),
      allowNull: true,
      comment: 'Cân nặng tính theo kg',
    });

    await queryInterface.addColumn('product_variants', 'dimensions', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Kích thước { length, width, height } tính theo cm',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('product_variants', 'dimensions');
    await queryInterface.removeColumn('product_variants', 'weight');
    await queryInterface.removeColumn('orders', 'refund_amount');
    await queryInterface.removeColumn('orders', 'refunded_at');
    await queryInterface.removeColumn('orders', 'cancelled_at');
    await queryInterface.removeColumn('orders', 'discount_code_id');
    await queryInterface.removeColumn('order_items', 'discount_amount');
    await queryInterface.renameColumn('order_items', 'unit_price', 'price');
    await queryInterface.renameColumn('cart_items', 'unit_price', 'price');
  },
};
