const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact');

// Đăng ký nhận bản tin
router.post('/newsletter', contactController.subscribeNewsletter);

// Gửi phản hồi
router.post('/feedback', contactController.sendFeedback);

module.exports = router;
