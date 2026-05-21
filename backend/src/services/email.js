const nodemailer = require('nodemailer');
const logger = require('@utils/logger');
const { t } = require('@utils/i18n');

const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

const dateLocale = (lang) => (lang === 'en' ? 'en-US' : 'vi-VN');

const createTransporter = () => {
  const isGmail = process.env.EMAIL_HOST === 'smtp.gmail.com';

  const config = {
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
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

let transporterInstance = null;
const getTransporter = () => {
  if (!transporterInstance) {
    transporterInstance = createTransporter();
  }
  return transporterInstance;
};

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
    logger.error(
      `[EmailService] Failed to send single email to ${options.email}: ${error.message}`,
    );
    throw error;
  }
};

const sendOtpEmail = async (email, otp, lang = 'vi') => {
  const storeName = process.env.EMAIL_FROM_NAME || 'TechStore';
  await sendEmail({
    email,
    subject: t('email.otp.subject', lang, { storeName }),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
        <div style="background: white; padding: 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <h2 style="color: #1a1a1a; margin-bottom: 8px; font-size: 24px;">${t('email.otp.title', lang)}</h2>
          <p style="color: #555; margin-bottom: 24px;">${t('email.otp.description', lang)}</p>

          <div style="background: #f0f4ff; border: 2px dashed #4f6ef7; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <p style="color: #888; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 2px;">${t('email.otp.label', lang)}</p>
            <div style="font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #4f6ef7; font-family: 'Courier New', monospace;">${otp}</div>
          </div>

          <p style="color: #e74c3c; font-size: 13px; text-align: center; margin-top: 16px;">${t('email.otp.expiry', lang)}</p>
          <p style="color: #aaa; font-size: 12px; text-align: center; margin-top: 8px;">${t('email.otp.ignore', lang)}</p>
        </div>
      </div>
    `,
  });
};

const sendResetPasswordEmail = async (email, token, lang = 'vi') => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await sendEmail({
    email,
    subject: t('email.resetPassword.subject', lang),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${t('email.resetPassword.title', lang)}</h2>
        <p>${t('email.resetPassword.description', lang)}</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">
            ${t('email.resetPassword.linkText', lang)}
          </a>
        </p>
        <p>${t('email.resetPassword.ignore', lang)}</p>
        <p>${t('email.resetPassword.expiry', lang)}</p>
      </div>
    `,
  });
};

const sendOrderConfirmationEmail = async (email, order, lang = 'vi') => {
  const {
    orderNumber,
    orderDate,
    subtotal,
    shippingCost,
    total,
    items,
    shippingAddress,
    estimatedDelivery,
  } = order;
  const loc = dateLocale(lang);

  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${parseFloat(item.price).toLocaleString(loc)}đ</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${parseFloat(item.subtotal).toLocaleString(loc)}đ</td>
      </tr>
    `,
    )
    .join('');

  const estimatedDeliveryHtml = estimatedDelivery
    ? `<p><strong>${t('email.orderConfirmation.estimatedDelivery', lang)}</strong> ${new Date(estimatedDelivery).toLocaleDateString(loc)}</p>`
    : '';

  await sendEmail({
    email,
    subject: t('email.orderConfirmation.subject', lang, { orderNumber: escapeHtml(orderNumber) }),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${t('email.orderConfirmation.title', lang)}</h2>
        <p>${t('email.orderConfirmation.thankYou', lang)}</p>

        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p><strong>${t('email.orderConfirmation.orderNumber', lang)}</strong> #${escapeHtml(orderNumber)}</p>
          <p><strong>${t('email.orderConfirmation.orderDate', lang)}</strong> ${new Date(orderDate).toLocaleDateString(loc)}</p>
          ${estimatedDeliveryHtml}
        </div>

        <h3>${t('email.orderConfirmation.orderDetails', lang)}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="padding: 10px; text-align: left;">${t('email.orderConfirmation.product', lang)}</th>
              <th style="padding: 10px; text-align: center;">${t('email.orderConfirmation.quantity', lang)}</th>
              <th style="padding: 10px; text-align: right;">${t('email.orderConfirmation.unitPrice', lang)}</th>
              <th style="padding: 10px; text-align: right;">${t('email.orderConfirmation.lineTotal', lang)}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 10px; text-align: right;">${t('email.orderConfirmation.subtotal', lang)}</td>
              <td style="padding: 10px; text-align: right;">${parseFloat(subtotal).toLocaleString(loc)}đ</td>
            </tr>
            <tr>
              <td colspan="3" style="padding: 10px; text-align: right;">${t('email.orderConfirmation.shipping', lang)}</td>
              <td style="padding: 10px; text-align: right;">${parseFloat(shippingCost).toLocaleString(loc)}đ</td>
            </tr>
            <tr>
              <td colspan="3" style="padding: 10px; text-align: right;"><strong>${t('email.orderConfirmation.total', lang)}</strong></td>
              <td style="padding: 10px; text-align: right;"><strong>${parseFloat(total).toLocaleString(loc)}đ</strong></td>
            </tr>
          </tfoot>
        </table>

        <h3>${t('email.orderConfirmation.shippingAddress', lang)}</h3>
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p>${escapeHtml(shippingAddress.name)}</p>
          <p>${escapeHtml(shippingAddress.address1)}</p>
          ${shippingAddress.address2 ? `<p>${escapeHtml(shippingAddress.address2)}</p>` : ''}
          <p>${escapeHtml(shippingAddress.city)}, ${escapeHtml(shippingAddress.state)} ${escapeHtml(shippingAddress.zip || '')}</p>
          <p>${escapeHtml(shippingAddress.country || '')}</p>
        </div>

        <p>${t('email.orderConfirmation.notification', lang)}</p>
        <p>${t('email.orderConfirmation.contactUs', lang)}</p>
      </div>
    `,
  });
};

