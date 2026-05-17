const express = require('express');
const router = express.Router();

// Controllers
const adminController = require('./controllers/adminController');
const adminImportController = require('./controllers/adminImportController');
const discountCodeController = require('../discountCode/controllers/discountCodeController');

// Middlewares
const { adminAuthenticate } = require('../../middlewares/adminAuth');
const { validate } = require('../../middlewares/validateRequest');
const { auditMiddleware } = require('../../services/adminAudit');

// Validators
const {
  createProductValidation,
  updateProductValidation,
  updateUserValidation,
  updateOrderStatusValidation,
  paginationValidation,
  statsValidation,
  deleteValidation,
  getByIdValidation,
} = require('./validators/adminValidator');
const {
  createDiscountCodeValidation,
  updateDiscountCodeValidation,
} = require('../discountCode/validators/discountCodeValidator');

// Middleware cho tất cả admin routes
router.use(adminAuthenticate);
router.use(auditMiddleware);

/**
 * DASHBOARD & STATISTICS ROUTES
 */
router.get('/dashboard', adminController.getDashboardStats);
router.get('/stats', validate(statsValidation), adminController.getDetailedStats);

/**
 * USER MANAGEMENT ROUTES
 */
router.get('/users', validate(paginationValidation), adminController.getAllUsers);
router.put('/users/:id', validate(updateUserValidation), adminController.updateUser);
router.get('/users/:id', validate(getByIdValidation), adminController.getUserById);
router.delete('/users/:id', validate(deleteValidation), adminController.deleteUser);

/**
 * PRODUCT MANAGEMENT ROUTES
 */
router.get('/products', validate(paginationValidation), adminController.getAllProducts);

// Import/Export — phải đặt trước /products/:id để không bị nhầm lẫn params
router.get('/products/import-template', adminImportController.getImportTemplate);
router.post(
  '/products/import',
  adminImportController.uploadImportFile,
  adminImportController.importProducts,
);
router.get('/products/import-history', adminImportController.getImportHistory);
router.get('/products/export', adminImportController.exportProducts);

router.get('/products/:id', validate(getByIdValidation), adminController.getProductById);
router.post('/products', validate(createProductValidation), adminController.createProduct);
router.put('/products/:id', validate(updateProductValidation), adminController.updateProduct);
router.delete('/products/:id', validate(deleteValidation), adminController.deleteProduct);
router.post('/products/:id/clone', validate(getByIdValidation), adminController.cloneProduct);
router.patch(
  '/products/:id/status',
  validate(getByIdValidation),
  adminController.toggleProductStatus,
);
router.post('/products/:productId/restock', adminController.restockProduct);
router.patch('/products/:id/stock', adminController.updateProductStock);

/**
 * REVIEW MANAGEMENT ROUTES
 */
router.get('/reviews', validate(paginationValidation), adminController.getAllReviews);
router.delete('/reviews/:id', validate(deleteValidation), adminController.deleteReview);

/**
 * ORDER MANAGEMENT ROUTES
 */
router.get('/orders', validate(paginationValidation), adminController.getAllOrders);
router.put(
  '/orders/:id/status',
  validate(updateOrderStatusValidation),
  adminController.updateOrderStatus,
);
router.put('/orders/:id/cancel', adminController.adminCancelOrder);

/**
 * DISCOUNT CODE MANAGEMENT ROUTES
 */
router.get(
  '/discount-codes',
  validate(paginationValidation),
  discountCodeController.getAllDiscountCodes,
);
router.get(
  '/discount-codes/:id',
  validate(getByIdValidation),
  discountCodeController.getDiscountCodeById,
);
router.post(
  '/discount-codes',
  validate(createDiscountCodeValidation),
  discountCodeController.createDiscountCode,
);
router.put(
  '/discount-codes/:id',
  validate(updateDiscountCodeValidation),
  discountCodeController.updateDiscountCode,
);
router.delete(
  '/discount-codes/:id',
  validate(deleteValidation),
  discountCodeController.deleteDiscountCode,
);

/**
 * ANALYTICS ROUTES
 */
router.get('/analytics/order-status', adminController.getOrderStatusAnalytics);
router.get('/analytics/top-products', adminController.getTopProductsAnalytics);
router.get('/analytics/revenue-by-category', adminController.getRevenueByCategoryAnalytics);
router.get('/analytics/user-growth', adminController.getUserGrowthAnalytics);
router.get('/analytics/payment-methods', adminController.getPaymentMethodsAnalytics);
router.get('/analytics/low-stock', adminController.getLowStockAnalytics);

/**
 * REPORT EXPORT ROUTES
 */
router.get('/reports/export', adminController.exportReport);

/**
 * CHATBOT ANALYTICS ROUTES
 */
router.get('/chatbot/stats', adminController.getChatbotStats);

/**
 * AUDIT LOG ROUTES
 */
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
