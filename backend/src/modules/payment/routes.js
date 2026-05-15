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
  router.get('/momo/return', paymentController.momoReturn);
  router.post('/momo/ipn', paymentController.momoIPN);
  router.get('/vnpay/return', paymentController.vnpayReturn);
  router.get('/vnpay/ipn', paymentController.vnpayIPN);

  // Authenticated routes
  router.post('/momo/create-url', authenticate, paymentController.createMomoUrl);
  router.post('/vnpay/create-url', authenticate, paymentController.createVNPayUrl);

  // Admin
  router.post('/refund', authenticate, authorize('admin'), paymentController.createRefund);

  return router;
};
