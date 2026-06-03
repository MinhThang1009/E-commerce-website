'use strict';
/**
 * @file module.js
 * @layer Module
 * @module admin
 * @description Entry point admin module — khởi tạo dependencies và đăng ký routes
 */

const adminOrderService = require('@modules/admin/services/admin-order-service');

/**
 * Admin module — thin wrapper quanh routes/admin.js.
 * Nhận `ordersService` (inject từ app.js) để delegate hủy/đổi-trạng-thái đơn về orders-service
 * (1 path chung — tránh logic trùng từng gây F8/F9/F11). Pattern setter giống attribute module.
 */
module.exports = ({ ordersService } = {}) => {
  if (ordersService) adminOrderService.setOrdersService(ordersService);
  return {
    basePath: '/admin',
    router: require('@modules/admin/routes'),
    subscribeEvents() {},
  };
};
