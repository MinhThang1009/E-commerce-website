/**
 * @file routes.js
 * @layer Route
 * @module payment
 * @description HTTP endpoints của payment
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validateRequest } = require('../../middlewares/validateRequest');
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
  router.post('/sepay-webhook', express.json(), paymentController.handleSePayWebhook);
  router.get('/momo/return', paymentController.momoReturn);
  router.post('/momo/ipn', webhookLimiter, paymentController.momoIPN);
  router.get('/vnpay/return', paymentController.vnpayReturn);
  router.get('/vnpay/ipn', webhookLimiter, paymentController.vnpayIPN);

  // Authenticated routes
  router.post(
    '/momo/create-url',
    authenticate,
    validateRequest(createUrlSchema),
    paymentController.createMomoUrl,
  );
  router.post(
    '/vnpay/create-url',
    authenticate,
    validateRequest(createUrlSchema),
    paymentController.createVNPayUrl,
  );

  // Admin
  router.post(
    '/refund',
    authenticate,
    authorize('admin'),
    validateRequest(refundSchema),
    paymentController.createRefund,
  );

  return router;
};
