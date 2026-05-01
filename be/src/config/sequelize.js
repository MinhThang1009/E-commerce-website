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
      // Disable automatic foreign key constraint creation to prevent "Too many keys" MySQL error
      // We manage FK relationships manually in models/index.js
      freezeTableName: true,
    },
    dialectOptions: dbConfig.dialectOptions,
    pool: dbConfig.pool,
  }
);

module.exports = sequelize;
