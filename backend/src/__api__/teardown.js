require('module-alias/register');
module.exports = async () => {
  const sequelize = require('@config/sequelize');
  await sequelize.close().catch(() => {});
};
