'use strict';
/**
 * @file module.js
 * @layer Module
 * @module admin
 * @description Entry point admin module — khởi tạo dependencies và đăng ký routes
 */

/**
 * Admin module — thin wrapper quanh routes/admin.js.
 */
module.exports = () => ({
  basePath: '/admin',
  router: require('./routes'),
  subscribeEvents() {},
});
