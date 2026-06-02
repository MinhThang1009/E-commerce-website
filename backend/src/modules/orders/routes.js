/**
 * @file routes.js
 * @layer Route
 * @module orders
 * @description HTTP endpoints của orders
 */
const express = require('express');
const { authenticate } = require('@middlewares/authenticate');
const { authorize } = require('@middlewares/authorize');
const { validateRequest } = require('@middlewares/validate-request');
const {
  createOrderSchema,
  updateOrderStatusSchema,
} = require('@modules/orders/validators/orders-validator');

// Orders module routes — basePath '/orders'. URL không đổi so với routes/order.js cũ.
//
// Order matter: /track public + named paths trước /:id để paths không conflict.
module.exports = ({ ordersController }) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/orders/track:
   *   get:
   *     summary: Tra cứu đơn hàng (không cần đăng nhập)
   *     tags: [Orders]
   * /api/orders:
   *   get:
   *     summary: Lấy danh sách đơn hàng của người dùng
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *   post:
   *     summary: Tạo đơn hàng mới
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   * /api/orders/shipping-estimate:
   *   get:
   *     summary: Ước tính phí vận chuyển
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   * /api/orders/number/{number}:
   *   get:
   *     summary: Lấy đơn hàng theo mã đơn
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: number
   *         required: true
   *         schema:
   *           type: string
   * /api/orders/{id}:
   *   get:
   *     summary: Lấy chi tiết đơn hàng theo ID
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   * /api/orders/{id}/cancel:
   *   post:
   *     summary: Hủy đơn hàng
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   * /api/orders/{id}/repay:
   *   post:
   *     summary: Thanh toán lại đơn hàng
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   * /api/orders/{id}/receive:
   *   post:
   *     summary: Xác nhận đã nhận hàng
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   * /api/orders/admin/all:
   *   get:
   *     summary: Lấy tất cả đơn hàng (admin)
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   * /api/orders/admin/{id}/status:
   *   patch:
   *     summary: Cập nhật trạng thái đơn hàng (admin)
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   */
  // Public — order tracking (không cần auth)
  router.get('/track', ordersController.trackOrder);

  // User authenticated
  router.use(authenticate);

  router.post('/', validateRequest(createOrderSchema), ordersController.createOrder);
  router.get('/shipping-estimate', ordersController.estimateShipping);
  router.get('/', ordersController.getUserOrders);
  router.get('/number/:number', ordersController.getOrderByNumber);

  // Back-office — phải đứng trước /:id để tránh Express match "admin" như một id.
  // Xem danh sách đơn → admin (giám sát) + staff; cập nhật trạng thái → staff (nghiệp vụ bán hàng)
  router.get('/admin/all', authorize('admin', 'staff'), ordersController.getAllOrders);
  router.patch(
    '/admin/:id/status',
    authorize('staff'),
    validateRequest(updateOrderStatusSchema),
    ordersController.updateOrderStatus,
  );

  // /:id phải đứng sau các static routes (/admin/all, /number/:number, /shipping-estimate)
  router.get('/:id', ordersController.getOrderById);
  router.post('/:id/cancel', ordersController.cancelOrder);
  router.post('/:id/repay', ordersController.repayOrder);
  router.post('/:id/receive', ordersController.confirmReceived);

  return router;
};
