const express = require('express');
const bannerController = require('../controllers/banner');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { validateRequest } = require('../middlewares/validateRequest');
const { createBannerSchema, updateBannerSchema } = require('../validators/banner');

const router = express.Router();

// Route công khai
router.get('/', bannerController.getAllBanners);
router.get('/:id', bannerController.getBannerById);

// Route admin (yêu cầu xác thực và phân quyền)
router.use(authenticate);
router.use(authorize('admin'));

router.post('/', validateRequest(createBannerSchema, 422), bannerController.createBanner);
router.patch('/:id', validateRequest(updateBannerSchema, 422), bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);

module.exports = router;
