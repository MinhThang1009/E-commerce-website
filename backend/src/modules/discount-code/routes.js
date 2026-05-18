/**
 * @file routes.js
 * @layer Route
 * @module discountCode
 * @description HTTP endpoints của discountCode
 */
const express = require('express');
const router = express.Router();
const discountCodeController = require('@modules/discount-code/controllers/discount-code-controller');
const { validate } = require('@middlewares/validate-request');
const { applyDiscountCodeValidation } = require('@modules/discount-code/validators/discount-code-validator');

// Customer: Áp dụng mã giảm giá
router.post(
  '/apply',
  validate(applyDiscountCodeValidation),
  discountCodeController.applyDiscountCode,
);

module.exports = router;
