const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brand');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

// Route công khai
router.get('/', brandController.getAllBrands);
router.get('/slug/:slug', brandController.getBrandBySlug);
router.get('/slug/:slug/products', brandController.getProductsByBrand);

// Route của admin
router.post('/', authenticate, authorize('admin'), brandController.createBrand);
router.put('/:id', authenticate, authorize('admin'), brandController.updateBrand);
router.delete('/:id', authenticate, authorize('admin'), brandController.deleteBrand);

module.exports = router;
