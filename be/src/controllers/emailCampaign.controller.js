const { EmailCampaign, NewsletterSubscriber } = require('../models');
const { catchAsync } = require('../utils/catchAsync');
const { AppError } = require('../middlewares/errorHandler');
const emailService = require('../services/email/emailService');
const logger = require('../utils/logger');

/**
 * Get all campaigns
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
 * Create campaign
 */
const createCampaign = catchAsync(async (req, res) => {
  const campaign = await EmailCampaign.create(req.body);

  res.status(201).json({
    status: 'success',
    data: campaign,
  });
});

/**
 * Send campaign to all subscribers and users
 */
const sendCampaign = catchAsync(async (req, res) => {
  const { User } = require('../models');
  const campaign = await EmailCampaign.findByPk(req.params.id);

  if (!campaign) {
    throw new AppError('Campaign not found', 404);
  }

  if (campaign.status === 'sent') {
    throw new AppError('Campaign has already been sent', 400);
  }

  logger.info(`[EmailCampaign] Processing campaign #${campaign.id}: ${campaign.subject}`);

  // Fetch from both sources
  const [subscribers, users] = await Promise.all([
    NewsletterSubscriber.findAll({ where: { status: 'active' }, attributes: ['email'] }),
    User.findAll({ attributes: ['email'] })
  ]);

  // Combine and deduplicate
  const subscriberEmails = subscribers.map(s => s.email.toLowerCase().trim());
  const userEmails = users.map(u => u.email.toLowerCase().trim());
  const uniqueEmails = [...new Set([...subscriberEmails, ...userEmails])];

  logger.info(`[EmailCampaign] Target emails collected. Total unique recipients: ${uniqueEmails.length}`);

  if (uniqueEmails.length > 0) {
    // Send bulk emails - this might log to backend console
    try {
      await emailService.sendBulkCampaignEmail(
        uniqueEmails,
        campaign.subject,
        campaign.content
      );
    } catch (err) {
      logger.error(`[EmailCampaign] Error in bulk sending: ${err.message}`);
      throw new AppError('Gửi email thất bại: ' + err.message, 500);
    }
  } else {
    logger.info(`[EmailCampaign] No recipients found. Campaign marked as sent but no emails were dispatched.`);
  }

  // Update campaign status
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
 * Delete campaign
 */
const deleteCampaign = catchAsync(async (req, res) => {
  const campaign = await EmailCampaign.findByPk(req.params.id);

  if (!campaign) {
    throw new AppError('Campaign not found', 404);
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
