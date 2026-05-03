const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact');
const { validateRequest } = require('../middlewares/validateRequest');
const { newsletterSchema, feedbackSchema } = require('../validators/contact');

// Đăng ký nhận bản tin — validate email hợp lệ
router.post('/newsletter', validateRequest(newsletterSchema), contactController.subscribeNewsletter);

// Gửi phản hồi — validate các trường bắt buộc (name, email, subject, content)
router.post('/feedback', validateRequest(feedbackSchema), contactController.sendFeedback);

module.exports = router;
