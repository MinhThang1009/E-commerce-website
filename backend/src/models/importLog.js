const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

// Model lưu lịch sử import sản phẩm của admin
// Cho phép xem lại kết quả từng lần import (bao nhiêu thành công/thất bại, lỗi ở đâu)
const ImportLog = sequelize.define(
  'ImportLog',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    // ID admin thực hiện import
    adminId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    // Tên file đã upload (csv/json)
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // Tổng số dòng trong file (không tính header)
    totalRows: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // Số dòng import thành công
    successRows: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // Số dòng thất bại
    failedRows: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // Chi tiết lỗi từng dòng: [{ row: number, field: string, message: string }]
    errorDetail: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    // Thời điểm import
    importedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'import_logs',
    // Không dùng createdAt/updatedAt — chỉ dùng imported_at
    timestamps: false,
    underscored: true,
  }
);

module.exports = ImportLog;
