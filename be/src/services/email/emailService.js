const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');

// Create transporter with connection pooling for better performance
const createTransporter = () => {
  const isGmail = process.env.EMAIL_HOST === 'smtp.gmail.com';
  
  const config = {
    pool: true, // Enable pooling
    maxConnections: 3, // Max concurrent connections
    maxMessages: 100, // Max messages per connection
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || (isGmail ? 587 : 465),
    secure: process.env.EMAIL_SECURE === 'true' || (!isGmail && process.env.EMAIL_PORT === '465'),
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  };

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      pool: true,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  return nodemailer.createTransport(config);
};

// Singleton transporter instance
let transporterInstance = null;
const getTransporter = () => {
  if (!transporterInstance) {
    transporterInstance = createTransporter();
  }
  return transporterInstance;
};

// Send email
const sendEmail = async (options) => {
  const transporter = getTransporter();
  logger.info(`[EmailService] Sending single email to ${options.email}...`);

  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[EmailService] Single email sent successfully: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`[EmailService] Failed to send single email to ${options.email}: ${error.message}`);
    throw error;
  }
};

// Send newsletter welcome email
const sendNewsletterWelcomeEmail = async (email) => {
  await sendEmail({
    email,
    subject: 'Cảm ơn bạn đã đăng ký nhận bản tin!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
        <div style="background: white; padding: 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <h2 style="color: #4f6ef7; margin-bottom: 8px; font-size: 24px;">Chào mừng bạn!</h2>
          <p style="color: #555; margin-bottom: 24px;">Cảm ơn bạn đã đăng ký nhận bản tin từ chúng tôi. Bạn sẽ nhận được những thông tin mới nhất về sản phẩm, khuyến mãi và tin tức từ cửa hàng.</p>
          
          <div style="background: #f0f4ff; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <p style="color: #4f6ef7; font-weight: bold; margin: 0;">Khám phá ngay các sản phẩm mới nhất của chúng tôi!</p>
            <a href="${process.env.FRONTEND_URL}/shop" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background-color: #4f6ef7; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Đi đến cửa hàng</a>
          </div>

          <p style="color: #aaa; font-size: 12px; text-align: center; margin-top: 16px;">Nếu bạn không muốn nhận email nữa, bạn có thể hủy đăng ký bất kỳ lúc nào.</p>
        </div>
      </div>
    `,
  });
};

// Send bulk campaign email in batches to avoid rate limits
const sendBulkCampaignEmail = async (emails, subject, content) => {
  const transporter = getTransporter();
  logger.info(`[EmailService] Starting bulk email send to ${emails.length} recipients in batches...`);
  
  const results = [];
  const batchSize = 5; // Send 5 emails at a time
  const delay = 1000; // 1 second delay between batches

  for (let i = 0; i < emails.length; i += batchSize) {
    const currentBatch = emails.slice(i, i + batchSize);
    logger.info(`[EmailService] Sending batch ${Math.floor(i / batchSize) + 1} (${currentBatch.length} emails)...`);

    const batchPromises = currentBatch.map(email => {
      const mailOptions = {
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
        to: email,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #eee;">
              ${content}
            </div>
            <div style="margin-top: 20px; text-align: center; color: #888; font-size: 12px;">
              <p>Bạn nhận được email này vì bạn là thành viên của hệ thống chúng tôi.</p>
              <p>&copy; ${new Date().getFullYear()} ${process.env.EMAIL_FROM_NAME}. All rights reserved.</p>
            </div>
          </div>
        `,
      };
      
      return transporter.sendMail(mailOptions)
        .then(info => {
          logger.info(`[EmailService] Successfully sent to ${email}`);
          return { email, success: true, messageId: info.messageId };
        })
        .catch(err => {
          logger.error(`[EmailService] Failed to send to ${email}: ${err.message}`);
          return { email, success: false, error: err.message };
        });
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Wait before next batch if there are more emails
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  
  logger.info(`[EmailService] Bulk send completed. Total: ${results.length}, Success: ${successCount}, Failed: ${failCount}`);
  
  if (successCount === 0 && results.length > 0) {
    throw new Error('All emails failed to send. Check logs for details.');
  }

  return results;
};

// Send OTP verification email
const sendOtpEmail = async (email, otp) => {
  await sendEmail({
    email,
    subject: 'Mã xác thực tài khoản của bạn',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
        <div style="background: white; padding: 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <h2 style="color: #1a1a1a; margin-bottom: 8px; font-size: 24px;">Xác thực tài khoản</h2>
          <p style="color: #555; margin-bottom: 24px;">Cảm ơn bạn đã đăng ký. Nhập mã OTP bên dưới để kích hoạt tài khoản của bạn:</p>

          <div style="background: #f0f4ff; border: 2px dashed #4f6ef7; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <p style="color: #888; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 2px;">Mã xác thực OTP</p>
            <div style="font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #4f6ef7; font-family: 'Courier New', monospace;">${otp}</div>
          </div>

          <p style="color: #e74c3c; font-size: 13px; text-align: center; margin-top: 16px;">⏰ Mã này có hiệu lực trong <strong>10 phút</strong></p>
          <p style="color: #aaa; font-size: 12px; text-align: center; margin-top: 8px;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
        </div>
      </div>
    `,
  });
};


// Send reset password email
const sendResetPasswordEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await sendEmail({
    email,
    subject: 'Đặt lại mật khẩu của bạn',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Đặt lại mật khẩu</h2>
        <p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng nhấp vào liên kết bên dưới để đặt lại mật khẩu của bạn:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">
            Đặt lại mật khẩu
          </a>
        </p>
        <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
        <p>Liên kết này sẽ hết hạn sau 1 giờ.</p>
      </div>
    `,
  });
};

// Send order confirmation email
const sendOrderConfirmationEmail = async (email, order) => {
  const { orderNumber, orderDate, total, items, shippingAddress } = order;

  // Format items HTML
  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.price.toLocaleString('vi-VN')}đ</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.subtotal.toLocaleString('vi-VN')}đ</td>
      </tr>
    `
    )
    .join('');

  await sendEmail({
    email,
    subject: `Xác nhận đơn hàng #${orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Xác nhận đơn hàng</h2>
        <p>Cảm ơn bạn đã đặt hàng. Đơn hàng của bạn đã được xác nhận.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p><strong>Mã đơn hàng:</strong> #${orderNumber}</p>
          <p><strong>Ngày đặt hàng:</strong> ${new Date(orderDate).toLocaleDateString('vi-VN')}</p>
          <p><strong>Tổng tiền:</strong> ${total.toLocaleString('vi-VN')}đ</p>
        </div>
        
        <h3>Chi tiết đơn hàng</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="padding: 10px; text-align: left;">Sản phẩm</th>
              <th style="padding: 10px; text-align: center;">Số lượng</th>
              <th style="padding: 10px; text-align: right;">Đơn giá</th>
              <th style="padding: 10px; text-align: right;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 10px; text-align: right;"><strong>Tổng cộng:</strong></td>
              <td style="padding: 10px; text-align: right;"><strong>${total.toLocaleString('vi-VN')}đ</strong></td>
            </tr>
          </tfoot>
        </table>
        
        <h3>Địa chỉ giao hàng</h3>
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p>${shippingAddress.name}</p>
          <p>${shippingAddress.address1}</p>
          ${shippingAddress.address2 ? `<p>${shippingAddress.address2}</p>` : ''}
          <p>${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zip}</p>
          <p>${shippingAddress.country}</p>
        </div>
        
        <p>Chúng tôi sẽ thông báo cho bạn khi đơn hàng được giao.</p>
        <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi.</p>
      </div>
    `,
  });
};

// Send order status update email
const sendOrderStatusUpdateEmail = async (email, order) => {
  const { orderNumber, orderDate, status } = order;

  // Map status to Vietnamese
  const statusMap = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    shipped: 'Đã giao cho đơn vị vận chuyển',
    delivered: 'Đã giao hàng',
    cancelled: 'Đã hủy',
    completed: 'Hoàn thành',
  };

  const statusText = statusMap[status] || status;

  await sendEmail({
    email,
    subject: `Cập nhật trạng thái đơn hàng #${orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Cập nhật trạng thái đơn hàng</h2>
        <p>Đơn hàng của bạn đã được cập nhật.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p><strong>Mã đơn hàng:</strong> #${orderNumber}</p>
          <p><strong>Ngày đặt hàng:</strong> ${new Date(orderDate).toLocaleDateString('vi-VN')}</p>
          <p><strong>Trạng thái mới:</strong> ${statusText}</p>
        </div>
        
        <p>Bạn có thể theo dõi đơn hàng của mình trong tài khoản của bạn.</p>
        <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi.</p>
      </div>
    `,
  });
};

// Send order cancellation email
const sendOrderCancellationEmail = async (email, order) => {
  const { orderNumber, orderDate } = order;

  await sendEmail({
    email,
    subject: `Đơn hàng #${orderNumber} đã bị hủy`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Đơn hàng đã bị hủy</h2>
        <p>Đơn hàng của bạn đã bị hủy theo yêu cầu của bạn.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p><strong>Mã đơn hàng:</strong> #${orderNumber}</p>
          <p><strong>Ngày đặt hàng:</strong> ${new Date(orderDate).toLocaleDateString('vi-VN')}</p>
        </div>
        
        <p>Nếu bạn đã thanh toán cho đơn hàng này, khoản tiền sẽ được hoàn lại trong vòng 5-7 ngày làm việc.</p>
        <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi.</p>
      </div>
    `,
  });
};

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendResetPasswordEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendOrderCancellationEmail,
  sendNewsletterWelcomeEmail,
  sendBulkCampaignEmail,
};

