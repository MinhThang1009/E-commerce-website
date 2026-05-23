/**
 * @file contentService.js
 * @layer Service
 * @module content
 * @description Business logic layer cho contact/feedback
 */
const { AppError } = require('@shared/errors');

class ContentService {
  constructor({ contentRepository, emailGateway, eventBus, logger, adminEmail }) {
    this.contentRepository = contentRepository;
    this.emailGateway = emailGateway;
    this.eventBus = eventBus;
    this.logger = logger;
    this.adminEmail = adminEmail;
  }

  async sendFeedback({ payload }) {
    const { name, email, phone, subject, content } = payload;
    if (!name || !email || !subject || !content) {
      throw new AppError('content.requiredFieldsMissing', 400);
    }

    const feedback = await this.contentRepository.createFeedback({
      name,
      email,
      phone,
      subject,
      content,
      status: 'pending',
    });

    if (this.adminEmail) {
      this.emailGateway
        .sendAdminFeedbackNotification(this.adminEmail, {
          name,
          email,
          subject,
          content,
        })
        .catch((err) => {
          this.logger.error('Lỗi gửi email thông báo phản hồi cho admin:', err.message);
        });
    }

    return feedback;
  }
}

module.exports = ContentService;
