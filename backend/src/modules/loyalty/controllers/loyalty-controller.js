/**
 * @file loyaltyController.js
 * @layer Controller
 * @module loyalty
 * @description Xử lý HTTP request/response cho loyalty
 */
class LoyaltyController {
  constructor({ loyaltyService }) {
    this.loyaltyService = loyaltyService;
  }

  getLoyaltyInfo = async (req, res, next) => {
    try {
      const data = await this.loyaltyService.getLoyaltyInfo({
        userId: req.user.id,
        ...req.query,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  redeemPoints = async (req, res, next) => {
    try {
      const result = await this.loyaltyService.redeemPoints({
        userId: req.user.id,
        points: req.body.points,
      });
      res.status(200).json({ status: 'success', message: result.message, data: result.data });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = LoyaltyController;
