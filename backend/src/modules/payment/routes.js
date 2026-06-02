/**
 * @file routes.js
 * @layer Route
 * @module payment
 * @description HTTP endpoints của payment
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('@middlewares/authenticate');
const { authorize } = require('@middlewares/authorize');
const { validateRequest } = require('@middlewares/validate-request');
const { createUrlSchema, refundSchema } = require('@modules/payment/validators/payment-validator');

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' },
});

module.exports = ({ paymentController }) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/payments/momo/return:
   *   get:
   *     summary: Trang trả về sau khi thanh toán MoMo
   *     tags: [Payment]
   * /api/payments/momo/ipn:
   *   post:
   *     summary: IPN callback từ MoMo
   *     tags: [Payment]
   * /api/payments/vnpay/return:
   *   get:
   *     summary: Trang trả về sau khi thanh toán VNPay
   *     tags: [Payment]
   * /api/payments/vnpay/ipn:
   *   get:
   *     summary: IPN callback từ VNPay
   *     tags: [Payment]
   * /api/payments/momo/create-url:
   *   post:
   *     summary: Tạo URL thanh toán MoMo
   *     tags: [Payment]
   *     security:
   *       - bearerAuth: []
   * /api/payments/vnpay/create-url:
   *   post:
   *     summary: Tạo URL thanh toán VNPay
   *     tags: [Payment]
   *     security:
   *       - bearerAuth: []
   * /api/payments/refund:
   *   post:
   *     summary: Tạo yêu cầu hoàn tiền (admin)
   *     tags: [Payment]
   *     security:
   *       - bearerAuth: []
   */
  // Public — webhooks (gateway signature verification trong service)
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

  // Hoàn tiền — nghiệp vụ bán hàng/đơn hàng → staff (nhân viên bán hàng)
  router.post(
    '/refund',
    authenticate,
    authorize('staff'),
    validateRequest(refundSchema),
    paymentController.createRefund,
  );

  return router;
};
