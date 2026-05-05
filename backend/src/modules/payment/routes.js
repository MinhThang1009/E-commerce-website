const express = require('express');
const { authenticate } = require('../../shared/http/middlewares/authenticate');
const { authorize } = require('../../shared/http/middlewares/authorize');

// Payment routes — basePath '/payments'. URL không đổi so với routes/payment.js cũ.
//
// Dùng authenticate per-route (KHÔNG router.use) để các route module này không
// handle (vd /sepay-webhook) có thể fall-through sang legacy routes/payment.js
// không bị 401. SePay webhook sẽ ở legacy đến Phase 5 cleanup.
module.exports = ({ paymentController }) => {
  const router = express.Router();

  // Public — webhooks (gateway signature verification trong service)
  router.post('/webhook', paymentController.handleWebhook);
  router.get('/momo/return', paymentController.momoReturn);
  router.post('/momo/ipn', paymentController.momoIPN);
  router.get('/vnpay/return', paymentController.vnpayReturn);
  router.get('/vnpay/ipn', paymentController.vnpayIPN);

  // Authenticated routes — middleware per-route để fall-through không bị block
  router.post('/create-payment-intent', authenticate, paymentController.createPaymentIntent);
  router.post('/confirm-payment', authenticate, paymentController.confirmPayment);
  router.post('/momo/create-url', authenticate, paymentController.createMomoUrl);
  router.post('/vnpay/create-url', authenticate, paymentController.createVNPayUrl);
  router.post('/create-customer', authenticate, paymentController.createCustomer);
  router.get('/payment-methods', authenticate, paymentController.getPaymentMethods);
  router.post('/create-setup-intent', authenticate, paymentController.createSetupIntent);

  // Admin
  router.post('/refund', authenticate, authorize('admin'), paymentController.createRefund);

  return router;
};
