const express = require('express');
const sequelize = require('../config/sequelize');
const pkg = require('../../package.json');
const router = express.Router();

// Phase 42.2+ — auth + users + cart mount trực tiếp trong app.js qua modules/*
// (Modular Monolith). routes/auth.js + routes/user.js + routes/cart.js (legacy)
// còn lại chỉ phục vụ unit/integration test nội bộ, xóa ở Phase 5 cleanup.
const discountCodeRoutes = require('./discountCode');
const categoryRoutes = require('./category');
const productRoutes = require('./product');
const orderRoutes = require('./order');
const adminRoutes = require('./admin');
const paymentRoutes = require('./payment');
const chatbotRoutes = require('./chatbot');
const chatRoutes = require('./chat');
const warrantyPackageRoutes = require('./warrantyPackage');
const attributeRoutes = require('./attribute');
const imageRoutes = require('./image');
const brandRoutes = require('./brand');
const collectionRoutes = require('./collection');
const searchHistoryRoutes = require('./searchHistory');
const locationRoutes = require('./location');

// Các route API
router.use('/discount-codes', discountCodeRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);
router.use('/payments', paymentRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/chat', chatRoutes);
router.use('/warranty-packages', warrantyPackageRoutes);
router.use('/attributes', attributeRoutes);
router.use('/images', imageRoutes);
router.use('/brands', brandRoutes);
router.use('/collections', collectionRoutes);
router.use('/search-histories', searchHistoryRoutes);
router.use('/locations', locationRoutes);

// Route kiểm tra trạng thái hệ thống — Phase 45.2.4 enhanced
// Trả về status DB + uptime + version để deploy script + manual smoke phân biệt
// app down vs app up nhưng DB lỗi.
router.get('/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    await sequelize.authenticate();
    dbStatus = 'ok';
  } catch (err) {
    dbStatus = 'error';
  }
  // Redis status — optional. Skip nếu không có redis client global.
  // (Phase 1 dùng Redis qua ioredis; check nếu RedisClient có method ping.)
  let redisStatus = 'not_configured';
  try {
    const redis = require('../config/redis');
    if (redis && typeof redis.ping === 'function') {
      const pong = await redis.ping();
      redisStatus = pong === 'PONG' ? 'ok' : 'error';
    }
  } catch {
    redisStatus = 'not_configured';
  }
  const overallOk = dbStatus === 'ok';
  res.status(overallOk ? 200 : 503).json({
    status: overallOk ? 'success' : 'error',
    message: overallOk ? 'API is running' : 'API up but dependency degraded',
    db: dbStatus,
    redis: redisStatus,
    uptime: Math.round(process.uptime()),
    version: pkg.version,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
