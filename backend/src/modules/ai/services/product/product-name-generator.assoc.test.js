/**
 * product-name-generator.assoc.test.js
 *
 * Kill mutant trong khối định nghĩa association (chạy KHI association chưa tồn tại).
 * Test cũ mock associations đã set sẵn → khối này không chạy. File này mock rỗng
 * để buộc service gọi belongsTo/hasMany, rồi assert đúng foreignKey/as.
 * Dùng jest.isolateModules để load fresh (singleton bị cache → khối không chạy lại).
 */

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockBelongsTo = jest.fn();
const mockHasMany = jest.fn();

jest.mock('@models', () => ({
  AttributeValue: {
    associations: {}, // CHƯA có association → service sẽ gọi belongsTo
    findAll: jest.fn(),
    belongsTo: (...args) => mockBelongsTo(...args),
  },
  AttributeGroup: {
    associations: {}, // CHƯA có association → service sẽ gọi hasMany
    hasMany: (...args) => mockHasMany(...args),
  },
}));

describe('association setup khi chưa tồn tại', () => {
  it('belongsTo + hasMany được gọi với foreignKey/as đúng', () => {
    const { AttributeValue, AttributeGroup } = require('@models');
    jest.isolateModules(() => {
      require('@modules/ai/services/product/product-name-generator');
    });

    expect(mockBelongsTo).toHaveBeenCalledWith(AttributeGroup, {
      foreignKey: 'attributeGroupId',
      as: 'attributeGroup',
    });
    expect(mockHasMany).toHaveBeenCalledWith(AttributeValue, {
      foreignKey: 'attributeGroupId',
      as: 'values',
    });
  });
});
