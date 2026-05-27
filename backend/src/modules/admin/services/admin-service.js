/**
 * @file adminService.js
 * @layer Service
 * @module admin
 * @description Re-export tất cả admin domain services
 */
const statsService = require('./admin-stats-service');
const userService = require('./admin-user-service');
const productService = require('./admin-product-service');
const orderService = require('./admin-order-service');
const analyticsService = require('./admin-analytics-service');

module.exports = {
  ...statsService,
  ...userService,
  ...productService,
  ...orderService,
  ...analyticsService,
};
