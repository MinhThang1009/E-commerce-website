/**
 * @file __mocks__/email.js
 * @description Manual mock cho @services/email.
 *
 * Jest tự dùng khi test gọi `jest.mock('@services/email')` KHÔNG kèm factory.
 * Tất cả method async → `mockResolvedValue(undefined)` để code `await emailService.x()`
 * không vỡ (jest.fn() trần trả undefined, `.then()` sẽ lỗi). Mirror export thật.
 */
module.exports = {
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  sendResetPasswordEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderCancellationEmail: jest.fn().mockResolvedValue(undefined),
  sendAdminFeedbackNotification: jest.fn().mockResolvedValue(undefined),
};
