'use strict';
/**
 * Thin wrapper module — delegates to legacy flat router.
 * Migrated from routes/warrantyPackage.js as part of Gap 5 cleanup.
 */
module.exports = () => ({
  basePath: '/warranty-packages',
  router: require('./routes'),
  subscribeEvents() {},
});
