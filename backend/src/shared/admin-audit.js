/**
 * @file adminAudit.js
 * @layer Shared
 * @module global
 * @description Cross-cutting infrastructure: adminAudit
 */
const { AsyncLocalStorage } = require('async_hooks');
const logger = require('@utils/logger');

// Lưu IP per-request qua AsyncLocalStorage thay vì mutate static methods
// (pattern cũ có race condition khi concurrent requests)
const requestContext = new AsyncLocalStorage();

// Hàm helper ghi audit log vào DB — dùng require lazy để tránh circular dependency
const writeToDb = async (logData) => {
  try {
    const { AuditLog } = require('@models');
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
      logger.error('AdminAuditService.logUserAction: adminUser is undefined');
      return;
    }

    const logData = {
      adminId: adminUser.id,
      action,
      entityType: 'user',
      entityId: targetUserId,
      oldValue: changes.old ?? null,
      newValue: changes.new ?? null,
      ip: ip ?? requestContext.getStore()?.ip ?? null,
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
      logger.error('AdminAuditService.logProductAction: adminUser is undefined');
      return;
    }

    const logData = {
      adminId: adminUser.id,
      action,
      entityType: 'product',
      entityId: productId,
      oldValue: null,
      // Lưu toàn bộ changes object, nếu rỗng thì lưu tên sản phẩm để có context
      newValue:
        Object.keys(changes).length > 0 ? changes : productName ? { name: productName } : null,
      ip: ip ?? requestContext.getStore()?.ip ?? null,
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
      logger.error('AdminAuditService.logOrderAction: adminUser is undefined');
      return;
    }

    const logData = {
      adminId: adminUser.id,
      action,
      entityType: 'order',
      entityId: orderId,
      oldValue: null,
      newValue: Object.keys(changes).length > 0 ? changes : null,
      ip: ip ?? requestContext.getStore()?.ip ?? null,
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
      logger.error('AdminAuditService.logDiscountCodeAction: adminUser is undefined');
      return;
    }

    const logData = {
      adminId: adminUser.id,
      action,
      entityType: 'discount_code',
      entityId: discountId,
      oldValue: changes.old ?? null,
      newValue: changes.new ?? (code ? { code } : null),
      ip: ip ?? requestContext.getStore()?.ip ?? null,
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
      logger.error('AdminAuditService.logReviewAction: adminUser is undefined');
      return;
    }

    const logData = {
      adminId: adminUser.id,
      action,
      entityType: 'review',
      entityId: reviewId,
      oldValue: null,
      newValue: { userId, productId },
      ip: ip ?? requestContext.getStore()?.ip ?? null,
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
      ip: ip ?? requestContext.getStore()?.ip ?? null,
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
      ip: ip ?? requestContext.getStore()?.ip ?? null,
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
 * Middleware inject IP vào request context qua AsyncLocalStorage.
 * Dùng AsyncLocalStorage thay vì mutate static methods để tránh race condition
 * khi concurrent requests ghi đè lẫn nhau.
 */
const auditMiddleware = (req, _res, next) => {
  const ip = req.ip || req.connection?.remoteAddress;
  requestContext.run({ ip }, next);
};

module.exports = {
  AdminAuditService,
  auditMiddleware,
};
