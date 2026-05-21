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
/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Lấy thống kê tổng quan dashboard
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/dashboard', adminController.getDashboardStats);
/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Lấy thống kê chi tiết theo khoảng thời gian
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', validateRequest(statsSchema, 400, 'query'), adminController.getDetailedStats);

// Users
/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Lấy danh sách tất cả người dùng
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/users', validateRequest(paginationSchema, 400, 'query'), adminController.getAllUsers);
/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Lấy thông tin người dùng theo ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *   put:
 *     summary: Cập nhật thông tin người dùng
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *   delete:
 *     summary: Xóa người dùng
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.put('/users/:id', validateRequest(updateUserSchema), adminController.updateUser);
router.get('/users/:id', adminController.getUserById);
router.delete('/users/:id', adminController.deleteUser);

// Products
/**
 * @swagger
 * /api/admin/products:
 *   get:
 *     summary: Lấy danh sách sản phẩm (admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *   post:
 *     summary: Tạo sản phẩm mới
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/products',
  validateRequest(paginationSchema, 400, 'query'),
  adminController.getAllProducts,
);

// Import/Export — trước /products/:id để tránh nhầm lẫn params
/**
 * @swagger
 * /api/admin/products/import-template:
 *   get:
 *     summary: Tải template import sản phẩm
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 * /api/admin/products/import:
 *   post:
 *     summary: Import sản phẩm từ file Excel/CSV
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 * /api/admin/products/export:
 *   get:
 *     summary: Xuất danh sách sản phẩm ra file
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/products/import-template', adminImportController.getImportTemplate);
router.post(
  '/products/import',
  adminImportController.uploadImportFile,
  adminImportController.importProducts,
);
router.get('/products/export', adminImportController.exportProducts);

/**
 * @swagger
 * /api/admin/products/{id}:
 *   get:
 *     summary: Lấy chi tiết sản phẩm theo ID (admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *   put:
 *     summary: Cập nhật sản phẩm
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *   delete:
 *     summary: Xóa sản phẩm
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 * /api/admin/products/{id}/clone:
 *   post:
 *     summary: Nhân bản sản phẩm
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 * /api/admin/products/{id}/status:
 *   patch:
 *     summary: Bật/tắt trạng thái hiển thị sản phẩm
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 * /api/admin/products/{id}/stock:
 *   patch:
 *     summary: Cập nhật tồn kho sản phẩm
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 * /api/admin/products/{productId}/restock:
 *   post:
 *     summary: Nhập thêm hàng cho sản phẩm
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 */
router.get('/products/:id', adminController.getProductById);
router.post('/products', validateRequest(createProductSchema), adminController.createProduct);
router.put('/products/:id', validateRequest(updateProductSchema), adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);
router.post('/products/:id/clone', adminController.cloneProduct);
router.patch('/products/:id/status', adminController.toggleProductStatus);
router.post('/products/:productId/restock', adminController.restockProduct);
router.patch('/products/:id/stock', adminController.updateProductStock);

// Reviews
/**
 * @swagger
 * /api/admin/reviews:
 *   get:
 *     summary: Lấy tất cả đánh giá (admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 * /api/admin/reviews/{id}:
 *   delete:
 *     summary: Xóa đánh giá
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get(
  '/reviews',
  validateRequest(paginationSchema, 400, 'query'),
  adminController.getAllReviews,
);
router.delete('/reviews/:id', adminController.deleteReview);

// Orders
/**
 * @swagger
 * /api/admin/orders:
 *   get:
 *     summary: Lấy tất cả đơn hàng (admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 * /api/admin/orders/{id}/status:
 *   put:
 *     summary: Cập nhật trạng thái đơn hàng
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 * /api/admin/orders/{id}/cancel:
 *   put:
 *     summary: Hủy đơn hàng (admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get(
  '/orders',
  validateRequest(paginationSchema, 400, 'query'),
  adminController.getAllOrders,
);
router.put(
  '/orders/:id/status',
  validateRequest(updateOrderStatusSchema),
  adminController.updateOrderStatus,
);
router.put('/orders/:id/cancel', adminController.adminCancelOrder);

// Discount Codes
/**
 * @swagger
 * /api/admin/discount-codes:
 *   get:
 *     summary: Lấy danh sách mã giảm giá (admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *   post:
 *     summary: Tạo mã giảm giá mới
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 * /api/admin/discount-codes/{id}:
 *   get:
 *     summary: Lấy chi tiết mã giảm giá
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *   put:
 *     summary: Cập nhật mã giảm giá
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *   delete:
 *     summary: Xóa mã giảm giá
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get(
  '/discount-codes',
  validateRequest(paginationSchema, 400, 'query'),
  discountCodeController.getAllDiscountCodes,
);
router.get('/discount-codes/:id', discountCodeController.getDiscountCodeById);
router.post(
  '/discount-codes',
  validateRequest(createDiscountCodeSchema),
  discountCodeController.createDiscountCode,
);
router.put(
  '/discount-codes/:id',
  validateRequest(updateDiscountCodeSchema),
  discountCodeController.updateDiscountCode,
);
router.delete('/discount-codes/:id', discountCodeController.deleteDiscountCode);

// Analytics
/**
 * @swagger
 * /api/admin/analytics/order-status:
 *   get:
 *     summary: Thống kê đơn hàng theo trạng thái
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 * /api/admin/analytics/top-products:
 *   get:
 *     summary: Thống kê sản phẩm bán chạy
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 * /api/admin/analytics/revenue-by-category:
 *   get:
 *     summary: Thống kê doanh thu theo danh mục
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 * /api/admin/analytics/user-growth:
 *   get:
 *     summary: Thống kê tăng trưởng người dùng
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 * /api/admin/analytics/payment-methods:
 *   get:
 *     summary: Thống kê phương thức thanh toán
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 * /api/admin/analytics/low-stock:
 *   get:
 *     summary: Thống kê sản phẩm sắp hết hàng
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/analytics/order-status', adminController.getOrderStatusAnalytics);
router.get('/analytics/top-products', adminController.getTopProductsAnalytics);
router.get('/analytics/revenue-by-category', adminController.getRevenueByCategoryAnalytics);
router.get('/analytics/user-growth', adminController.getUserGrowthAnalytics);
router.get('/analytics/payment-methods', adminController.getPaymentMethodsAnalytics);
router.get('/analytics/low-stock', adminController.getLowStockAnalytics);

// Reports & Chatbot & Audit
/**
 * @swagger
 * /api/admin/reports/export:
 *   get:
 *     summary: Xuất báo cáo tổng hợp
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 * /api/admin/chatbot/stats:
 *   get:
 *     summary: Thống kê chatbot AI
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 * /api/admin/audit-logs:
 *   get:
 *     summary: Lấy nhật ký thao tác admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get('/reports/export', adminController.exportReport);
router.get('/chatbot/stats', adminController.getChatbotStats);
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
