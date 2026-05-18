'use strict';
/**
 * @file module.js
 * @layer Module
 * @module discountCode
 * @description Entry point discountCode module — khởi tạo dependencies và đăng ký routes
 */

/**
 */
module.exports = () => ({
  basePath: '/discount-codes',
  router: require('@modules/discount-code/routes'),
  subscribeEvents() {},
});
