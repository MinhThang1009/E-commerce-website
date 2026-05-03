const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

// Model ghi lại mọi thay đổi tồn kho (bán hàng, nhập hàng, điều chỉnh, hoàn trả)
const InventoryLog = sequelize.define(
  'InventoryLog',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id',
    },
    // null = sản phẩm không có variant; có giá trị = biến thể cụ thể bị thay đổi stock
    variantId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'variant_id',
    },
    // Loại thay đổi: sale (bán), restock (nhập hàng), adjustment (điều chỉnh thủ công), return (hoàn trả)
    changeType: {
      type: DataTypes.ENUM('sale', 'restock', 'adjustment', 'return'),
      allowNull: false,
      field: 'change_type',
    },
    // Số lượng thay đổi (dương = tăng stock, âm = giảm stock)
    changeAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'change_amount',
    },
    // Stock trước khi thay đổi — dùng để audit
    previousStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'previous_stock',
    },
    // Stock sau khi thay đổi
    newStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'new_stock',
    },
    // null = thay đổi không liên quan đến đơn hàng (nhập hàng, điều chỉnh)
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'order_id',
    },
    note: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // null = hành động tự động bởi hệ thống
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by',
    },
  },
  {
    tableName: 'inventory_logs',
    timestamps: true,
    updatedAt: false, // Log bất biến — không cần updatedAt
    underscored: true,
  }
);

module.exports = InventoryLog;
