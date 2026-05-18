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
const { httpCacheHeaders } = require('@middlewares/cache');
const { createOrderSchema, updateOrderStatusSchema } = require('@modules/orders/validators/orders-validator');

// Orders module routes — basePath '/orders'. URL không đổi so với routes/order.js cũ.
//
// Order matter: /track public + named paths trước /:id để paths không conflict.
module.exports = ({ ordersController }) => {
  const router = express.Router();

  // Public — order tracking (không cần auth)
  router.get('/track', httpCacheHeaders(0, { noStore: true }), ordersController.trackOrder);

  // User authenticated — không cache user data
  router.use(authenticate);
  router.use(httpCacheHeaders(0, { noStore: true }));

  router.post('/', validateRequest(createOrderSchema), ordersController.createOrder);
  router.get('/shipping-estimate', ordersController.estimateShipping);
  router.get('/', ordersController.getUserOrders);
  router.get('/number/:number', ordersController.getOrderByNumber);
  router.get('/:id', ordersController.getOrderById);
  router.post('/:id/cancel', ordersController.cancelOrder);
  router.post('/:id/repay', ordersController.repayOrder);
  router.post('/:id/receive', ordersController.confirmReceived);

  // Admin
  router.get('/admin/all', authorize('admin'), ordersController.getAllOrders);
  router.patch(
    '/admin/:id/status',
    authorize('admin'),
    validateRequest(updateOrderStatusSchema),
    ordersController.updateOrderStatus,
  );

  return router;
};
