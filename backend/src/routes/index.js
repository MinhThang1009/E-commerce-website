const express = require('express');
const sequelize = require('../config/sequelize');
const pkg = require('../../package.json');
const router = express.Router();

// Phase 42.24 cleanup — Tất cả legacy routes đã migrate sang modules/* (Sprint 1-19)
// hoặc đã xóa orphan (Phase 5 batch 1+2). Các route còn lại là module CHƯA migrate
// (admin/discount-codes/payments-legacy/chatbot/warranty/attribute/image/search-history/
// locations) — sẽ migrate sang modules/* khi cần.
const discountCodeRoutes = require('./discountCode');
const adminRoutes = require('./admin');
const paymentRoutes = require('./payment');
const chatbotRoutes = require('./chatbot');
const warrantyPackageRoutes = require('./warrantyPackage');
const attributeRoutes = require('./attribute');
const imageRoutes = require('./image');
const searchHistoryRoutes = require('./searchHistory');
const locationRoutes = require('./location');

// Các route API
router.use('/discount-codes', discountCodeRoutes);
router.use('/admin', adminRoutes);
router.use('/payments', paymentRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/warranty-packages', warrantyPackageRoutes);
router.use('/attributes', attributeRoutes);
router.use('/images', imageRoutes);
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
    const { getRedisClient } = require('../config/redis');
    const redisClient = await getRedisClient();
    if (redisClient && typeof redisClient.ping === 'function') {
      const pong = await redisClient.ping();
      redisStatus = pong === 'PONG' ? 'ok' : 'error';
    } else {
      redisStatus = 'memory_fallback';
    }
  } catch {
    redisStatus = 'error';
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
