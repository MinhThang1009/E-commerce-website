const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brand');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { cacheMiddleware, httpCacheHeaders } = require('../middlewares/cache');

// Route công khai — cache 30 phút vì brands ít thay đổi
router.get('/',
  httpCacheHeaders(1800),
  cacheMiddleware(1800, () => 'cache:brands:all'),
  brandController.getAllBrands
);
router.get('/slug/:slug',
  httpCacheHeaders(1800),
  cacheMiddleware(1800, (req) => `cache:brands:slug:${req.params.slug}`),
  brandController.getBrandBySlug
);
router.get('/slug/:slug/products',
  httpCacheHeaders(180),
  brandController.getProductsByBrand
);

// Route của admin
router.post('/', authenticate, authorize('admin'), brandController.createBrand);
router.put('/:id', authenticate, authorize('admin'), brandController.updateBrand);
router.delete('/:id', authenticate, authorize('admin'), brandController.deleteBrand);

module.exports = router;