const sendOrderStatusUpdateEmail = async (email, order, lang = 'vi') => {
  const { orderNumber, orderDate, status } = order;
  const loc = dateLocale(lang);
  const statusText = t(`email.orderStatus.statuses.${status}`, lang) || status;

  await sendEmail({
    email,
    subject: t('email.orderStatus.subject', lang, { orderNumber }),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${t('email.orderStatus.title', lang)}</h2>
        <p>${t('email.orderStatus.updated', lang)}</p>

        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p><strong>${t('email.orderStatus.orderNumber', lang)}</strong> #${orderNumber}</p>
          <p><strong>${t('email.orderStatus.orderDate', lang)}</strong> ${new Date(orderDate).toLocaleDateString(loc)}</p>
          <p><strong>${t('email.orderStatus.newStatus', lang)}</strong> ${statusText}</p>
        </div>

        <p>${t('email.orderStatus.trackOrder', lang)}</p>
        <p>${t('email.orderStatus.contactUs', lang)}</p>
      </div>
    `,
  });
};

const sendOrderCancellationEmail = async (email, order, lang = 'vi') => {
  const { orderNumber, orderDate } = order;
  const loc = dateLocale(lang);

  await sendEmail({
    email,
    subject: t('email.orderCancelled.subject', lang, { orderNumber }),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${t('email.orderCancelled.title', lang)}</h2>
        <p>${t('email.orderCancelled.description', lang)}</p>

        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p><strong>${t('email.orderCancelled.orderNumber', lang)}</strong> #${orderNumber}</p>
          <p><strong>${t('email.orderCancelled.orderDate', lang)}</strong> ${new Date(orderDate).toLocaleDateString(loc)}</p>
        </div>

        <p>${t('email.orderCancelled.refund', lang)}</p>
        <p>${t('email.orderCancelled.contactUs', lang)}</p>
      </div>
    `,
  });
};

const sendAdminFeedbackNotification = async (adminEmail, feedback, lang = 'vi') => {
  const { name, email, subject, content } = feedback;

  await sendEmail({
    email: adminEmail,
    subject: t('email.contactFeedback.subject', lang, { subject: escapeHtml(subject) }),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
        <div style="background: white; padding: 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <h2 style="color: #e74c3c; margin-bottom: 8px; font-size: 20px;">${t('email.contactFeedback.title', lang)}</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #555; width: 120px;">${t('email.contactFeedback.name', lang)}</td>
              <td style="padding: 8px; color: #333;">${escapeHtml(name)}</td>
            </tr>
            <tr style="background: #f9f9f9;">
              <td style="padding: 8px; font-weight: bold; color: #555;">${t('email.contactFeedback.email', lang)}</td>
              <td style="padding: 8px; color: #333;">${escapeHtml(email)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #555;">${t('email.contactFeedback.subjectLabel', lang)}</td>
              <td style="padding: 8px; color: #333;">${escapeHtml(subject)}</td>
            </tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f0f4ff; border-radius: 8px; border-left: 4px solid #4f6ef7;">
            <p style="color: #555; font-weight: bold; margin-bottom: 8px;">${t('email.contactFeedback.content', lang)}</p>
            <p style="color: #333; white-space: pre-wrap;">${escapeHtml(content)}</p>
          </div>
          <p style="color: #aaa; font-size: 12px; text-align: center; margin-top: 24px;">${t('email.contactFeedback.autoNotice', lang)}</p>
        </div>
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
  sendAdminFeedbackNotification,
};
