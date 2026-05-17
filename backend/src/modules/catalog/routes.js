/**
 * @file routes.js
 * @layer Route
 * @module catalog
 * @description HTTP endpoints của catalog
 */
const express = require('express');
const { authenticate, optionalAuthenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validateRequest } = require('../../middlewares/validateRequest');
const { httpCacheHeaders } = require('../../middlewares/cache');
const {
  categorySchema,
  createBrandSchema,
  updateBrandSchema,
  createCollectionSchema,
  updateCollectionSchema,
  productSchema,
} = require('./validators/catalogValidator');

// Catalog module routes — 4 sub-router (categories, brands, collections, products).
// URL không đổi so với routes/category.js + brand.js + collection.js + product.js cũ.
module.exports = ({ catalogController }) => {
  const categories = express.Router();
  categories.get('/', httpCacheHeaders(1800), catalogController.getAllCategories);
  categories.get('/tree', httpCacheHeaders(1800), catalogController.getCategoryTree);
  categories.get('/featured', httpCacheHeaders(1800), catalogController.getFeaturedCategories);
  categories.get('/slug/:slug', catalogController.getCategoryBySlug);
  categories.get('/:id/products', catalogController.getProductsByCategory);
  categories.get('/:id', catalogController.getCategoryById);
  categories.post(
    '/',
    authenticate,
    authorize('admin'),
    validateRequest(categorySchema),
    catalogController.createCategory,
  );
  categories.put(
    '/:id',
    authenticate,
    authorize('admin'),
    validateRequest(categorySchema),
    catalogController.updateCategory,
  );
  categories.delete('/:id', authenticate, authorize('admin'), catalogController.deleteCategory);

  const brands = express.Router();
  brands.get('/', catalogController.getAllBrands);
  brands.get('/slug/:slug', catalogController.getBrandBySlug);
  brands.get('/slug/:slug/products', catalogController.getProductsByBrand);
  brands.post(
    '/',
    authenticate,
    authorize('admin'),
    validateRequest(createBrandSchema),
    catalogController.createBrand,
  );
  brands.put(
    '/:id',
    authenticate,
    authorize('admin'),
    validateRequest(updateBrandSchema),
    catalogController.updateBrand,
  );
  brands.delete('/:id', authenticate, authorize('admin'), catalogController.deleteBrand);

  const collections = express.Router();
  collections.get('/', catalogController.getAllCollections);
  collections.get('/slug/:slug', catalogController.getCollectionBySlug);
  collections.get('/slug/:slug/products', catalogController.getProductsByCollection);
  collections.post(
    '/',
    authenticate,
    authorize('admin'),
    validateRequest(createCollectionSchema),
    catalogController.createCollection,
  );
  collections.put(
    '/:id',
    authenticate,
    authorize('admin'),
    validateRequest(updateCollectionSchema),
    catalogController.updateCollection,
  );
  collections.delete('/:id', authenticate, authorize('admin'), catalogController.deleteCollection);

  // Product router — order matters: GET / + named paths trước /:id để
  // /:id không catch /featured, /deals, etc.
  const products = express.Router();
  products.get('/', httpCacheHeaders(60), catalogController.getAllProducts);
  products.get('/recently-viewed', authenticate, catalogController.getRecentlyViewed);
  products.get('/featured', httpCacheHeaders(600), catalogController.getFeaturedProducts);
  products.get('/new-arrivals', httpCacheHeaders(300), catalogController.getNewArrivals);
  products.get('/best-sellers', catalogController.getBestSellers);
  products.get('/deals', catalogController.getDeals);
  products.get('/filters', catalogController.getProductFilters);
  products.get('/search', catalogController.searchProducts);
  products.get('/suggestions', catalogController.getProductSuggestions);
  products.get(
    '/slug/:slug',
    httpCacheHeaders(300),
    optionalAuthenticate,
    catalogController.getProductBySlug,
  );
  products.get('/:id/related', catalogController.getRelatedProducts);
  products.get('/:id/variants', catalogController.getProductVariants);
  products.get('/:id/reviews-summary', catalogController.getProductReviewsSummary);
  products.get(
    '/:id',
    httpCacheHeaders(300),
    optionalAuthenticate,
    catalogController.getProductById,
  );
  products.post(
    '/',
    authenticate,
    authorize('admin'),
    validateRequest(productSchema),
    catalogController.createProduct,
  );
  products.put(
    '/:id',
    authenticate,
    authorize('admin'),
    validateRequest(productSchema),
    catalogController.updateProduct,
  );
  products.delete('/:id', authenticate, authorize('admin'), catalogController.deleteProduct);

  return { categories, brands, collections, products };
};
