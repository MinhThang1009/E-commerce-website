'use strict';
/**
 * Thin wrapper module — delegates to legacy flat router.
 * Migrated from routes/searchHistory.js as part of Gap 5 cleanup.
 */
module.exports = () => ({
  basePath: '/search-histories',
  router: require('../../routes/searchHistory'),
  subscribeEvents() {},
});
