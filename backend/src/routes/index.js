const express = require('express');
const sequelize = require('@config/sequelize');
const pkg = require('../../package.json');
const router = express.Router();

// routes/index.js chỉ còn health endpoint.
// Tất cả feature routes đã migrate sang modules/*/ trong app.js.

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
  const overallOk = dbStatus === 'ok';
  res.status(overallOk ? 200 : 503).json({
    status: overallOk ? 'success' : 'error',
    message: overallOk ? 'API is running' : 'API up but dependency degraded',
    db: dbStatus,
    uptime: Math.round(process.uptime()),
    version: pkg.version,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
