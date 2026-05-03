const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact');
const { validateRequest } = require('../middlewares/validateRequest');
const { newsletterSchema, feedbackSchema } = require('../validators/contact');

// Đăng ký nhận bản tin — validate email hợp lệ
router.post('/newsletter', validateRequest(newsletterSchema, 422), contactController.subscribeNewsletter);

// Gửi phản hồi — validate các trường bắt buộc (name, email, subject, content)
router.post('/feedback', validateRequest(feedbackSchema, 422), contactController.sendFeedback);

module.exports = router;
