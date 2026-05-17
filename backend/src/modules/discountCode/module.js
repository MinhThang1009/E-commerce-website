'use strict';
/**
 * @file module.js
 * @layer Module
 * @module discountCode
 * @description Entry point discountCode module — khởi tạo dependencies và đăng ký routes
 */

/**
 * Thin wrapper module — delegates to legacy flat router.
 * Migrated from routes/discountCode.js as part of Gap 5 cleanup.
 */
module.exports = () => ({
  basePath: '/discount-codes',
  router: require('./routes'),
  subscribeEvents() {},
});
