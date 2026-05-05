const express = require('express');
const { authenticate } = require('../../shared/http/middlewares/authenticate');
const { authorize } = require('../../shared/http/middlewares/authorize');
const { validateRequest } = require('../../shared/http/middlewares/validateRequest');
const { httpCacheHeaders } = require('../../shared/http/middlewares/cache');
const {
  categorySchema,
  createBrandSchema, updateBrandSchema,
  createCollectionSchema, updateCollectionSchema,
} = require('./validators/catalogValidator');

// Catalog module routes — Sprint 6a: 3 sub-router (categories, brands,
// collections). Sprint 6b sẽ thêm 1 router product.
//
// URL không đổi so với routes/category.js + brand.js + collection.js cũ.
module.exports = ({ catalogController }) => {
  const categories = express.Router();
  categories.get('/', httpCacheHeaders(1800), catalogController.getAllCategories);
  categories.get('/tree', httpCacheHeaders(1800), catalogController.getCategoryTree);
  categories.get('/featured', httpCacheHeaders(1800), catalogController.getFeaturedCategories);
  categories.get('/slug/:slug', catalogController.getCategoryBySlug);
  categories.get('/:id/products', catalogController.getProductsByCategory);
  categories.get('/:id', catalogController.getCategoryById);
  categories.post('/', authenticate, authorize('admin'), validateRequest(categorySchema), catalogController.createCategory);
  categories.put('/:id', authenticate, authorize('admin'), validateRequest(categorySchema), catalogController.updateCategory);
  categories.delete('/:id', authenticate, authorize('admin'), catalogController.deleteCategory);

  const brands = express.Router();
  brands.get('/', catalogController.getAllBrands);
  brands.get('/slug/:slug', catalogController.getBrandBySlug);
  brands.get('/slug/:slug/products', catalogController.getProductsByBrand);
  brands.post('/', authenticate, authorize('admin'), validateRequest(createBrandSchema), catalogController.createBrand);
  brands.put('/:id', authenticate, authorize('admin'), validateRequest(updateBrandSchema), catalogController.updateBrand);
  brands.delete('/:id', authenticate, authorize('admin'), catalogController.deleteBrand);

  const collections = express.Router();
  collections.get('/', catalogController.getAllCollections);
  collections.get('/slug/:slug', catalogController.getCollectionBySlug);
  collections.get('/slug/:slug/products', catalogController.getProductsByCollection);
  collections.post('/', authenticate, authorize('admin'), validateRequest(createCollectionSchema), catalogController.createCollection);
  collections.put('/:id', authenticate, authorize('admin'), validateRequest(updateCollectionSchema), catalogController.updateCollection);
  collections.delete('/:id', authenticate, authorize('admin'), catalogController.deleteCollection);

  return { categories, brands, collections };
};
