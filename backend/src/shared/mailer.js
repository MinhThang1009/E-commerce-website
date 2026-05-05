// Re-export Nodemailer wrapper hiện ở services/email. Hiện chứa cả templates
// (OTP, campaigns, order confirmation, ...) trộn lẫn với transport. Sprint 6
// (notifications module) sẽ tách: shared/mailer giữ thuần transport
// (sendMail/getTransporter), templates move sang modules/notifications.
module.exports = require('../services/email');
