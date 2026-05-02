const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlist');
const { authenticate } = require('../middlewares/authenticate');

// Tất cả route yêu cầu xác thực
router.use(authenticate);

// Các route danh sách yêu thích
router.get('/', wishlistController.getWishlist);
router.post('/', wishlistController.addToWishlist);
router.get('/check/:productId', wishlistController.checkWishlist);
router.delete('/:productId', wishlistController.removeFromWishlist);
router.delete('/', wishlistController.clearWishlist);

module.exports = router;
