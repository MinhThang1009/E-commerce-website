/**
 * @file module.js
 * @layer Module
 * @module loyalty
 * @description Entry point loyalty module — khởi tạo dependencies và đăng ký routes
 */
const LoyaltyController = require('./controllers/loyaltyController');
const LoyaltyService = require('./services/loyaltyService');
const SequelizeLoyaltyRepository = require('./repositories/SequelizeLoyaltyRepository');
const buildRoutes = require('./routes');

module.exports = ({ User, LoyaltyHistory, sequelize, eventBus, logger }) => {
  if (!User) throw new Error('loyalty module: User model bắt buộc');
  if (!LoyaltyHistory) throw new Error('loyalty module: LoyaltyHistory model bắt buộc');

  const loyaltyRepository = new SequelizeLoyaltyRepository({ User, LoyaltyHistory, sequelize });
  const loyaltyService = new LoyaltyService({ loyaltyRepository, eventBus, logger });
  const loyaltyController = new LoyaltyController({ loyaltyService });
  const router = buildRoutes({ loyaltyController });

  return {
    basePath: '/loyalty',
    router,
    subscribeEvents() {},
  };
};
