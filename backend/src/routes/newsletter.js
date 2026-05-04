const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact');
const { validateRequest } = require('../middlewares/validateRequest');
const { newsletterSchema } = require('../validators/contact');

// POST /api/newsletter/subscribe — đăng ký nhận bản tin
router.post('/subscribe', validateRequest(newsletterSchema, 422), contactController.subscribeNewsletter);

module.exports = router;
