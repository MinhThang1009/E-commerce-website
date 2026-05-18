'use strict';
/**
 * @file module.js
 * @layer Module
 * @module attribute
 * @description Entry point attribute module — khởi tạo dependencies và đăng ký routes
 */
const attributeService = require('@modules/attribute/services/attribute-service');

module.exports = () => {
  // Inject productNameGenerator từ ai module để tránh cross-module coupling trực tiếp trong service
  const nameGenerator = require('@modules/ai/services/product/product-name-generator');
  attributeService.setNameGenerator(nameGenerator);

  return {
    basePath: '/attributes',
    router: require('@modules/attribute/routes'),
    subscribeEvents() {},
  };
};
