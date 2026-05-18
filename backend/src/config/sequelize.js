const { Sequelize } = require('sequelize');
const config = require('@config/database');

const ENV = process.env.NODE_ENV || 'development';
const DB_CONFIG = config[ENV];

const sequelize = new Sequelize(
  DB_CONFIG.database,
  DB_CONFIG.username,
  DB_CONFIG.password,
  {
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    dialect: DB_CONFIG.dialect,
    logging: DB_CONFIG.logging,
    define: {
      ...DB_CONFIG.define,
      // Tắt tự động tạo ràng buộc khóa ngoại để tránh lỗi "Too many keys" của MySQL
      // Quan hệ FK được quản lý thủ công trong models/index.js
      freezeTableName: true,
    },
    dialectOptions: DB_CONFIG.dialectOptions,
    pool: DB_CONFIG.pool,
  }
);

module.exports = sequelize;
