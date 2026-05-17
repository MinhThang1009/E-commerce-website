const express = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');

// Inventory module routes — basePath '/inventory'. URL mới (legacy admin
// /restock vẫn giữ ở routes/admin.js đến Phase 5 cleanup).
module.exports = ({ inventoryController }) => {
  const router = express.Router();
  router.use(authenticate);
  router.use(authorize('admin'));

  router.post('/products/:productId/restock', inventoryController.restockProduct);
  router.get('/logs', inventoryController.getInventoryLogs);

  return router;
};
