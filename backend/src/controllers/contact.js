const { NewsletterSubscriber, Feedback } = require('../models');
const logger = require('../utils/logger');
const { catchAsync } = require('../utils/catchAsync');
const { AppError } = require('../middlewares/errorHandler');
const emailService = require('../services/email');

/**
 * Đăng ký nhận bản tin
 */
const subscribeNewsletter = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('Email không được để trống', 400);
  }

  // Tìm hoặc tạo mới người đăng ký
  const [subscriber, created] = await NewsletterSubscriber.findOrCreate({
    where: { email },
    defaults: { status: 'active' },
  });

  // Đã đăng ký và đang active — không tạo trùng
  if (!created && subscriber.status === 'active') {
    return res.status(200).json({
      status: 'success',
      message: 'Bạn đã đăng ký nhận bản tin trước đó.',
    });
  }

  // Tái kích hoạt người dùng đã hủy đăng ký trước đây
  if (!created && subscriber.status === 'unsubscribed') {
    subscriber.status = 'active';
    await subscriber.save();
  }

  // Gửi email chào mừng (fire-and-forget: không cần đợi kết quả)
  emailService.sendNewsletterWelcomeEmail(email).catch(err => {
    logger.error('Lỗi gửi email chào mừng:', err.message);
  });

  // 201 cho người đăng ký mới; 200 cho tái kích hoạt (created = false)
  const statusCode = created ? 201 : 200;
  res.status(statusCode).json({
    status: 'success',
    message: 'Cảm ơn bạn đã đăng ký nhận bản tin!',
  });
});

/**
 * Gửi phản hồi từ người dùng
 */
const sendFeedback = catchAsync(async (req, res) => {
  const { name, email, phone, subject, content } = req.body;

  if (!name || !email || !subject || !content) {
    throw new AppError('Vui lòng cung cấp đầy đủ các trường bắt buộc (name, email, subject, content)', 400);
  }

  const feedback = await Feedback.create({
    name,
    email,
    phone,
    subject,
    content,
    status: 'pending',
  });

  // Gửi email thông báo cho admin về phản hồi mới (fire-and-forget: không cần đợi kết quả)
  if (process.env.ADMIN_EMAIL) {
    emailService.sendAdminFeedbackNotification(process.env.ADMIN_EMAIL, { name, email, subject, content }).catch(err => {
      logger.error('Lỗi gửi email thông báo phản hồi cho admin:', err.message);
    });
  }

  res.status(201).json({
    status: 'success',
    message: 'Cảm ơn bạn đã gửi phản hồi. Chúng tôi sẽ xem xét sớm!',
    data: feedback,
  });
});

module.exports = {
  subscribeNewsletter,
  sendFeedback,
};
