const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const discountCodeRoutes = require('./discountCode.routes');
const userRoutes = require('./user.routes');
const categoryRoutes = require('./category.routes');
const productRoutes = require('./product.routes');
const cartRoutes = require('./cart.routes');
const orderRoutes = require('./order.routes');
const reviewRoutes = require('./review.routes');
const wishlistRoutes = require('./wishlist.routes');
const adminRoutes = require('./admin.routes');
const uploadRoutes = require('./upload.routes');
const paymentRoutes = require('./payment.routes');
const chatbotRoutes = require('./chatbot.routes');
const chatRoutes = require('./chat.routes');
const warrantyPackageRoutes = require('./warrantyPackages');
const attributeRoutes = require('./attributeRoutes');
const imageRoutes = require('./image.routes');
const newsRoutes = require('./news.routes');
const contactRoutes = require('./contact.routes');
const brandRoutes = require('./brand.routes');
const collectionRoutes = require('./collection.routes');
const searchHistoryRoutes = require('./searchHistory.routes');
const loyaltyRoutes = require('./loyalty.routes');
const bannerRoutes = require('./banner.routes');
const emailCampaignRoutes = require('./emailCampaign.routes');
const locationRoutes = require('./location.routes');

// API routes
router.use('/auth', authRoutes);
router.use('/discount-codes', discountCodeRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/upload', uploadRoutes);
router.use('/admin', adminRoutes);
router.use('/payment', paymentRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/chat', chatRoutes);
router.use('/warranty-packages', warrantyPackageRoutes);
router.use('/attributes', attributeRoutes);
router.use('/images', imageRoutes);
router.use('/news', newsRoutes);
router.use('/contact', contactRoutes);
router.use('/brands', brandRoutes);
router.use('/collections', collectionRoutes);
router.use('/search-history', searchHistoryRoutes);
router.use('/loyalty', loyaltyRoutes);
router.use('/banners', bannerRoutes);
router.use('/email-campaigns', emailCampaignRoutes);
router.use('/location', locationRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
