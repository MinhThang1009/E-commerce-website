/**
 * shared.mutation-kill.test.js
 *
 * Kill mutant nhóm shared (baseline 89%):
 *   - errors: AppError (status 4xx→fail), BusinessError, NotFoundError (message), ValidationError (name), index exports
 *   - event-bus: subscribe validation, publish (no-handler, handler-error log, event.type required), unsubscribe, clear
 *   - unit-of-work: runInTransaction (parent reuse / new), lockRow (require tx, LOCK.UPDATE)
 */

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockTransaction = jest.fn((cb) => cb({ id: 'TX' }));
jest.mock('@config/sequelize', () => ({ transaction: (...a) => mockTransaction(...a) }));

const AppError = require('@shared/errors/app-error');
const BusinessError = require('@shared/errors/business-error');
const NotFoundError = require('@shared/errors/not-found-error');
const ValidationError = require('@shared/errors/validation-error');
const DomainError = require('@shared/errors/domain-error');
const errorsIndex = require('@shared/errors');
const logger = require('@utils/logger');

// ══════════════════════════════════════════════════════════════════════════════
// Error classes
// ══════════════════════════════════════════════════════════════════════════════

describe('AppError', () => {
  it('4xx → status "fail", isOperational, params, statusCode', () => {
    const e = new AppError('msg', 404, { a: 1 });
    expect(e.statusCode).toBe(404);
    expect(e.status).toBe('fail');
    expect(e.isOperational).toBe(true);
    expect(e.params).toEqual({ a: 1 });
    expect(e.message).toBe('msg');
  });

  it('5xx → status "error"', () => {
    expect(new AppError('m', 500).status).toBe('error');
  });

  it('params mặc định {}', () => {
    expect(new AppError('m', 400).params).toEqual({});
  });
});

describe('BusinessError', () => {
  it('422 + name + domainCode', () => {
    const e = new BusinessError('vi phạm', 'ORDER_SHIPPED');
    expect(e.statusCode).toBe(422);
    expect(e.status).toBe('fail'); // "422".startsWith("4") = true → 'fail'
    expect(e.name).toBe('BusinessError');
    expect(e.domainCode).toBe('ORDER_SHIPPED');
  });
});

describe('NotFoundError', () => {
  it('có id → message kèm id (exact)', () => {
    const e = new NotFoundError('User', 7);
    expect(e.message).toBe('User với id "7" không tồn tại');
    expect(e.statusCode).toBe(404);
    expect(e.name).toBe('NotFoundError');
    expect(e.resource).toBe('User');
    expect(e.resourceId).toBe(7);
  });

  it('không id → message không kèm id', () => {
    expect(new NotFoundError('Order').message).toBe('Order không tồn tại');
  });
});

describe('ValidationError', () => {
  it('400 + name "ValidationError" + details', () => {
    const e = new ValidationError('sai', [{ field: 'x' }]);
    expect(e.statusCode).toBe(400);
    expect(e.name).toBe('ValidationError');
    expect(e.details).toEqual([{ field: 'x' }]);
  });
});

describe('errors index + DomainError alias', () => {
  it('DomainError === BusinessError (alias)', () => {
    expect(DomainError).toBe(BusinessError);
  });
  it('index export đủ 5 class', () => {
    expect(errorsIndex.AppError).toBe(AppError);
    expect(errorsIndex.BusinessError).toBe(BusinessError);
    expect(errorsIndex.ValidationError).toBe(ValidationError);
    expect(errorsIndex.NotFoundError).toBe(NotFoundError);
    expect(errorsIndex.DomainError).toBe(BusinessError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// event-bus
// ══════════════════════════════════════════════════════════════════════════════

describe('event-bus', () => {
  let bus;
  beforeEach(() => {
    jest.clearAllMocks();
    bus = require('@shared/event-bus');
    bus.clear();
  });

  it('subscribe handler không phải function → throw', () => {
    expect(() => bus.subscribe('e', 'notfn')).toThrow('function');
  });

  it('subscribe + publish → handler được gọi với event', async () => {
    const handler = jest.fn();
    bus.subscribe('order.created', handler);
    const event = { type: 'order.created', payload: { id: 1 } };
    await bus.publish(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('publish event KHÔNG có handler → resolve im lặng (không throw)', async () => {
    await expect(bus.publish({ type: 'no.subscriber' })).resolves.toBeUndefined();
  });

  it('publish thiếu type → throw', async () => {
    await expect(bus.publish({ payload: 1 })).rejects.toThrow('event.type');
  });

  it('handler lỗi → logger.error (kèm type) + KHÔNG chặn handler khác', async () => {
    const bad = jest.fn(() => {
      throw new Error('boom');
    });
    const good = jest.fn();
    bus.subscribe('e1', bad);
    bus.subscribe('e1', good);
    await bus.publish({ type: 'e1' });
    expect(good).toHaveBeenCalled(); // handler khác vẫn chạy (allSettled)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('e1'), expect.anything());
  });

  it('unsubscribe → handler không còn được gọi', async () => {
    const handler = jest.fn();
    const off = bus.subscribe('e2', handler);
    off();
    await bus.publish({ type: 'e2' });
    expect(handler).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// unit-of-work
// ══════════════════════════════════════════════════════════════════════════════

describe('unit-of-work', () => {
  let uow;
  beforeEach(() => {
    jest.clearAllMocks();
    uow = require('@shared/persistence/unit-of-work');
  });

  it('runInTransaction: có parent transaction → reuse, KHÔNG mở mới', async () => {
    const parent = { id: 'PARENT' };
    const work = jest.fn(async (tx) => tx.id);
    const result = await uow.runInTransaction(work, { transaction: parent });
    expect(result).toBe('PARENT');
    expect(work).toHaveBeenCalledWith(parent);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('runInTransaction: không parent → mở transaction mới', async () => {
    const work = jest.fn(async (tx) => tx.id);
    const result = await uow.runInTransaction(work);
    expect(result).toBe('TX');
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('lockRow: thiếu transaction → throw', async () => {
    await expect(uow.lockRow({}, { id: 1 }, null)).rejects.toThrow('transaction bắt buộc');
  });

  it('lockRow: gọi findOne với LOCK.UPDATE', async () => {
    const tx = { LOCK: { UPDATE: 'FOR_UPDATE' } };
    const model = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
    await uow.lockRow(model, { id: 1 }, tx);
    expect(model.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      transaction: tx,
      lock: 'FOR_UPDATE',
    });
  });
});
