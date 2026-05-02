const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

// Route webhook (không cần xác thực)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

// Route webhook SePay (không cần xác thực)
router.post(
  '/sepay-webhook',
  express.json(), // SePay gửi dữ liệu dạng JSON
  paymentController.handleSePayWebhook
);

// Route return/IPN của MoMo (không cần xác thực)
router.get('/momo/return', paymentController.momoReturn);
router.post('/momo/ipn', paymentController.momoIPN);

// Route return/IPN của VNPay (không cần xác thực)
router.get('/vnpay/return', paymentController.vnpayReturn);
router.get('/vnpay/ipn', paymentController.vnpayIPN);

// Các route yêu cầu xác thực
router.use(authenticate);

// Tạo payment intent
router.post('/create-payment-intent', paymentController.createPaymentIntent);

// Xác nhận thanh toán
router.post('/confirm-payment', paymentController.confirmPayment);

// MoMo tạo URL thanh toán
router.post('/momo/create-url', paymentController.createMomoUrl);

// VNPay tạo URL thanh toán
router.post('/vnpay/create-url', paymentController.createVNPayUrl);

// Quản lý khách hàng
router.post('/create-customer', paymentController.createCustomer);
router.get('/payment-methods', paymentController.getPaymentMethods);
router.post('/create-setup-intent', paymentController.createSetupIntent);

// Route của admin
router.post('/refund', authorize('admin'), paymentController.createRefund);

module.exports = router;

