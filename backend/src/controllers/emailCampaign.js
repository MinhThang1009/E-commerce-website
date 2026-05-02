const { EmailCampaign, NewsletterSubscriber } = require('../models');
const { catchAsync } = require('../utils/catchAsync');
const { AppError } = require('../middlewares/errorHandler');
const emailService = require('../services/email');
const logger = require('../utils/logger');

/**
 * Lấy danh sách tất cả chiến dịch email
 */
const getAllCampaigns = catchAsync(async (req, res) => {
  const campaigns = await EmailCampaign.findAll({
    order: [['createdAt', 'DESC']],
  });

  res.status(200).json({
    status: 'success',
    results: campaigns.length,
    data: campaigns,
  });
});

/**
 * Tạo chiến dịch email mới
 */
const createCampaign = catchAsync(async (req, res) => {
  const campaign = await EmailCampaign.create(req.body);

  res.status(201).json({
    status: 'success',
    data: campaign,
  });
});

/**
 * Gửi chiến dịch email đến tất cả người đăng ký và người dùng
 */
const sendCampaign = catchAsync(async (req, res) => {
  const { User } = require('../models');
  const campaign = await EmailCampaign.findByPk(req.params.id);

  if (!campaign) {
    throw new AppError('Không tìm thấy chiến dịch email', 404);
  }

  if (campaign.status === 'sent') {
    throw new AppError('Chiến dịch email này đã được gửi trước đó', 400);
  }

  logger.info(`[EmailCampaign] Đang xử lý chiến dịch #${campaign.id}: ${campaign.subject}`);

  // Lấy dữ liệu từ cả hai nguồn
  const [subscribers, users] = await Promise.all([
    NewsletterSubscriber.findAll({ where: { status: 'active' }, attributes: ['email'] }),
    User.findAll({ attributes: ['email'] })
  ]);

  // Gộp và loại bỏ email trùng lặp
  const subscriberEmails = subscribers.map(s => s.email.toLowerCase().trim());
  const userEmails = users.map(u => u.email.toLowerCase().trim());
  const uniqueEmails = [...new Set([...subscriberEmails, ...userEmails])];

  logger.info(`[EmailCampaign] Đã thu thập địa chỉ email. Tổng số người nhận duy nhất: ${uniqueEmails.length}`);

  if (uniqueEmails.length > 0) {
    // Gửi email hàng loạt - có thể ghi log ra console backend
    try {
      await emailService.sendBulkCampaignEmail(
        uniqueEmails,
        campaign.subject,
        campaign.content
      );
    } catch (err) {
      logger.error(`[EmailCampaign] Lỗi khi gửi email hàng loạt: ${err.message}`);
      throw new AppError('Gửi email thất bại: ' + err.message, 500);
    }
  } else {
    logger.info(`[EmailCampaign] Không tìm thấy người nhận. Chiến dịch được đánh dấu đã gửi nhưng không có email nào được gửi đi.`);
  }

  // Cập nhật trạng thái chiến dịch
  campaign.status = 'sent';
  campaign.sentAt = new Date();
  await campaign.save();

  res.status(200).json({
    status: 'success',
    message: `Đã gửi thành công chiến dịch tới ${uniqueEmails.length} người nhận`,
    data: campaign,
  });
});

/**
 * Xóa chiến dịch email
 */
const deleteCampaign = catchAsync(async (req, res) => {
  const campaign = await EmailCampaign.findByPk(req.params.id);

  if (!campaign) {
    throw new AppError('Không tìm thấy chiến dịch email', 404);
  }

  await campaign.destroy();

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

module.exports = {
  getAllCampaigns,
  createCampaign,
  sendCampaign,
  deleteCampaign,
};
