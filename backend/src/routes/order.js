const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  createOrderSchema,
  updateOrderStatusSchema,
} = require('../validators/order');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { httpCacheHeaders } = require('../middlewares/cache');

// GET /api/orders/track?orderNumber=X&email=Y — Tra cứu đơn hàng công khai (không cần đăng nhập)
router.get('/track', httpCacheHeaders(0, { noStore: true }), orderController.trackOrder);

// Route của người dùng (yêu cầu xác thực) — không cache user data
router.use(authenticate);
router.use(httpCacheHeaders(0, { noStore: true }));
router.post(
  '/',
  validateRequest(createOrderSchema),
  orderController.createOrder
);

// GET /api/orders/shipping-estimate?subtotal=N&weight=N — Ước tính phí ship (frontend dùng để hiển thị)
router.get('/shipping-estimate', orderController.estimateShipping);
router.get('/', orderController.getUserOrders);
router.get('/number/:number', orderController.getOrderByNumber);
router.get('/:id', orderController.getOrderById);
router.post('/:id/cancel', orderController.cancelOrder);
router.post('/:id/repay', orderController.repayOrder);
router.post('/:id/receive', orderController.confirmReceived);

// Route của admin
router.get('/admin/all', authorize('admin'), orderController.getAllOrders);

router.patch(
  '/admin/:id/status',
  authorize('admin'),
  validateRequest(updateOrderStatusSchema),
  orderController.updateOrderStatus
);

module.exports = router;
