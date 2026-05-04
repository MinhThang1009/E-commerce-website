const express = require('express');
const router = express.Router();

// Khai báo controllers
const adminController = require('../controllers/admin');
const adminImportController = require('../controllers/adminImport');
const discountCodeController = require('../controllers/discountCode');
const brandController = require('../controllers/brand');
const collectionController = require('../controllers/collection');

// Khai báo middlewares
const { adminAuthenticate } = require('../middlewares/adminAuth');
const { validate } = require('../middlewares/validateRequest');
const { auditMiddleware } = require('../services/admin/adminAudit');

// Khai báo validators
const {
  createProductValidation,
  updateProductValidation,
  updateUserValidation,
  updateOrderStatusValidation,
  paginationValidation,
  statsValidation,
  deleteValidation,
  getByIdValidation,
} = require('../validators/admin');
const {
  createDiscountCodeValidation,
  updateDiscountCodeValidation,
} = require('../validators/discountCode');

// Middleware cho tất cả admin routes
router.use(adminAuthenticate);
router.use(auditMiddleware);

/**
 * DASHBOARD & STATISTICS ROUTES
 */
// GET /api/admin/dashboard - Thống kê tổng quan
router.get('/dashboard', adminController.getDashboardStats);

// GET /api/admin/stats - Thống kê chi tiết theo thời gian
router.get(
  '/stats',
  validate(statsValidation),
  adminController.getDetailedStats
);

/**
 * USER MANAGEMENT ROUTES
 */
// GET /api/admin/users - Lấy danh sách user với filter
router.get(
  '/users',
  validate(paginationValidation),
  adminController.getAllUsers
);

// PUT /api/admin/users/:id - Cập nhật thông tin user
router.put(
  '/users/:id',
  validate(updateUserValidation),
  adminController.updateUser
);

// GET /api/admin/users/:id - Lấy chi tiết user
router.get(
  '/users/:id',
  validate(getByIdValidation),
  adminController.getUserById
);

// DELETE /api/admin/users/:id - Xóa user
router.delete(
  '/users/:id',
  validate(deleteValidation),
  adminController.deleteUser
);

/**
 * PRODUCT MANAGEMENT ROUTES
 */
// GET /api/admin/products - Lấy danh sách sản phẩm với filter admin
router.get(
  '/products',
  validate(paginationValidation),
  adminController.getAllProducts
);

/**
 * PRODUCT IMPORT/EXPORT ROUTES
 * Phải đặt trước /products/:id để không bị nhầm lẫn params
 */
// GET /api/admin/products/import-template — Download file CSV mẫu
router.get('/products/import-template', adminImportController.getImportTemplate);

// POST /api/admin/products/import — Upload CSV/JSON để import hàng loạt
router.post(
  '/products/import',
  adminImportController.uploadImportFile,
  adminImportController.importProducts
);

// GET /api/admin/products/import-history — Lịch sử import
router.get('/products/import-history', adminImportController.getImportHistory);

// GET /api/admin/products/export — Export tất cả sản phẩm (?format=csv|json)
router.get('/products/export', adminImportController.exportProducts);

// GET /api/admin/products/:id - Lấy chi tiết sản phẩm
router.get(
  '/products/:id',
  validate(getByIdValidation),
  adminController.getProductById
);

// POST /api/admin/products - Tạo sản phẩm mới
router.post(
  '/products',
  validate(createProductValidation),
  adminController.createProduct
);

// PUT /api/admin/products/:id - Cập nhật sản phẩm
router.put(
  '/products/:id',
  validate(updateProductValidation),
  adminController.updateProduct
);

// DELETE /api/admin/products/:id - Xóa sản phẩm
router.delete(
  '/products/:id',
  validate(deleteValidation),
  adminController.deleteProduct
);

// POST /api/admin/products/:id/clone - Clone sản phẩm
router.post(
  '/products/:id/clone',
  validate(getByIdValidation),
  adminController.cloneProduct
);

// PATCH /api/admin/products/:id/status - Cập nhật trạng thái nhanh
router.patch(
  '/products/:id/status',
  validate(getByIdValidation),
  adminController.toggleProductStatus
);

// POST /api/admin/products/:productId/restock — Nhập hàng cho sản phẩm hoặc biến thể
router.post('/products/:productId/restock', adminController.restockProduct);

/**
 * REVIEW MANAGEMENT ROUTES
 */
// GET /api/admin/reviews - Lấy danh sách review
router.get(
  '/reviews',
  validate(paginationValidation),
  adminController.getAllReviews
);

// DELETE /api/admin/reviews/:id - Xóa review
router.delete(
  '/reviews/:id',
  validate(deleteValidation),
  adminController.deleteReview
);

/**
 * ORDER MANAGEMENT ROUTES
 */
// GET /api/admin/orders - Lấy danh sách đơn hàng
router.get(
  '/orders',
  validate(paginationValidation),
  adminController.getAllOrders
);

// PUT /api/admin/orders/:id/status - Cập nhật trạng thái đơn hàng
router.put(
  '/orders/:id/status',
  validate(updateOrderStatusValidation),
  adminController.updateOrderStatus
);

/**
 * DISCOUNT CODE MANAGEMENT ROUTES
 */
// GET /api/admin/discount-codes - Lấy danh sách mã giảm giá
router.get(
  '/discount-codes',
  validate(paginationValidation),
  discountCodeController.getAllDiscountCodes
);

// GET /api/admin/discount-codes/:id - Lấy chi tiết mã giảm giá
router.get(
  '/discount-codes/:id',
  validate(getByIdValidation),
  discountCodeController.getDiscountCodeById
);

// POST /api/admin/discount-codes - Tạo mã giảm giá mới
router.post(
  '/discount-codes',
  validate(createDiscountCodeValidation),
  discountCodeController.createDiscountCode
);

// PUT /api/admin/discount-codes/:id - Cập nhật mã giảm giá
router.put(
  '/discount-codes/:id',
  validate(updateDiscountCodeValidation),
  discountCodeController.updateDiscountCode
);

// DELETE /api/admin/discount-codes/:id - Xóa mã giảm giá
router.delete(
  '/discount-codes/:id',
  validate(deleteValidation),
  discountCodeController.deleteDiscountCode
);

/**
 * BRAND MANAGEMENT ROUTES
 */
router.get('/brands', brandController.getAllBrands);
router.post('/brands', brandController.createBrand);
router.put('/brands/:id', brandController.updateBrand);
router.delete('/brands/:id', brandController.deleteBrand);

/**
 * COLLECTION MANAGEMENT ROUTES
 */
router.get('/collections', collectionController.getAllCollections);
router.post('/collections', collectionController.createCollection);
router.put('/collections/:id', collectionController.updateCollection);
router.delete('/collections/:id', collectionController.deleteCollection);

module.exports = router;
