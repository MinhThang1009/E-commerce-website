/**
 * @file routes.js
 * @layer Route
 * @module admin
 */
const express = require('express');
const router = express.Router();

const adminController = require('@modules/admin/controllers/admin-controller');
const adminImportController = require('@modules/admin/controllers/admin-import-controller');
const discountCodeController = require('@modules/discount-code/controllers/discount-code-controller');

const { adminAuthenticate } = require('@middlewares/admin-auth');
const { validateRequest } = require('@middlewares/validate-request');
const { auditMiddleware } = require('@shared/admin-audit');

const {
  paginationSchema,
  statsSchema,
  createProductSchema,
  updateProductSchema,
  updateUserSchema,
  updateOrderStatusSchema,
} = require('@modules/admin/validators/admin-validator');
const {
  createDiscountCodeSchema,
  updateDiscountCodeSchema,
} = require('@modules/discount-code/validators/discount-code-validator');

router.use(adminAuthenticate);
router.use(auditMiddleware);

// Dashboard & Stats
router.get('/dashboard', adminController.getDashboardStats);
router.get('/stats', validateRequest(statsSchema, 400, 'query'), adminController.getDetailedStats);

// Users
router.get('/users', validateRequest(paginationSchema, 400, 'query'), adminController.getAllUsers);
router.put('/users/:id', validateRequest(updateUserSchema), adminController.updateUser);
router.get('/users/:id', adminController.getUserById);
router.delete('/users/:id', adminController.deleteUser);

// Products
router.get('/products', validateRequest(paginationSchema, 400, 'query'), adminController.getAllProducts);

// Import/Export — trước /products/:id để tránh nhầm lẫn params
router.get('/products/import-template', adminImportController.getImportTemplate);
router.post('/products/import', adminImportController.uploadImportFile, adminImportController.importProducts);
router.get('/products/import-history', adminImportController.getImportHistory);
router.get('/products/export', adminImportController.exportProducts);

router.get('/products/:id', adminController.getProductById);
router.post('/products', validateRequest(createProductSchema), adminController.createProduct);
router.put('/products/:id', validateRequest(updateProductSchema), adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);
router.post('/products/:id/clone', adminController.cloneProduct);
router.patch('/products/:id/status', adminController.toggleProductStatus);
router.post('/products/:productId/restock', adminController.restockProduct);
router.patch('/products/:id/stock', adminController.updateProductStock);

// Reviews
router.get('/reviews', validateRequest(paginationSchema, 400, 'query'), adminController.getAllReviews);
router.delete('/reviews/:id', adminController.deleteReview);

// Orders
router.get('/orders', validateRequest(paginationSchema, 400, 'query'), adminController.getAllOrders);
router.put('/orders/:id/status', validateRequest(updateOrderStatusSchema), adminController.updateOrderStatus);
router.put('/orders/:id/cancel', adminController.adminCancelOrder);

// Discount Codes
router.get('/discount-codes', validateRequest(paginationSchema, 400, 'query'), discountCodeController.getAllDiscountCodes);
router.get('/discount-codes/:id', discountCodeController.getDiscountCodeById);
router.post('/discount-codes', validateRequest(createDiscountCodeSchema), discountCodeController.createDiscountCode);
router.put('/discount-codes/:id', validateRequest(updateDiscountCodeSchema), discountCodeController.updateDiscountCode);
router.delete('/discount-codes/:id', discountCodeController.deleteDiscountCode);

// Analytics
router.get('/analytics/order-status', adminController.getOrderStatusAnalytics);
router.get('/analytics/top-products', adminController.getTopProductsAnalytics);
router.get('/analytics/revenue-by-category', adminController.getRevenueByCategoryAnalytics);
router.get('/analytics/user-growth', adminController.getUserGrowthAnalytics);
router.get('/analytics/payment-methods', adminController.getPaymentMethodsAnalytics);
router.get('/analytics/low-stock', adminController.getLowStockAnalytics);

// Reports & Chatbot & Audit
router.get('/reports/export', adminController.exportReport);
router.get('/chatbot/stats', adminController.getChatbotStats);
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
