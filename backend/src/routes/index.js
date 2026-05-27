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

router.get('/sitemap.xml', async (req, res) => {
  try {
    const { Product, Category } = require('@models');
    const siteUrl = process.env.FRONTEND_URL || 'https://techstore.vn';

    const [products, categories] = await Promise.all([
      Product.findAll({ where: { status: 'active' }, attributes: ['id', 'slug', 'updatedAt'] }),
      Category.findAll({ where: { isActive: true }, attributes: ['slug', 'updatedAt'] }),
    ]);

    const urls = [
      `<url><loc>${siteUrl}/</loc><priority>1.0</priority></url>`,
      `<url><loc>${siteUrl}/shop</loc><priority>0.9</priority></url>`,
      `<url><loc>${siteUrl}/categories</loc><priority>0.8</priority></url>`,
      `<url><loc>${siteUrl}/brands</loc><priority>0.7</priority></url>`,
      ...categories.map(
        (c) =>
          `<url><loc>${siteUrl}/categories/${c.slug}</loc><lastmod>${c.updatedAt.toISOString()}</lastmod><priority>0.7</priority></url>`,
      ),
      ...products.map(
        (p) =>
          `<url><loc>${siteUrl}/products/${p.id}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod><priority>0.6</priority></url>`,
      ),
    ];

    res.set('Content-Type', 'application/xml');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`,
    );
  } catch (_err) {
    res.status(500).send('Sitemap generation failed');
  }
});

module.exports = router;
