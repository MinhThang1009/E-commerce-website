/**
 * @file routes.js
 * @layer Route
 * @module inventory
 * @description HTTP endpoints của inventory
 */
const express = require('express');
const { authenticate } = require('@middlewares/authenticate');
const { authorize } = require('@middlewares/authorize');

// Inventory module routes — basePath '/inventory'. URL mới (legacy admin
// /restock vẫn giữ ở routes/admin.js đến Phase 5 cleanup).
module.exports = ({ inventoryController }) => {
  const router = express.Router();
  router.use(authenticate);
  router.use(authorize('admin'));

  /**
   * @swagger
   * /api/inventory/products/{productId}/restock:
   *   post:
   *     summary: Nhập thêm hàng cho sản phẩm (admin)
   *     tags: [Inventory]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   * /api/inventory/logs:
   *   get:
   *     summary: Lấy nhật ký nhập/xuất kho (admin)
   *     tags: [Inventory]
   *     security:
   *       - bearerAuth: []
   */
  router.post('/products/:productId/restock', inventoryController.restockProduct);
  router.get('/logs', inventoryController.getInventoryLogs);

  return router;
};
