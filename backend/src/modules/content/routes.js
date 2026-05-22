/**
 * @file routes.js
 * @layer Route
 * @module content
 * @description HTTP endpoints của content — chỉ còn contact/feedback
 */
const express = require('express');
const { validateRequest } = require('@middlewares/validate-request');
const { feedbackSchema } = require('@modules/content/validators/content-validator');

module.exports = ({ contentController }) => {
  /**
   * @swagger
   * /api/contact/feedback:
   *   post:
   *     summary: Gửi phản hồi/liên hệ
   *     tags: [Content]
   */
  const contact = express.Router();
  contact.post('/feedback', validateRequest(feedbackSchema, 422), contentController.sendFeedback);

  return { contact };
};
