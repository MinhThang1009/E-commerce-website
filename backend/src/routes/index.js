const express = require('express');
const router = express.Router();

// Import các module route
const authRoutes = require('./auth');
const discountCodeRoutes = require('./discountCode');
const userRoutes = require('./user');
const categoryRoutes = require('./category');
const productRoutes = require('./product');
const cartRoutes = require('./cart');
const orderRoutes = require('./order');
const reviewRoutes = require('./review');
const wishlistRoutes = require('./wishlist');
const adminRoutes = require('./admin');
const uploadRoutes = require('./upload');
const paymentRoutes = require('./payment');
const chatbotRoutes = require('./chatbot');
const chatRoutes = require('./chat');
const warrantyPackageRoutes = require('./warrantyPackage');
const attributeRoutes = require('./attribute');
const imageRoutes = require('./image');
const newsRoutes = require('./news');
const contactRoutes = require('./contact');
const newsletterRoutes = require('./newsletter');
const brandRoutes = require('./brand');
const collectionRoutes = require('./collection');
const searchHistoryRoutes = require('./searchHistory');
const loyaltyRoutes = require('./loyalty');
const bannerRoutes = require('./banner');
const emailCampaignRoutes = require('./emailCampaign');
const locationRoutes = require('./location');

// Các route API
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
router.use('/newsletter', newsletterRoutes);
router.use('/brands', brandRoutes);
router.use('/collections', collectionRoutes);
router.use('/search-history', searchHistoryRoutes);
router.use('/loyalty', loyaltyRoutes);
router.use('/banners', bannerRoutes);
router.use('/email-campaigns', emailCampaignRoutes);
router.use('/location', locationRoutes);

// Route kiểm tra trạng thái hệ thống
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
