/**
 * @file catalogService.js
 * @layer Service
 * @module catalog
 * @description Business logic layer cho catalog — gộp 3 sub-domain: Category, Brand, Product.
 *   Methods được tách vào files riêng theo domain và mix vào prototype.
 * @depends-on sequelize-catalog-repository, eventBus, logger
 * @see module.js (DI wiring), routes.js (endpoints), CLAUDE.md (overview)
 */
const categoryMethods = require('./catalog-category-methods');
const brandMethods = require('./catalog-brand-methods');
const productMethods = require('./catalog-product-methods');

class CatalogService {
  constructor({ catalogRepository, eventBus, logger }) {
    this.catalogRepository = catalogRepository;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  RECENTLY_VIEWED_MAX = 20;
}

Object.assign(CatalogService.prototype, categoryMethods, brandMethods, productMethods);

module.exports = CatalogService;
