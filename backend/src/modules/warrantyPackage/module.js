'use strict';
/**
 * @file module.js
 * @layer Module
 * @module warrantyPackage
 * @description Entry point warrantyPackage module — khởi tạo dependencies và đăng ký routes
 */

/**
 */
module.exports = () => ({
  basePath: '/warranty-packages',
  router: require('./routes'),
  subscribeEvents() {},
});
