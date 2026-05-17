'use strict';
/**
 * @file module.js
 * @layer Module
 * @module admin
 * @description Entry point admin module — khởi tạo dependencies và đăng ký routes
 */

/**
 * Admin module — thin wrapper quanh routes/admin.js.
 * Bước 1 của Gap 5 migration: di chuyển khỏi routes/index.js → app.js.
 * Bước 2 (future): tách admin.js thành domain-specific sub-modules
 *   (users, catalog, orders, analytics, audit).
 */
module.exports = () => ({
  basePath: '/admin',
  router: require('./routes'),
  subscribeEvents() {},
});
