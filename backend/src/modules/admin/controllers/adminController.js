/**
 * @file adminController.js
 * @layer Controller — Request/response handling
 * @module admin
 * @description Thin controller layer cho admin module.
 *   Toàn bộ business logic và ORM nằm trong adminService.js.
 *   Controller chỉ re-export các handler từ service.
 */
const adminService = require('../services/adminService');

module.exports = {
  getDashboardStats: adminService.getDashboardStats,
  getDetailedStats: adminService.getDetailedStats,
  getAllUsers: adminService.getAllUsers,
  updateUser: adminService.updateUser,
  deleteUser: adminService.deleteUser,
  getUserById: adminService.getUserById,
  getProductById: adminService.getProductById,
  createProduct: adminService.createProduct,
  updateProduct: adminService.updateProduct,
  deleteProduct: adminService.deleteProduct,
  cloneProduct: adminService.cloneProduct,
  toggleProductStatus: adminService.toggleProductStatus,
  getAllProducts: adminService.getAllProducts,
  getAllReviews: adminService.getAllReviews,
  deleteReview: adminService.deleteReview,
  getAllOrders: adminService.getAllOrders,
  updateOrderStatus: adminService.updateOrderStatus,
  adminCancelOrder: adminService.adminCancelOrder,
  updateProductStock: adminService.updateProductStock,
  restockProduct: adminService.restockProduct,
  getAuditLogs: adminService.getAuditLogs,
  getOrderStatusAnalytics: adminService.getOrderStatusAnalytics,
  getTopProductsAnalytics: adminService.getTopProductsAnalytics,
  getRevenueByCategoryAnalytics: adminService.getRevenueByCategoryAnalytics,
  getUserGrowthAnalytics: adminService.getUserGrowthAnalytics,
  getPaymentMethodsAnalytics: adminService.getPaymentMethodsAnalytics,
  getLowStockAnalytics: adminService.getLowStockAnalytics,
  exportReport: adminService.exportReport,
  getChatbotStats: adminService.getChatbotStats,
};
