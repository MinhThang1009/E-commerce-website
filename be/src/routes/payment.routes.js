const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

// Webhook route (no authentication needed)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

// SePay webhook route (no authentication needed)
router.post(
  '/sepay-webhook',
  express.json(), // SePay sends JSON data
  paymentController.handleSePayWebhook
);

// MoMo return/IPN routes (no authentication)
router.get('/momo/return', paymentController.momoReturn);
router.post('/momo/ipn', paymentController.momoIPN);

// VNPay return/IPN routes (no authentication)
router.get('/vnpay/return', paymentController.vnpayReturn);
router.get('/vnpay/ipn', paymentController.vnpayIPN);

// Authenticated routes
router.use(authenticate);

// Create payment intent
router.post('/create-payment-intent', paymentController.createPaymentIntent);

// Confirm payment
router.post('/confirm-payment', paymentController.confirmPayment);

// MoMo create url
router.post('/momo/create-url', paymentController.createMomoUrl);

// VNPay create url
router.post('/vnpay/create-url', paymentController.createVNPayUrl);

// Customer management
router.post('/create-customer', paymentController.createCustomer);
router.get('/payment-methods', paymentController.getPaymentMethods);
router.post('/create-setup-intent', paymentController.createSetupIntent);

// Admin routes
router.post('/refund', authorize('admin'), paymentController.createRefund);

module.exports = router;

