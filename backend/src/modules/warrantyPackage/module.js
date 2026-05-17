'use strict';
/**
 * @file module.js
 * @layer Module
 * @module warrantyPackage
 * @description Entry point warrantyPackage module — khởi tạo dependencies và đăng ký routes
 */

/**
 * Thin wrapper module — delegates to legacy flat router.
 * Migrated from routes/warrantyPackage.js as part of Gap 5 cleanup.
 */
module.exports = () => ({
  basePath: '/warranty-packages',
  router: require('./routes'),
  subscribeEvents() {},
});
