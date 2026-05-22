/**
 * @file routes.js
 * @layer Route
 * @module discountCode
 * @description HTTP endpoints của discountCode
 */
const express = require('express');
const router = express.Router();
const discountCodeController = require('@modules/discount-code/controllers/discount-code-controller');
const { validateRequest } = require('@middlewares/validate-request');
const {
  applyDiscountCodeSchema: applyDiscountCodeValidation,
} = require('@modules/discount-code/validators/discount-code-validator');

/**
 * @swagger
 * /api/discount-codes:
 *   get:
 *     summary: Lấy danh sách mã giảm giá còn hiệu lực
 *     tags: [Discount Codes]
 */
router.get('/', discountCodeController.getAvailableDiscountCodes);

/**
 * @swagger
 * /api/discount-codes/apply:
 *   post:
 *     summary: Áp dụng mã giảm giá
 *     tags: [Discount Codes]
 */
router.post(
  '/apply',
  validateRequest(applyDiscountCodeValidation),
  discountCodeController.applyDiscountCode,
);

module.exports = router;
