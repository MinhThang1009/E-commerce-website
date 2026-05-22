/**
 * @file routes.js
 * @layer Route
 * @module catalog
 * @description HTTP endpoints của catalog
 */
const express = require('express');
const { authenticate, optionalAuthenticate } = require('@middlewares/authenticate');
const { authorize } = require('@middlewares/authorize');
const { validateRequest } = require('@middlewares/validate-request');
const {
  categorySchema,
  createBrandSchema,
  updateBrandSchema,
  productSchema,
} = require('@modules/catalog/validators/catalog-validator');

// Catalog module routes — 3 sub-router (categories, brands, products).
// URL không đổi so với routes/category.js + brand.js + product.js cũ.
module.exports = ({ catalogController }) => {
  /**
   * @swagger
   * /api/categories:
   *   get:
   *     summary: Lấy danh sách danh mục
   *     tags: [Categories]
   *   post:
   *     summary: Tạo danh mục mới (admin)
   *     tags: [Categories]
   *     security:
   *       - bearerAuth: []
   * /api/categories/tree:
   *   get:
   *     summary: Lấy cây danh mục phân cấp
   *     tags: [Categories]
   * /api/categories/featured:
   *   get:
   *     summary: Lấy danh mục nổi bật
   *     tags: [Categories]
   * /api/categories/slug/{slug}:
   *   get:
   *     summary: Lấy danh mục theo slug
   *     tags: [Categories]
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   * /api/categories/{id}:
   *   get:
   *     summary: Lấy danh mục theo ID
   *     tags: [Categories]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *   put:
   *     summary: Cập nhật danh mục (admin)
   *     tags: [Categories]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *   delete:
   *     summary: Xóa danh mục (admin)
   *     tags: [Categories]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   * /api/categories/{id}/products:
   *   get:
   *     summary: Lấy sản phẩm theo danh mục
   *     tags: [Categories]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   */
  const categories = express.Router();
  categories.get('/', catalogController.getAllCategories);
  categories.get('/tree', catalogController.getCategoryTree);
  categories.get('/featured', catalogController.getFeaturedCategories);
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

  /**
   * @swagger
   * /api/brands:
   *   get:
   *     summary: Lấy danh sách thương hiệu
   *     tags: [Brands]
   *   post:
   *     summary: Tạo thương hiệu mới (admin)
   *     tags: [Brands]
   *     security:
   *       - bearerAuth: []
   * /api/brands/slug/{slug}:
   *   get:
   *     summary: Lấy thương hiệu theo slug
   *     tags: [Brands]
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   * /api/brands/slug/{slug}/products:
   *   get:
   *     summary: Lấy sản phẩm theo thương hiệu
   *     tags: [Brands]
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   * /api/brands/{id}:
   *   put:
   *     summary: Cập nhật thương hiệu (admin)
   *     tags: [Brands]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *   delete:
   *     summary: Xóa thương hiệu (admin)
   *     tags: [Brands]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   */
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

  // Product router — order matters: GET / + named paths trước /:id để
  // /:id không catch /featured, /deals, etc.
  /**
   * @swagger
   * /api/products:
   *   get:
   *     summary: Lấy danh sách sản phẩm
   *     tags: [Products]
   *   post:
   *     summary: Tạo sản phẩm mới (admin)
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   * /api/products/recently-viewed:
   *   get:
   *     summary: Lấy sản phẩm đã xem gần đây
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   * /api/products/featured:
   *   get:
   *     summary: Lấy sản phẩm nổi bật
   *     tags: [Products]
   * /api/products/new-arrivals:
   *   get:
   *     summary: Lấy sản phẩm mới về
   *     tags: [Products]
   * /api/products/best-sellers:
   *   get:
   *     summary: Lấy sản phẩm bán chạy
   *     tags: [Products]
   * /api/products/deals:
   *   get:
   *     summary: Lấy sản phẩm đang giảm giá
   *     tags: [Products]
   * /api/products/filters:
   *   get:
   *     summary: Lấy các bộ lọc sản phẩm
   *     tags: [Products]
   * /api/products/search:
   *   get:
   *     summary: Tìm kiếm sản phẩm
   *     tags: [Products]
   * /api/products/suggestions:
   *   get:
   *     summary: Lấy gợi ý tìm kiếm sản phẩm
   *     tags: [Products]
   * /api/products/slug/{slug}:
   *   get:
   *     summary: Lấy sản phẩm theo slug
   *     tags: [Products]
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   * /api/products/{id}:
   *   get:
   *     summary: Lấy chi tiết sản phẩm theo ID
   *     tags: [Products]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *   put:
   *     summary: Cập nhật sản phẩm (admin)
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *   delete:
   *     summary: Xóa sản phẩm (admin)
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   * /api/products/{id}/related:
   *   get:
   *     summary: Lấy sản phẩm liên quan
   *     tags: [Products]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   * /api/products/{id}/variants:
   *   get:
   *     summary: Lấy các biến thể của sản phẩm
   *     tags: [Products]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   * /api/products/{id}/reviews-summary:
   *   get:
   *     summary: Lấy tóm tắt đánh giá của sản phẩm
   *     tags: [Products]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   */
  const products = express.Router();
  products.get('/', catalogController.getAllProducts);
  products.get('/recently-viewed', authenticate, catalogController.getRecentlyViewed);
  products.get('/featured', catalogController.getFeaturedProducts);
  products.get('/new-arrivals', catalogController.getNewArrivals);
  products.get('/best-sellers', catalogController.getBestSellers);
  products.get('/deals', catalogController.getDeals);
  products.get('/filters', catalogController.getProductFilters);
  products.get('/search', catalogController.searchProducts);
  products.get('/suggestions', catalogController.getProductSuggestions);
  products.get('/slug/:slug', optionalAuthenticate, catalogController.getProductBySlug);
  products.get('/:id/related', catalogController.getRelatedProducts);
  products.get('/:id/variants', catalogController.getProductVariants);
  products.get('/:id/reviews-summary', catalogController.getProductReviewsSummary);
  products.get('/:id', optionalAuthenticate, catalogController.getProductById);
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

  return { categories, brands, products };
};
