const logger = require('../../utils/logger');

// Hàm helper ghi audit log vào DB — dùng require lazy để tránh circular dependency
const writeToDb = async (logData) => {
  try {
    const { AuditLog } = require('../../models');
    await AuditLog.create({
      adminId: logData.adminId,
      action: logData.action,
      entityType: logData.entityType,
      entityId: logData.entityId ?? null,
      oldValue: logData.oldValue ? JSON.stringify(logData.oldValue) : null,
      newValue: logData.newValue ? JSON.stringify(logData.newValue) : null,
      ip: logData.ip ?? null,
    });
  } catch (dbErr) {
    // Không throw — DB lỗi không được làm gián đoạn request chính
    logger.error('Lỗi ghi audit log vào DB:', dbErr.message);
  }
};

/**
 * Service để log các hoạt động của admin vào DB và file log
 * Format bắt buộc: { adminId, action, entityType, entityId, oldValue, newValue, timestamp, ip }
 */
class AdminAuditService {
  // Log hoạt động trên user (ban, role change, delete)
  static logUserAction(adminUser, action, targetUserId, changes = {}, ip = null) {
    if (!adminUser) {
      console.error('AdminAuditService.logUserAction: adminUser is undefined');
      return;
    }

    const logData = {
      adminId: adminUser.id,
      action,
      entityType: 'user',
      entityId: targetUserId,
      oldValue: changes.old ?? null,
      newValue: changes.new ?? null,
      ip,
    };

    logger.info('ADMIN_USER_ACTION', {
      ...logData,
      adminEmail: adminUser.email,
      timestamp: new Date().toISOString(),
    });
    writeToDb(logData);
  }

  // Log hoạt động trên product (create, update, delete, clone, bulk import)
  // changes là object tùy ý mô tả thay đổi — được lưu nguyên vào newValue dưới dạng JSON
  static logProductAction(adminUser, action, productId, productName, changes = {}, ip = null) {
    if (!adminUser) {
      console.error('AdminAuditService.logProductAction: adminUser is undefined');
      return;
    }

    const logData = {
      adminId: adminUser.id,
      action,
      entityType: 'product',
      entityId: productId,
      oldValue: null,
      // Lưu toàn bộ changes object, nếu rỗng thì lưu tên sản phẩm để có context
      newValue: Object.keys(changes).length > 0 ? changes : (productName ? { name: productName } : null),
      ip,
    };

    logger.info('ADMIN_PRODUCT_ACTION', {
      ...logData,
      adminEmail: adminUser.email,
      productName,
      timestamp: new Date().toISOString(),
    });
    writeToDb(logData);
  }

  // Log hoạt động trên order (status change, cancel, refund)
  // changes là object tùy ý mô tả thay đổi
  static logOrderAction(adminUser, action, orderId, orderCode, changes = {}, ip = null) {
    if (!adminUser) {
      console.error('AdminAuditService.logOrderAction: adminUser is undefined');
      return;
    }

    const logData = {
      adminId: adminUser.id,
      action,
      entityType: 'order',
      entityId: orderId,
      oldValue: null,
      newValue: Object.keys(changes).length > 0 ? changes : null,
      ip,
    };

    logger.info('ADMIN_ORDER_ACTION', {
      ...logData,
      adminEmail: adminUser.email,
      orderCode,
      timestamp: new Date().toISOString(),
    });
    writeToDb(logData);
  }

  // Log hoạt động trên discount code (create, delete, deactivate)
  static logDiscountCodeAction(adminUser, action, discountId, code, changes = {}, ip = null) {
    if (!adminUser) {
      console.error('AdminAuditService.logDiscountCodeAction: adminUser is undefined');
      return;
    }

    const logData = {
      adminId: adminUser.id,
      action,
      entityType: 'discount_code',
      entityId: discountId,
      oldValue: changes.old ?? null,
      newValue: changes.new ?? (code ? { code } : null),
      ip,
    };

    logger.info('ADMIN_DISCOUNT_CODE_ACTION', {
      ...logData,
      adminEmail: adminUser.email,
      code,
      timestamp: new Date().toISOString(),
    });
    writeToDb(logData);
  }

