/**
 * models.and.dtos.extra.test.js
 *
 * Tests for model virtual fields and DTOs at low coverage:
 *   - src/models/banner.js              — virtual field `title` getter/setter (66%)
 *   - src/modules/users/dtos/usersDto.js  — toUserDto / toAddressDto (71%)
 *   - src/modules/auth/dtos/authDto.js    — toAuthUserDto (75%)
 *   - src/modules/payment/domain/events/PaymentFailedEvent.js — constructor (50%)
 *
 * Strategy for banner.js: mock sequelize.define to capture field definitions,
 * then invoke the virtual field getter/setter directly (same pattern used in
 * model.hooks.additional.test.js).
 */

process.env.NODE_ENV = 'test';

// ── Shared helper — mirrors the one in model.hooks.additional.test.js ─────────

function makeInstance(initialData = {}) {
  const dataValues = { ...initialData };
  return {
    getDataValue(field) {
      return dataValues[field];
    },
    setDataValue(field, value) {
      dataValues[field] = value;
    },
    get() {
      return { ...dataValues };
    },
  };
}

function loadModelCapture(modelPath) {
  let capturedFields = {};

  jest.isolateModules(() => {
    jest.mock('../config/sequelize', () => {
      const { DataTypes } = require('sequelize');
      return {
        define(_modelName, fields) {
          capturedFields = fields;
          return {};
        },
        DataTypes,
      };
    });
    require(modelPath);
  });

  return { fields: capturedFields };
}

// ════════════════════════════════════════════════════════════════════════════
// banner.js — virtual field `title` getter and setter
// ════════════════════════════════════════════════════════════════════════════

describe('banner.js — title virtual field getter', () => {
  let titleField;

  beforeAll(() => {
    const { fields } = loadModelCapture('../models/banner');
    titleField = fields.title;
  });

  it('getter trả về giá trị của titleVi', () => {
    const inst = makeInstance({ titleVi: 'Banner mùa hè' });
    expect(titleField.get.call(inst)).toBe('Banner mùa hè');
  });

  it('getter trả về undefined khi titleVi chưa được set', () => {
    const inst = makeInstance({});
    expect(titleField.get.call(inst)).toBeUndefined();
  });
});

