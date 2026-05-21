const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

// Model lưu audit log các hành động của admin vào DB
// Cho phép query lịch sử hoạt động, detect bất thường, và báo cáo bảo mật
const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // ID admin thực hiện hành động
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Loại hành động: CREATE, UPDATE, DELETE, LOGIN, BAN, ROLE_CHANGE, CLONE, v.v.
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    // Loại entity bị tác động: product, order, user, discount_code, v.v.
    entityType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    // ID của entity cụ thể bị tác động
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Giá trị cũ trước khi thay đổi (JSON stringified)
    oldValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Giá trị mới sau khi thay đổi (JSON stringified)
    newValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // IP address của admin
    ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
  },
  {
    tableName: 'audit_logs',
    timestamps: true,
    underscored: true,
  },
);

module.exports = AuditLog;
