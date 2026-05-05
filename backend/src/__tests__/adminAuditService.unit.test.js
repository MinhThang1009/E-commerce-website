/**
 * Phase 44 — Unit tests cho AdminAuditService (services/adminAudit.js)
 * Mục tiêu: verify mỗi log method gọi logger với đúng shape + writeToDb với đúng entity payload.
 */

// Mock logger trước require service
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock('../utils/logger', () => mockLogger);

// Mock AuditLog model — service lazy require qua require('../models')
const mockAuditLogCreate = jest.fn().mockResolvedValue({ id: 1 });
jest.mock('../models', () => ({
  AuditLog: { create: mockAuditLogCreate },
}));

const { AdminAuditService } = require('../services/adminAudit');

const fakeAdmin = { id: 99, email: 'admin@x.com' };

beforeEach(() => {
  mockLogger.info.mockClear();
  mockLogger.warn.mockClear();
  mockLogger.error.mockClear();
  mockAuditLogCreate.mockClear();
});

describe('AdminAuditService.logUserAction', () => {
  test('Gọi logger.info với entityType "user" + writeToDb', async () => {
    AdminAuditService.logUserAction(
      fakeAdmin,
      'BAN_USER',
      42,
      { old: { isActive: true }, new: { isActive: false } },
      '127.0.0.1'
    );

    // Logger gọi với ADMIN_USER_ACTION
    expect(mockLogger.info).toHaveBeenCalledWith(
      'ADMIN_USER_ACTION',
      expect.objectContaining({
        adminId: 99,
        action: 'BAN_USER',
        entityType: 'user',
        entityId: 42,
        adminEmail: 'admin@x.com',
        ip: '127.0.0.1',
      })
    );

    // writeToDb chạy async — chờ next tick
    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 99,
        action: 'BAN_USER',
        entityType: 'user',
        entityId: 42,
        oldValue: JSON.stringify({ isActive: true }),
        newValue: JSON.stringify({ isActive: false }),
        ip: '127.0.0.1',
      })
    );
  });

  test('adminUser undefined → log error + KHÔNG gọi writeToDb', () => {
    AdminAuditService.logUserAction(undefined, 'X', 1);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('adminUser is undefined')
    );
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });
});

describe('AdminAuditService.logProductAction', () => {
  test('changes rỗng + có productName → newValue là { name }', async () => {
    AdminAuditService.logProductAction(
      fakeAdmin,
      'DELETE_PRODUCT',
      42,
      'iPhone 17',
      {},
      '10.0.0.1'
    );

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE_PRODUCT',
        entityType: 'product',
        entityId: 42,
        newValue: JSON.stringify({ name: 'iPhone 17' }),
      })
    );
  });

  test('changes có data → newValue là changes (priority hơn productName)', async () => {
    AdminAuditService.logProductAction(
      fakeAdmin,
      'UPDATE_PRODUCT',
      10,
      'X',
      { price: { old: 100, new: 200 } }
    );

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: JSON.stringify({ price: { old: 100, new: 200 } }),
      })
    );
  });
});

describe('AdminAuditService.logOrderAction', () => {
  test('Pass orderCode vào logger, entityType "order"', () => {
    AdminAuditService.logOrderAction(
      fakeAdmin,
      'REFUND',
      55,
      'ORD-001',
      { amount: 100000 }
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ADMIN_ORDER_ACTION',
      expect.objectContaining({
        action: 'REFUND',
        entityType: 'order',
        entityId: 55,
        orderCode: 'ORD-001',
      })
    );
  });
});

describe('AdminAuditService.logDiscountCodeAction', () => {
  test('changes.new fallback sang { code } khi không có changes', async () => {
    AdminAuditService.logDiscountCodeAction(
      fakeAdmin,
      'CREATE',
      77,
      'SAVE10',
      {}
    );

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'discount_code',
        entityId: 77,
        newValue: JSON.stringify({ code: 'SAVE10' }),
      })
    );
  });
});

describe('AdminAuditService.logFailedAuth', () => {
  test('Log warn (KHÔNG ghi DB)', () => {
    AdminAuditService.logFailedAuth('hacker@x.com', 'invalid_password', '1.2.3.4');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ADMIN_AUTH_FAILED',
      expect.objectContaining({
        email: 'hacker@x.com',
        reason: 'invalid_password',
        ip: '1.2.3.4',
      })
    );
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });
});

describe('AdminAuditService.logDashboardAccess', () => {
  test('Log info, KHÔNG ghi DB', () => {
    AdminAuditService.logDashboardAccess(fakeAdmin, '/api/admin/stats', { period: 'month' });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ADMIN_DASHBOARD_ACCESS',
      expect.objectContaining({
        adminId: 99,
        endpoint: '/api/admin/stats',
        filters: { period: 'month' },
      })
    );
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  test('adminUser undefined → silent return (không log, không error)', () => {
    AdminAuditService.logDashboardAccess(undefined, '/x');
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});

describe('AdminAuditService.logSuccessfulLogin', () => {
  test('entityType "admin_session", action "LOGIN_SUCCESS"', async () => {
    AdminAuditService.logSuccessfulLogin(fakeAdmin, '127.0.0.1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ADMIN_LOGIN_SUCCESS',
      expect.objectContaining({
        action: 'LOGIN_SUCCESS',
        entityType: 'admin_session',
        ip: '127.0.0.1',
      })
    );
  });
});

describe('writeToDb error handling', () => {
  test('AuditLog.create reject → log error, KHÔNG throw ra ngoài', async () => {
    mockAuditLogCreate.mockRejectedValueOnce(new Error('DB connection lost'));

    AdminAuditService.logUserAction(fakeAdmin, 'X', 1);

    await new Promise((r) => setImmediate(r));
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi ghi audit log vào DB:'),
      expect.any(String)
    );
  });
});
