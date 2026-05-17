'use strict';
/**
 * @file module.js
 * @layer Module
 * @module image
 * @description Entry point image module — khởi tạo dependencies và đăng ký routes
 */

/**
 */
module.exports = () => ({
  basePath: '/images',
  router: require('./routes'),
  subscribeEvents() {},
});
