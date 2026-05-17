'use strict';
/**
 * @file module.js
 * @layer Module
 * @module image
 * @description Entry point image module — khởi tạo dependencies và đăng ký routes
 */

/**
 * Thin wrapper module — delegates to legacy flat router.
 * Migrated from routes/image.js as part of Gap 5 cleanup.
 */
module.exports = () => ({
  basePath: '/images',
  router: require('./routes'),
  subscribeEvents() {},
});
