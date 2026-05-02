const { Sequelize } = require('sequelize');
const config = require('./database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    define: {
      ...dbConfig.define,
      // Tắt tự động tạo ràng buộc khóa ngoại để tránh lỗi "Too many keys" của MySQL
      // Quan hệ FK được quản lý thủ công trong models/index.js
      freezeTableName: true,
    },
    dialectOptions: dbConfig.dialectOptions,
    pool: dbConfig.pool,
  }
);

module.exports = sequelize;
