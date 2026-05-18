/**
 * @file adminController.js
 * @layer Controller — Request/response handling
 * @module admin
 * @description Re-export handlers từ adminService.
 *
 * NOTE: adminService.js dùng catchAsync(req, res, next) pattern — handlers đã là HTTP-aware.
 * Controller layer chưa tách hoàn toàn khỏi service vì adminService là file 2000+ dòng.
 * TODO: Tách adminService thành pure service + proper controller trong sprint riêng.
 */
const adminService = require('@modules/admin/services/admin-service');

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
