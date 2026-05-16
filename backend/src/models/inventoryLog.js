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
    },
    // null = sản phẩm không có variant; có giá trị = biến thể cụ thể bị thay đổi stock
    variantId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Loại thay đổi: sale (bán), restock (nhập hàng), adjustment (điều chỉnh thủ công), return (hoàn trả)
    changeType: {
      type: DataTypes.ENUM('sale', 'restock', 'adjustment', 'return'),
      allowNull: false,
    },
    // Số lượng thay đổi (dương = tăng stock, âm = giảm stock)
    changeAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Stock trước khi thay đổi — dùng để audit
    previousStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Stock sau khi thay đổi
    newStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // null = thay đổi không liên quan đến đơn hàng (nhập hàng, điều chỉnh)
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    note: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // null = hành động tự động bởi hệ thống
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
