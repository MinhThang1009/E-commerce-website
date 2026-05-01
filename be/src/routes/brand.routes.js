const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brand.controller');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

// Public routes
router.get('/', brandController.getAllBrands);
router.get('/slug/:slug', brandController.getBrandBySlug);
router.get('/slug/:slug/products', brandController.getProductsByBrand);

// Admin routes
router.post('/', authenticate, authorize('admin'), brandController.createBrand);
router.put('/:id', authenticate, authorize('admin'), brandController.updateBrand);
router.delete('/:id', authenticate, authorize('admin'), brandController.deleteBrand);

module.exports = router;
