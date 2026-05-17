'use strict';
/**
 * Admin module — thin wrapper quanh routes/admin.js.
 * Bước 1 của Gap 5 migration: di chuyển khỏi routes/index.js → app.js.
 * Bước 2 (future): tách admin.js thành domain-specific sub-modules
 *   (users, catalog, orders, analytics, audit).
 */
module.exports = () => ({
  basePath: '/admin',
  router: require('../../routes/admin'),
  subscribeEvents() {},
});
