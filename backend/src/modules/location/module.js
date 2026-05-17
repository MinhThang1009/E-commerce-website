'use strict';
/**
 * Thin wrapper module — delegates to legacy flat router.
 * Migrated from routes/location.js as part of Gap 5 cleanup.
 */
module.exports = () => ({
  basePath: '/locations',
  router: require('../../routes/location'),
  subscribeEvents() {},
});
