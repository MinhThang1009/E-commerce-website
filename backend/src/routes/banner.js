const express = require('express');
const bannerController = require('../controllers/banner');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

const router = express.Router();

// Route công khai
router.get('/', bannerController.getAllBanners);
router.get('/:id', bannerController.getBannerById);

// Route admin (yêu cầu xác thực và phân quyền)
router.use(authenticate);
router.use(authorize('admin'));

router.post('/', bannerController.createBanner);
router.patch('/:id', bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);

module.exports = router;
