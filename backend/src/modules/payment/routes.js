const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../../shared/http/middlewares/authenticate');
const { authorize } = require('../../shared/http/middlewares/authorize');
const { validateRequest } = require('../../shared/http/middlewares/validateRequest');
const { createUrlSchema, refundSchema } = require('./validators/paymentValidator');

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' },
});

module.exports = ({ paymentController }) => {
  const router = express.Router();

  // Public — webhooks (gateway signature verification trong service)
  router.get('/momo/return', paymentController.momoReturn);
  router.post('/momo/ipn', webhookLimiter, paymentController.momoIPN);
  router.get('/vnpay/return', paymentController.vnpayReturn);
  router.get('/vnpay/ipn', webhookLimiter, paymentController.vnpayIPN);

  // Authenticated routes
  router.post('/momo/create-url', authenticate, validateRequest(createUrlSchema), paymentController.createMomoUrl);
  router.post('/vnpay/create-url', authenticate, validateRequest(createUrlSchema), paymentController.createVNPayUrl);

  // Admin
  router.post('/refund', authenticate, authorize('admin'), validateRequest(refundSchema), paymentController.createRefund);

  return router;
};
