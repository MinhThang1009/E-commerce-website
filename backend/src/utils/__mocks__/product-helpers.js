/**
 * @file __mocks__/product-helpers.js
 * @description Manual mock cho @utils/product-helpers.
 *
 * Jest tự dùng khi test gọi `jest.mock('@utils/product-helpers')` KHÔNG kèm factory.
 * Mirror export thật — toàn bộ là jest.fn() trần (test nào cần return value cụ thể
 * thì set qua mockReturnValue/mockResolvedValue trong beforeEach của chính nó).
 */
module.exports = {
  calculateTotalStock: jest.fn(),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn(),
  generateVariantSku: jest.fn(),
  hasVariants: jest.fn(),
  getVariantStock: jest.fn(),
  findVariantByAttributes: jest.fn(),
  enrichProductData: jest.fn(),
};
