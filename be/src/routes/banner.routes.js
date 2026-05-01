const express = require('express');
const bannerController = require('../controllers/banner.controller');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

const router = express.Router();

// Public routes
router.get('/', bannerController.getAllBanners);
router.get('/:id', bannerController.getBannerById);

// Protected Admin routes
router.use(authenticate);
router.use(authorize('admin'));

router.post('/', bannerController.createBanner);
router.patch('/:id', bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);

module.exports = router;
