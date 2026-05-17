const express = require('express');
const { authenticate } = require('../../middlewares/authenticate');

// Wishlist routes — basePath '/wishlists'. Old route mount tại /api/wishlists.
module.exports = ({ wishlistController }) => {
  const router = express.Router();
  router.use(authenticate);

  router.get('/', wishlistController.getWishlist);
  router.post('/', wishlistController.addToWishlist);
  router.get('/check/:productId', wishlistController.checkWishlist);
  router.delete('/:productId', wishlistController.removeFromWishlist);
  router.delete('/', wishlistController.clearWishlist);

  return router;
};
