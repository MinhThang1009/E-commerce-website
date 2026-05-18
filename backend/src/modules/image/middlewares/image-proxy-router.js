const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

// Proxy ảnh CDN để bypass hotlink protection trên localhost
// URL: /api/img?url=https://cdnv2.tgdd.vn/...
router.get('/', (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string') return res.status(400).send('Missing url param');

  // Chỉ cho phép CDN domains tin cậy
  const allowed = ['cdnv2.tgdd.vn', 'cdn.tgdd.vn', 'cdn2.cellphones.com.vn'];
  try {
    const parsed = new URL(url);
    if (!allowed.includes(parsed.hostname)) return res.status(403).send('Domain not allowed');
  } catch {
    return res.status(400).send('Invalid URL');
  }

  const mod = url.startsWith('https') ? https : http;
  const options = {
    timeout: 10000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://www.thegioididong.com/',
    },
  };
  const proxyReq = mod.get(url, options, (proxyRes) => {
    if (res.headersSent) return;
    res.set('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => {
    if (!res.headersSent) res.status(502).send('Upstream error');
  });
  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) res.status(504).send('Timeout');
  });
});

module.exports = router;
