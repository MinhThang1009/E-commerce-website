'use strict';
/**
 * @file module.js
 * @layer Module
 * @module searchHistory
 * @description Entry point searchHistory module — khởi tạo dependencies và đăng ký routes
 */


module.exports = () => ({
  basePath: '/search-histories',
  router: require('./routes'),
  subscribeEvents() {},
});
