/**
 * @file module.js
 * @layer Module
 * @module catalog
 * @description Entry point catalog module — khởi tạo dependencies và đăng ký routes
 */
const CatalogController = require('@modules/catalog/controllers/catalog-controller');
const CatalogService = require('@modules/catalog/services/catalog-service');
const SequelizeCatalogRepository = require('@modules/catalog/repositories/sequelize-catalog-repository');
const buildRoutes = require('@modules/catalog/routes');

// Catalog module — gộp Category, Brand (Sprint 6a) + Product (Sprint 6b).
// Trả `mounts` array để app.js mount nhiều base path khác nhau.
module.exports = ({
  Category,
  Brand,
  Product,
  ProductAttribute,
  ProductVariant,
  Review,
  RecentlyViewed,
  sequelize,
  eventBus,
  logger,
}) => {
  if (!Category) throw new Error('catalog module: Category model bắt buộc');
  if (!Brand) throw new Error('catalog module: Brand model bắt buộc');
  if (!Product) throw new Error('catalog module: Product model bắt buộc');
  if (!sequelize) throw new Error('catalog module: sequelize bắt buộc');

  const catalogRepository = new SequelizeCatalogRepository({
    Category,
    Brand,
    Product,
    ProductAttribute,
    ProductVariant,
    Review,
    RecentlyViewed,
    sequelize,
  });

  const catalogService = new CatalogService({
    catalogRepository,
    eventBus,
    logger,
  });
  const catalogController = new CatalogController({ catalogService });
  const routes = buildRoutes({ catalogController });

  return {
    mounts: [
      { basePath: '/categories', router: routes.categories },
      { basePath: '/brands', router: routes.brands },
      { basePath: '/products', router: routes.products },
    ],
    subscribeEvents() {},
  };
};
