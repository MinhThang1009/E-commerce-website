const cron = require('node-cron');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs').promises;
const logger = require('@utils/logger');

// Lazy require models để tránh circular dependency khi app.js import file này
let models = null;
function getModels() {
  if (!models) models = require('@models');
  return models;
}

// Dọn file tạm trong uploads/temp/ — file cũ hơn 24 giờ bị xóa
const cleanupTempFiles = async () => {
  const tempDir = path.join(__dirname, '../../uploads/temp');
  const maxAge = 24 * 60 * 60 * 1000;
  try {
    const files = await fs.readdir(tempDir);
    await Promise.allSettled(
      files.map(async (file) => {
        const filePath = path.join(tempDir, file);
        try {
          const stat = await fs.stat(filePath);
          if (Date.now() - stat.mtimeMs > maxAge) {
            await fs.unlink(filePath);
            logger.info(`[Cleanup] Xóa file tạm cũ: ${file}`);
          }
        } catch {
          /* Bỏ qua file không đọc được */
        }
      }),
    );
  } catch {
    /* tempDir chưa tồn tại — bỏ qua */
  }
};

// Chạy mỗi ngày lúc 2:00 AM — dọn dẹp dữ liệu hết hạn và tích lũy
const runDailyCleanup = async () => {
  const { Cart, SearchHistory, User, DiscountCode, ChatMessage, RecentlyViewed, sequelize } =
    getModels();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // 1. Xóa abandoned carts cũ hơn 30 ngày
  try {
    const deletedCarts = await Cart.destroy({
      where: { status: 'abandoned', updatedAt: { [Op.lt]: thirtyDaysAgo } },
    });
    if (deletedCarts > 0) logger.info(`[Cleanup] Đã xóa ${deletedCarts} abandoned carts`);
  } catch (err) {
    logger.warn('[Cleanup] Lỗi xóa abandoned carts:', err.message);
  }

  // 2. Giới hạn search history: mỗi user chỉ giữ 50 entries gần nhất
  try {
    const [, meta] = await sequelize.query(`
      DELETE FROM search_histories
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
          FROM search_histories
          WHERE user_id IS NOT NULL
        ) ranked
        WHERE rn > 50
      )
    `);
    const trimmed = meta?.affectedRows || 0;
    if (trimmed > 0) logger.info(`[Cleanup] Đã trim ${trimmed} search history records`);
  } catch (err) {
    logger.warn('[Cleanup] Lỗi trim search history:', err.message);
  }

  // 2b. Xóa guest search history (userId=null) cũ hơn 7 ngày để tránh orphan accumulation
  try {
    const [, guestMeta] = await sequelize.query(`
      DELETE FROM search_histories
      WHERE user_id IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);
    const guestTrimmed = guestMeta?.affectedRows || 0;
    if (guestTrimmed > 0)
      logger.info(`[Cleanup] Đã xóa ${guestTrimmed} guest search history records`);
  } catch (err) {
    logger.warn('[Cleanup] Lỗi xóa guest search history:', err.message);
  }

  // 3. Xóa OTP hết hạn — null-out để không chiếm dung lượng
  try {
    const [, otpMeta] = await User.update(
      { otpCode: null, otpExpires: null },
      { where: { otpExpires: { [Op.lt]: new Date() }, otpCode: { [Op.ne]: null } } },
    );
    if (otpMeta > 0) logger.info(`[Cleanup] Đã xóa ${otpMeta} expired OTP`);
  } catch (err) {
    logger.warn('[Cleanup] Lỗi xóa expired OTP:', err.message);
  }

  // 4. Xóa reset token hết hạn
  try {
    const [, tokenMeta] = await User.update(
      { resetPasswordToken: null, resetPasswordExpires: null },
      {
        where: {
          resetPasswordExpires: { [Op.lt]: new Date() },
          resetPasswordToken: { [Op.ne]: null },
        },
      },
    );
    if (tokenMeta > 0) logger.info(`[Cleanup] Đã xóa ${tokenMeta} expired reset tokens`);
  } catch (err) {
    logger.warn('[Cleanup] Lỗi xóa expired reset tokens:', err.message);
  }

  // 5. Vô hiệu hóa discount codes hết hạn (không xóa — giữ lại cho audit)
  try {
    const [, dcMeta] = await DiscountCode.update(
      { isActive: false },
      { where: { endDate: { [Op.lt]: new Date() }, isActive: true } },
    );
    if (dcMeta > 0) logger.info(`[Cleanup] Đã deactivate ${dcMeta} expired discount codes`);
  } catch (err) {
    logger.warn('[Cleanup] Lỗi deactivate expired discount codes:', err.message);
  }

  // 6. Đánh dấu archived cho chat messages cũ hơn 90 ngày (AI chatbot)
  try {
    const [, chatMeta] = await ChatMessage.update(
      { isArchived: true },
      { where: { createdAt: { [Op.lt]: ninetyDaysAgo }, isArchived: { [Op.or]: [false, null] } } },
    );
    if (chatMeta > 0) logger.info(`[Cleanup] Đã archive ${chatMeta} chat messages cũ`);
  } catch (err) {
    logger.warn('[Cleanup] Lỗi archive chat messages:', err.message);
  }

  // 7. Xóa recently viewed cũ hơn 90 ngày
  try {
    const deletedRV = await RecentlyViewed.destroy({
      where: { viewedAt: { [Op.lt]: ninetyDaysAgo } },
    });
    if (deletedRV > 0) logger.info(`[Cleanup] Đã xóa ${deletedRV} recently viewed records cũ`);
  } catch (err) {
    logger.warn('[Cleanup] Lỗi xóa recently viewed cũ:', err.message);
  }

  // 8. Dọn file tạm trong uploads/temp
  await cleanupTempFiles();

  logger.info('[Cleanup] Daily cleanup completed');
};

// Chạy mỗi tuần Chủ Nhật 3:00 AM — dọn orphaned upload files
const runWeeklyCleanup = async () => {
  try {
    const imageService = require('@modules/image/services/image-service');
    await imageService.cleanupOrphanedFiles();
    logger.info('[Cleanup] Weekly orphaned file cleanup completed');
  } catch (err) {
    logger.warn('[Cleanup] Lỗi weekly cleanup:', err.message);
  }
};

// Đăng ký cron jobs
cron.schedule('0 2 * * *', runDailyCleanup);
cron.schedule('0 3 * * 0', runWeeklyCleanup);

// Export để test và trigger thủ công
module.exports = { runDailyCleanup, runWeeklyCleanup };
