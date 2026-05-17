const express = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { validateRequest } = require('../../middlewares/validateRequest');
const { redeemPointsSchema } = require('./validators/loyaltyValidator');

module.exports = ({ loyaltyController }) => {
  const router = express.Router();

  router.get('/', authenticate, loyaltyController.getLoyaltyInfo);
  router.post(
    '/redeem',
    authenticate,
    validateRequest(redeemPointsSchema, 422),
    loyaltyController.redeemPoints,
  );

  return router;
};
