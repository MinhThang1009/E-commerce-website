const express = require('express');
const router = express.Router();
const discountCodeController = require('../controllers/discountCode');
const { validate } = require('../middlewares/validateRequest');
const { applyDiscountCodeValidation } = require('../validators/discountCode');

/**
 * Customer: Áp dụng mã giảm giá
 */
router.post(
  '/apply',
  validate(applyDiscountCodeValidation),
  discountCodeController.applyDiscountCode
);

module.exports = router;
