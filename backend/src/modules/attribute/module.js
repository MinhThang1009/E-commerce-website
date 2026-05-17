'use strict';
/**
 * Thin wrapper module — delegates to legacy flat router.
 * Migrated from routes/attribute.js as part of Gap 5 cleanup.
 */
module.exports = () => ({
  basePath: '/attributes',
  router: require('./routes'),
  subscribeEvents() {},
});
