const express = require('express');
const emailCampaignController = require('../controllers/emailCampaign.controller');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

const router = express.Router();

// All email campaign routes are Admin only
router.use(authenticate);
router.use(authorize('admin'));

router.get('/', emailCampaignController.getAllCampaigns);
router.post('/', emailCampaignController.createCampaign);
router.post('/:id/send', emailCampaignController.sendCampaign);
router.delete('/:id', emailCampaignController.deleteCampaign);

module.exports = router;
