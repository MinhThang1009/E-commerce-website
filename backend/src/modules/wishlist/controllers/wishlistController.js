class WishlistController {
  constructor({ wishlistService }) {
    this.wishlistService = wishlistService;
  }

  getWishlist = async (req, res, next) => {
    try {
      const { products } = await this.wishlistService.getWishlist({ userId: req.user.id });
      res.status(200).json({ status: 'success', data: products });
    } catch (err) { next(err); }
  };

  addToWishlist = async (req, res, next) => {
    try {
      const result = await this.wishlistService.addToWishlist({
        userId: req.user.id,
        productId: req.body.productId,
      });
      const status = result.alreadyExists ? 200 : 201;
      res.status(status).json({ status: 'success', message: result.message });
    } catch (err) { next(err); }
  };

  removeFromWishlist = async (req, res, next) => {
    try {
      const result = await this.wishlistService.removeFromWishlist({
        userId: req.user.id,
        productId: req.params.productId,
      });
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) { next(err); }
  };

  checkWishlist = async (req, res, next) => {
    try {
      const result = await this.wishlistService.checkWishlist({
        userId: req.user.id,
        productId: req.params.productId,
      });
      res.status(200).json({ status: 'success', data: { inWishlist: result.inWishlist } });
    } catch (err) { next(err); }
  };

  clearWishlist = async (req, res, next) => {
    try {
      const result = await this.wishlistService.clearWishlist({ userId: req.user.id });
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) { next(err); }
  };
}

module.exports = WishlistController;
