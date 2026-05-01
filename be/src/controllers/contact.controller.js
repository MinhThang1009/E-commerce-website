const { NewsletterSubscriber, Feedback } = require('../models');
const { catchAsync } = require('../utils/catchAsync');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Subscribe to newsletter
 */
const subscribeNewsletter = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  // Find or create subscriber
  const [subscriber, created] = await NewsletterSubscriber.findOrCreate({
    where: { email },
    defaults: { status: 'active' },
  });

  if (!created && subscriber.status === 'active') {
    return res.status(200).json({
      status: 'success',
      message: 'You are already subscribed to our newsletter.',
    });
  }

  if (subscriber.status === 'unsubscribed') {
    subscriber.status = 'active';
    await subscriber.save();
  }

  // Send welcome email (non-blocking)
  const emailService = require('../services/email/emailService');
  emailService.sendNewsletterWelcomeEmail(email).catch(err => {
    console.error('Error sending welcome email:', err);
  });

  res.status(200).json({
    status: 'success',
    message: 'Thank you for subscribing to our newsletter!',
  });
});

/**
 * Submit feedback
 */
const sendFeedback = catchAsync(async (req, res) => {
  const { name, email, phone, subject, content } = req.body;

  if (!name || !email || !subject || !content) {
    throw new AppError('Please provide all required fields (name, email, subject, content)', 400);
  }

  const feedback = await Feedback.create({
    name,
    email,
    phone,
    subject,
    content,
    status: 'pending',
  });

  res.status(201).json({
    status: 'success',
    message: 'Thank you for your feedback. We will review it soon!',
    data: feedback,
  });
});

module.exports = {
  subscribeNewsletter,
  sendFeedback,
};
