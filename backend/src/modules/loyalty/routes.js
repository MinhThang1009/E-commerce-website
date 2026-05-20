/**
 * @file routes.js
 * @layer Route
 * @module loyalty
 * @description HTTP endpoints của loyalty
 */
const express = require('express');
const { authenticate } = require('@middlewares/authenticate');
const { validateRequest } = require('@middlewares/validate-request');
const { redeemPointsSchema } = require('@modules/loyalty/validators/loyalty-validator');

module.exports = ({ loyaltyController }) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/loyalty:
   *   get:
   *     summary: Lấy thông tin điểm tích lũy của người dùng
   *     tags: [Loyalty]
   *     security:
   *       - bearerAuth: []
   * /api/loyalty/redeem:
   *   post:
   *     summary: Đổi điểm tích lũy lấy ưu đãi
   *     tags: [Loyalty]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/', authenticate, loyaltyController.getLoyaltyInfo);
  router.post(
    '/redeem',
    authenticate,
    validateRequest(redeemPointsSchema, 422),
    loyaltyController.redeemPoints,
  );

  return router;
};
