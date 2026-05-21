/**
 * Teardown cho E2E tests — đóng DB connection sau khi toàn bộ test suite chạy xong.
 */
require('module-alias/register');
const sequelize = require('../config/sequelize');

module.exports = async () => {
  await sequelize.close();
};
