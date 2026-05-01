const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');

// Newsletter subscription
router.post('/newsletter', contactController.subscribeNewsletter);

// Feedback submission
router.post('/feedback', contactController.sendFeedback);

module.exports = router;
