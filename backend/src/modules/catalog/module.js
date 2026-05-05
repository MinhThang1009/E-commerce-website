const CatalogController = require('./controllers/catalogController');
const CatalogService = require('./services/catalogService');
const SequelizeCatalogRepository = require('./repositories/SequelizeCatalogRepository');
const buildRoutes = require('./routes');

// Catalog module — gộp Category, Brand, Collection (Sprint 6a) + Product
// (Sprint 6b). Trả `mounts` array để app.js mount nhiều base path khác nhau.
module.exports = ({
  Category, Brand, Collection, ProductCollection, Product,
  sequelize, redisClient, eventBus, logger,
}) => {
  if (!Category) throw new Error('catalog module: Category model bắt buộc');
  if (!Brand) throw new Error('catalog module: Brand model bắt buộc');
  if (!Collection) throw new Error('catalog module: Collection model bắt buộc');
  if (!ProductCollection) throw new Error('catalog module: ProductCollection model bắt buộc');
  if (!Product) throw new Error('catalog module: Product model bắt buộc');
  if (!sequelize) throw new Error('catalog module: sequelize bắt buộc');

  const catalogRepository = new SequelizeCatalogRepository({
    Category, Brand, Collection, ProductCollection, Product, sequelize,
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
    catalogRepository, cacheStore, eventBus, logger,
  });
  const catalogController = new CatalogController({ catalogService });
  const routes = buildRoutes({ catalogController });

  return {
    mounts: [
      { basePath: '/categories', router: routes.categories },
      { basePath: '/brands', router: routes.brands },
      { basePath: '/collections', router: routes.collections },
    ],
    subscribeEvents() {},
  };
};
