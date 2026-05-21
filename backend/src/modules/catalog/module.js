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
  ProductSpecification,
  Review,
  RecentlyViewed,
  WarrantyPackage,
  sequelize,
  redisClient,
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
    ProductSpecification,
    Review,
    RecentlyViewed,
    WarrantyPackage,
    sequelize,
  });

  // Adapter: Redis → CacheStore port. delPattern wrap keys() + multiple del.
  const cacheStore = redisClient
    ? {
        async get(key) {
          const c = await redisClient();
          return c?.get?.(key) ?? null;
        },
        async setEx(key, ttl, val) {
          const c = await redisClient();
          if (c?.setEx) await c.setEx(key, ttl, val);
        },
        async del(key) {
          const c = await redisClient();
          if (c?.del) await c.del(key);
        },
        async delPattern(pattern) {
          const c = await redisClient();
          if (!c?.keys) return;
          const keys = await c.keys(pattern);
          if (keys && keys.length > 0) {
            await Promise.all(keys.map((k) => c.del(k)));
          }
        },
      }
    : null;

  const catalogService = new CatalogService({
    catalogRepository,
    cacheStore,
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
