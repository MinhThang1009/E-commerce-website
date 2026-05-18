/**
 * Branch coverage tests cho src/services/adminAudit.js
 * Target: line 232
 *
 * Line 232: AdminAuditService.logDashboardAccess = (adminUser, endpoint, filters = {}) =>
 *   originalLogDashboardAccess(adminUser, endpoint, filters);
 *
 * Middleware (auditMiddleware) gán lại logDashboardAccess. Khi method gán lại này được gọi
 * không có argument thứ ba (filters) → default param `= {}` được dùng → filters = {}.
 *
 * Nhánh cần cover: gọi logDashboardAccess mà không truyền filters (dùng default {}).
 *
 * Ngoài ra kiểm tra logDashboardAccess.static (line 189): adminUser null → return sớm.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('@utils/logger', () => mockLogger);

const mockAuditLogCreate = jest.fn().mockResolvedValue({ id: 1 });
jest.mock('@models', () => ({ AuditLog: { create: mockAuditLogCreate } }));

const { AdminAuditService, auditMiddleware } = require('./admin-audit');

const adminUser = { id: 99, email: 'dash@shop.vn' };

beforeEach(() => {
  jest.clearAllMocks();
});

// ── logDashboardAccess: default parameter {} khi không truyền filters (line 232) ──

describe('auditMiddleware — logDashboardAccess không truyền filters (line 232 default param = {})', () => {
  // Snapshot các method gốc để restore sau test
  let originalMethods = {};

  beforeEach(() => {
    originalMethods = {
      logUserAction: AdminAuditService.logUserAction,
      logProductAction: AdminAuditService.logProductAction,
      logOrderAction: AdminAuditService.logOrderAction,
      logDiscountCodeAction: AdminAuditService.logDiscountCodeAction,
      logReviewAction: AdminAuditService.logReviewAction,
      logDashboardAccess: AdminAuditService.logDashboardAccess,
      logSuccessfulLogin: AdminAuditService.logSuccessfulLogin,
    };
  });

  afterEach(() => {
    Object.assign(AdminAuditService, originalMethods);
  });

  it('filters mặc định {} khi gọi logDashboardAccess không có argument thứ ba', () => {
    // Simulate middleware đang chạy bằng cách gọi auditMiddleware
    const req = { ip: '10.0.0.1', connection: { remoteAddress: '10.0.0.1' } };
    const res = { on: jest.fn() };
    const next = jest.fn();

    auditMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();

    // Gọi logDashboardAccess không có filters → filters = {} (default)
    AdminAuditService.logDashboardAccess(adminUser, '/api/admin/dashboard');
    // Không throw, logger.info được gọi với filters = {}
    expect(mockLogger.info).toHaveBeenCalledWith(
      'ADMIN_DASHBOARD_ACCESS',
      expect.objectContaining({
        adminId: 99,
        endpoint: '/api/admin/dashboard',
        filters: {}, // default {} được sử dụng
      }),
    );
  });

  it('filters được truyền tường minh → không dùng default {}', () => {
    const req = { ip: '10.0.0.2', connection: { remoteAddress: '10.0.0.2' } };
    const res = { on: jest.fn() };
    const next = jest.fn();

    auditMiddleware(req, res, next);

    const customFilters = { status: 'active', page: 1 };
    AdminAuditService.logDashboardAccess(adminUser, '/api/admin/products', customFilters);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ADMIN_DASHBOARD_ACCESS',
      expect.objectContaining({
        filters: customFilters,
      }),
    );
  });
});

// ── logDashboardAccess.static (line 189): adminUser null → return sớm ────────

describe('AdminAuditService.logDashboardAccess — adminUser null → return (line 190)', () => {
  it('không throw và không gọi logger khi adminUser null', () => {
    AdminAuditService.logDashboardAccess(null, '/api/admin/stats', {});
    // Line 190: if (!adminUser) return; → không gọi logger.info
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('gọi logger khi adminUser truthy', () => {
    AdminAuditService.logDashboardAccess(adminUser, '/api/admin/stats', { period: 'month' });
    expect(mockLogger.info).toHaveBeenCalledWith(
      'ADMIN_DASHBOARD_ACCESS',
      expect.objectContaining({ adminId: 99, endpoint: '/api/admin/stats' }),
    );
  });
});