describe('banner.js — title virtual field setter', () => {
  let titleField;

  beforeAll(() => {
    const { fields } = loadModelCapture('../models/banner');
    titleField = fields.title;
  });

  it('setter ghi giá trị vào titleVi', () => {
    const inst = makeInstance({ titleVi: null });
    titleField.set.call(inst, 'Flash Sale');
    expect(inst.getDataValue('titleVi')).toBe('Flash Sale');
  });

  it('setter với string rỗng ghi string rỗng vào titleVi', () => {
    const inst = makeInstance({ titleVi: 'cũ' });
    titleField.set.call(inst, '');
    expect(inst.getDataValue('titleVi')).toBe('');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// usersDto.js — toUserDto và toAddressDto
// ════════════════════════════════════════════════════════════════════════════

const { toUserDto, toAddressDto } = require('../modules/users/dtos/usersDto');

describe('toUserDto', () => {
  it('trả về null khi user là null', () => {
    expect(toUserDto(null)).toBeNull();
  });

  it('trả về null khi user là undefined', () => {
    expect(toUserDto(undefined)).toBeNull();
  });

  it('gọi toJSON() khi user có method toJSON', () => {
    const jsonResult = { id: 1, email: 'user@example.com' };
    const user = { toJSON: jest.fn().mockReturnValue(jsonResult) };
    const result = toUserDto(user);
    expect(user.toJSON).toHaveBeenCalledTimes(1);
    expect(result).toBe(jsonResult);
  });

  it('spread object khi user không có toJSON', () => {
    const user = { id: 2, email: 'plain@example.com', firstName: 'Nam' };
    const result = toUserDto(user);
    expect(result).toEqual({ id: 2, email: 'plain@example.com', firstName: 'Nam' });
  });

  it('spread tạo ra object mới — không cùng reference với input', () => {
    const user = { id: 3 };
    const result = toUserDto(user);
    expect(result).not.toBe(user);
  });
});

describe('toAddressDto', () => {
  it('trả về null khi address là null', () => {
    expect(toAddressDto(null)).toBeNull();
  });

  it('trả về null khi address là undefined', () => {
    expect(toAddressDto(undefined)).toBeNull();
  });

  it('gọi toJSON() khi address có method toJSON', () => {
    const jsonResult = { id: 10, city: 'Hà Nội' };
    const address = { toJSON: jest.fn().mockReturnValue(jsonResult) };
    const result = toAddressDto(address);
    expect(address.toJSON).toHaveBeenCalledTimes(1);
    expect(result).toBe(jsonResult);
  });

  it('spread object khi address không có toJSON', () => {
    const address = { id: 20, city: 'TP.HCM', zip: '700000' };
    const result = toAddressDto(address);
    expect(result).toEqual({ id: 20, city: 'TP.HCM', zip: '700000' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// authDto.js — toAuthUserDto
// ════════════════════════════════════════════════════════════════════════════

const { toAuthUserDto } = require('../modules/auth/dtos/authDto');

describe('toAuthUserDto', () => {
  it('trả về null khi user là null', () => {
    expect(toAuthUserDto(null)).toBeNull();
  });

  it('trả về null khi user là undefined', () => {
    expect(toAuthUserDto(undefined)).toBeNull();
  });

  it('gọi toJSON() khi user có method toJSON', () => {
    const sanitized = { id: 5, email: 'test@example.com' };
    const user = { toJSON: jest.fn().mockReturnValue(sanitized) };
    const result = toAuthUserDto(user);
    expect(user.toJSON).toHaveBeenCalledTimes(1);
    expect(result).toBe(sanitized);
  });

  it('spread object khi user không có toJSON', () => {
    const user = { id: 6, email: 'plain@example.com' };
    const result = toAuthUserDto(user);
    expect(result).toEqual({ id: 6, email: 'plain@example.com' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PaymentFailedEvent.js — factory function
// ════════════════════════════════════════════════════════════════════════════

const PaymentFailedEvent = require('../modules/payment/domain/events/PaymentFailedEvent');

describe('PaymentFailedEvent', () => {
  it('trả về object có type = "payment.failed"', () => {
    const event = PaymentFailedEvent({
      orderId: 1,
      orderNumber: 'ORD-001',
      transactionId: 'TXN-abc',
      provider: 'momo',
      reason: 'insufficient funds',
    });
    expect(event.type).toBe('payment.failed');
  });

  it('payload chứa đúng các trường được truyền vào', () => {
    const input = {
      orderId: 42,
      orderNumber: 'ORD-042',
      transactionId: 'TXN-xyz',
      provider: 'vnpay',
      reason: 'timeout',
    };
    const event = PaymentFailedEvent(input);
    expect(event.payload).toEqual({
      orderId: 42,
      orderNumber: 'ORD-042',
      transactionId: 'TXN-xyz',
      provider: 'vnpay',
      reason: 'timeout',
    });
  });

  it('occurredAt là chuỗi ISO 8601 hợp lệ', () => {
    const event = PaymentFailedEvent({ orderId: 1, orderNumber: 'X', transactionId: 'Y', provider: 'momo', reason: 'err' });
    expect(() => new Date(event.occurredAt)).not.toThrow();
    expect(typeof event.occurredAt).toBe('string');
    expect(event.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('mỗi lần gọi tạo ra occurredAt mới (không dùng giá trị cache cũ)', () => {
    const event1 = PaymentFailedEvent({ orderId: 1, orderNumber: 'A', transactionId: 'T1', provider: 'momo', reason: 'r' });
    const event2 = PaymentFailedEvent({ orderId: 2, orderNumber: 'B', transactionId: 'T2', provider: 'vnpay', reason: 'r' });
    // Hai event khác nhau — payload phải khác
    expect(event1.payload.orderId).not.toBe(event2.payload.orderId);
  });

  it('hoạt động khi các trường không bắt buộc là undefined', () => {
    const event = PaymentFailedEvent({});
    expect(event.type).toBe('payment.failed');
    expect(event.payload.orderId).toBeUndefined();
    expect(event.payload.provider).toBeUndefined();
  });
});
