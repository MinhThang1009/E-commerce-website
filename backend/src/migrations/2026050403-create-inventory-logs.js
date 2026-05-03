'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventory_logs', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // null = sản phẩm không có variant
      variant_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'product_variants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      change_type: {
        type: Sequelize.ENUM('sale', 'restock', 'adjustment', 'return'),
        allowNull: false,
      },
      // Dương = tăng stock (restock/return), âm = giảm stock (sale)
      change_amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      previous_stock: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      new_stock: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      note: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      // null = hành động tự động bởi hệ thống
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Index thường dùng để tra cứu log theo sản phẩm, variant, đơn hàng
    await queryInterface.addIndex('inventory_logs', ['product_id'], {
      name: 'idx_inventory_logs_product_id',
    });
    await queryInterface.addIndex('inventory_logs', ['variant_id'], {
      name: 'idx_inventory_logs_variant_id',
    });
    await queryInterface.addIndex('inventory_logs', ['order_id'], {
      name: 'idx_inventory_logs_order_id',
    });
    await queryInterface.addIndex('inventory_logs', ['change_type'], {
      name: 'idx_inventory_logs_change_type',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inventory_logs');
  },
};
