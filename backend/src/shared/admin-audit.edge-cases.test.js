/**
 * Additional unit tests cho AdminAuditService + auditMiddleware
 * (src/services/adminAudit.js)
 *
 * Existing test file: src/services/adminAudit.test.js đã cover:
 *   - logUserAction (happy + undefined admin)
 *   - logProductAction (changes rỗng vs có data)
 *   - logOrderAction (happy path)
 *   - logDiscountCodeAction (changes.new fallback)
 *   - logFailedAuth
 *   - logDashboardAccess (happy + undefined admin)
 *   - logSuccessfulLogin
 *   - writeToDb error handling
 *
 * File này phủ các nhánh còn thiếu:
 *   - logUserAction: không có changes (default {}), ip null
 *   - logProductAction: adminUser undefined, changes + productName null cùng lúc
 *   - logOrderAction: adminUser undefined, changes rỗng → newValue = null
 *   - logDiscountCodeAction: adminUser undefined, changes.old + changes.new tường minh
 *   - logReviewAction: happy + adminUser undefined
 *   - logSuccessfulLogin: ip undefined
 *   - auditMiddleware: inject IP + restore sau finish
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

const adminUser = { id: 7, email: 'admin@shop.vn' };

beforeEach(() => {
  jest.clearAllMocks();
  mockAuditLogCreate.mockResolvedValue({ id: 1 });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminAuditService.logUserAction — bổ sung', () => {
  it('changes mặc định {} → oldValue null, newValue null trong DB', async () => {
    AdminAuditService.logUserAction(adminUser, 'VIEW_USER', 10, {}, '1.2.3.4');

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ oldValue: null, newValue: null }),
    );
  });

  it('ip = null → ip được lưu là null', async () => {
    AdminAuditService.logUserAction(adminUser, 'UNLOCK_USER', 10, {}, null);

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ ip: null }));
  });

  it('chứa timestamp trong logger.info', () => {
    AdminAuditService.logUserAction(adminUser, 'BAN_USER', 5, {});

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ADMIN_USER_ACTION',
      expect.objectContaining({ timestamp: expect.any(String) }),
    );
  });

  it('adminEmail được truyền vào logger', () => {
    AdminAuditService.logUserAction(adminUser, 'BAN_USER', 5, {});

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ADMIN_USER_ACTION',
      expect.objectContaining({ adminEmail: 'admin@shop.vn' }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminAuditService.logProductAction — bổ sung', () => {
  it('adminUser undefined → log error và KHÔNG gọi writeToDb', () => {
    AdminAuditService.logProductAction(undefined, 'CREATE', 1, 'Laptop');

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('adminUser is undefined'),
    );
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it('changes rỗng + productName null → newValue = null trong DB', async () => {
    AdminAuditService.logProductAction(adminUser, 'DELETE', 1, null, {});

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ newValue: null }));
  });

  it('ghi entityType "product" vào DB', async () => {
    AdminAuditService.logProductAction(adminUser, 'UPDATE', 5, 'Phone', { stock: 10 });

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'product' }),
    );
  });

  it('oldValue luôn là null (không lưu old state)', async () => {
    AdminAuditService.logProductAction(adminUser, 'UPDATE', 5, 'Phone', { newData: true });

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ oldValue: null }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminAuditService.logOrderAction — bổ sung', () => {
  it('adminUser undefined → log error, KHÔNG gọi DB', () => {
    AdminAuditService.logOrderAction(undefined, 'CANCEL', 10, 'ORD-001');

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('adminUser is undefined'),
    );
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it('changes rỗng → newValue = null trong DB', async () => {
    AdminAuditService.logOrderAction(adminUser, 'STATUS_CHANGE', 20, 'ORD-002', {});

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ newValue: null }));
  });

  it('entityId khớp với orderId được truyền vào', async () => {
    AdminAuditService.logOrderAction(adminUser, 'REFUND', 99, 'ORD-099', { amount: 500 });

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ entityId: 99 }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminAuditService.logDiscountCodeAction — bổ sung', () => {
  it('adminUser undefined → log error, KHÔNG gọi DB', () => {
    AdminAuditService.logDiscountCodeAction(undefined, 'DELETE', 1, 'SAVE10');

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('adminUser is undefined'),
    );
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it('changes.old tường minh → oldValue được lưu đúng', async () => {
    AdminAuditService.logDiscountCodeAction(adminUser, 'UPDATE', 5, 'DEAL20', {
      old: { discountValue: 10 },
      new: { discountValue: 20 },
    });

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValue: JSON.stringify({ discountValue: 10 }),
        newValue: JSON.stringify({ discountValue: 20 }),
      }),
    );
  });

  it('changes.new tường minh → ưu tiên hơn fallback { code }', async () => {
    AdminAuditService.logDiscountCodeAction(adminUser, 'UPDATE', 5, 'DEAL20', {
      new: { discountValue: 30 },
    });

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: JSON.stringify({ discountValue: 30 }),
      }),
    );
  });

  it('code null + changes rỗng → newValue = null', async () => {
    AdminAuditService.logDiscountCodeAction(adminUser, 'DELETE', 5, null, {});

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ newValue: null }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminAuditService.logReviewAction', () => {
  it('happy path → ghi đúng entityType "review" + newValue { userId, productId }', async () => {
    AdminAuditService.logReviewAction(adminUser, 'DELETE_REVIEW', 33, 100, 200, '10.0.0.1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ADMIN_REVIEW_ACTION',
      expect.objectContaining({
        action: 'DELETE_REVIEW',
        entityType: 'review',
        entityId: 33,
      }),
    );

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: JSON.stringify({ userId: 100, productId: 200 }),
        entityType: 'review',
        entityId: 33,
      }),
    );
  });

  it('adminUser undefined → log error, KHÔNG gọi DB', () => {
    AdminAuditService.logReviewAction(undefined, 'DELETE_REVIEW', 1, 1, 1);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('adminUser is undefined'),
    );
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it('oldValue luôn null', async () => {
    AdminAuditService.logReviewAction(adminUser, 'APPROVE_REVIEW', 44, 50, 60, null);

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ oldValue: null }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminAuditService.logSuccessfulLogin — bổ sung', () => {
  it('entityId là null (không có entity cụ thể)', async () => {
    AdminAuditService.logSuccessfulLogin(adminUser, '192.168.1.1');

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ entityId: null }));
  });

  it('ip undefined → lưu null vào DB (??-chaining với undefined)', async () => {
    AdminAuditService.logSuccessfulLogin(adminUser, undefined);

    await new Promise((r) => setImmediate(r));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ ip: null }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('auditMiddleware', () => {
  // auditMiddleware dùng AsyncLocalStorage — không còn mutate static methods
  function makeReq(ip = '203.0.113.10') {
    return { ip, connection: { remoteAddress: ip } };
  }

  it('gọi next() để tiếp tục pipeline', () => {
    const next = jest.fn();
    auditMiddleware(makeReq(), {}, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('KHÔNG mutate static methods của AdminAuditService', () => {
    const originalLogUserAction = AdminAuditService.logUserAction;
    const next = jest.fn();

    auditMiddleware(makeReq('5.5.5.5'), {}, next);

    // Dùng AsyncLocalStorage — methods giữ nguyên
    expect(AdminAuditService.logUserAction).toBe(originalLogUserAction);
  });

  it('IP được inject vào DB khi logProductAction gọi trong async context của middleware', async () => {
    const capturedIp = '10.20.30.40';
    let resolveNext;
    const nextPromise = new Promise((r) => {
      resolveNext = r;
    });

    const next = () => {
      // Gọi log trong cùng async context của requestContext.run
      AdminAuditService.logProductAction(adminUser, 'CREATE', 1, 'Product A');
      resolveNext();
    };

    auditMiddleware(makeReq(capturedIp), {}, next);
    await nextPromise;
    await new Promise((r) => setImmediate(r));

    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ ip: capturedIp }));
  });

  it('không có res.on("finish") — cleanup tự động qua AsyncLocalStorage', () => {
    const res = { on: jest.fn() };
    const next = jest.fn();

    auditMiddleware(makeReq(), res, next);

    expect(res.on).not.toHaveBeenCalled();
  });
});
