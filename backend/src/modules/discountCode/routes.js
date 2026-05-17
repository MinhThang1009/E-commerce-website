/**
 * @file routes.js
 * @layer Route
 * @module discountCode
 * @description HTTP endpoints của discountCode
 */
const express = require('express');
const router = express.Router();
const discountCodeController = require('./controllers/discountCodeController');
const { validate } = require('../../middlewares/validateRequest');
const { applyDiscountCodeValidation } = require('./validators/discountCodeValidator');

// Customer: Áp dụng mã giảm giá
router.post(
  '/apply',
  validate(applyDiscountCodeValidation),
  discountCodeController.applyDiscountCode,
);

module.exports = router;