  // Log hoạt động xóa review
  static logReviewAction(adminUser, action, reviewId, userId, productId, ip = null) {
    if (!adminUser) {
      console.error('AdminAuditService.logReviewAction: adminUser is undefined');
      return;
    }

    const logData = {
      adminId: adminUser.id,
      action,
      entityType: 'review',
      entityId: reviewId,
      oldValue: null,
      newValue: { userId, productId },
      ip,
    };

    logger.info('ADMIN_REVIEW_ACTION', {
      ...logData,
      adminEmail: adminUser.email,
      timestamp: new Date().toISOString(),
    });
    writeToDb(logData);
  }

  // Log đăng nhập thành công của admin
  static logSuccessfulLogin(adminUser, ip) {
    const logData = {
      adminId: adminUser.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'admin_session',
      entityId: null,
      oldValue: null,
      newValue: null,
      ip,
    };

    logger.info('ADMIN_LOGIN_SUCCESS', {
      ...logData,
      adminEmail: adminUser.email,
      timestamp: new Date().toISOString(),
    });
    writeToDb(logData);
  }

  // Log xác thực thất bại (không ghi vào DB vì không biết adminId)
  static logFailedAuth(email, reason, ip) {
    logger.warn('ADMIN_AUTH_FAILED', {
      email,
      reason,
      timestamp: new Date().toISOString(),
      ip,
    });
  }

  // Log truy cập dashboard (không ghi vào DB — quá nhiều, chỉ cần file log)
  static logDashboardAccess(adminUser, endpoint, filters = {}) {
    if (!adminUser) return;
    logger.info('ADMIN_DASHBOARD_ACCESS', {
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'DASHBOARD_ACCESS',
      endpoint,
      filters,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Middleware inject IP vào các method của AdminAuditService cho request hiện tại
 */
const auditMiddleware = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress;

  // Ghi đè các method để tự động inject IP từ request
  const originalLogUserAction = AdminAuditService.logUserAction;
  const originalLogProductAction = AdminAuditService.logProductAction;
  const originalLogOrderAction = AdminAuditService.logOrderAction;
  const originalLogDiscountCodeAction = AdminAuditService.logDiscountCodeAction;
  const originalLogReviewAction = AdminAuditService.logReviewAction;
  const originalLogDashboardAccess = AdminAuditService.logDashboardAccess;
  const originalLogSuccessfulLogin = AdminAuditService.logSuccessfulLogin;

  AdminAuditService.logUserAction = (adminUser, action, targetUserId, changes = {}) =>
    originalLogUserAction(adminUser, action, targetUserId, changes, ip);

  AdminAuditService.logProductAction = (adminUser, action, productId, productName, changes = {}) =>
    originalLogProductAction(adminUser, action, productId, productName, changes, ip);

  AdminAuditService.logOrderAction = (adminUser, action, orderId, orderCode, changes = {}) =>
    originalLogOrderAction(adminUser, action, orderId, orderCode, changes, ip);

  AdminAuditService.logDiscountCodeAction = (adminUser, action, discountId, code, changes = {}) =>
    originalLogDiscountCodeAction(adminUser, action, discountId, code, changes, ip);

  AdminAuditService.logReviewAction = (adminUser, action, reviewId, userId, productId) =>
    originalLogReviewAction(adminUser, action, reviewId, userId, productId, ip);

  AdminAuditService.logDashboardAccess = (adminUser, endpoint, filters = {}) =>
    originalLogDashboardAccess(adminUser, endpoint, filters);

  AdminAuditService.logSuccessfulLogin = (adminUser) =>
    originalLogSuccessfulLogin(adminUser, ip);

  // Khôi phục method gốc sau khi xử lý xong request
  res.on('finish', () => {
    AdminAuditService.logUserAction = originalLogUserAction;
    AdminAuditService.logProductAction = originalLogProductAction;
    AdminAuditService.logOrderAction = originalLogOrderAction;
    AdminAuditService.logDiscountCodeAction = originalLogDiscountCodeAction;
    AdminAuditService.logReviewAction = originalLogReviewAction;
    AdminAuditService.logDashboardAccess = originalLogDashboardAccess;
    AdminAuditService.logSuccessfulLogin = originalLogSuccessfulLogin;
  });

  next();
};

module.exports = {
  AdminAuditService,
  auditMiddleware,
};
