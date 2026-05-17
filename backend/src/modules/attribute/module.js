'use strict';
/**
 * @file module.js
 * @layer Module
 * @module attribute
 * @description Entry point attribute module — khởi tạo dependencies và đăng ký routes
 */

/**
 */
module.exports = () => ({
  basePath: '/attributes',
  router: require('./routes'),
  subscribeEvents() {},
});
