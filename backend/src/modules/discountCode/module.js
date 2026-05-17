'use strict';
/**
 * Thin wrapper module — delegates to legacy flat router.
 * Migrated from routes/discountCode.js as part of Gap 5 cleanup.
 */
module.exports = () => ({
  basePath: '/discount-codes',
  router: require('../../routes/discountCode'),
  subscribeEvents() {},
});
