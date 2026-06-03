/**
 * @file __mocks__/vector-store.js
 * @description Manual mock cho @services/vector-store/vector-store (singleton instance).
 *
 * Jest tự dùng khi test gọi `jest.mock('@services/vector-store/vector-store')` KHÔNG
 * kèm factory. Mirror public method của instance thật (load/save/clear/upsertProduct/
 * hybridSearch/cosineSimilarity). async → mockResolvedValue để Product hooks
 * (afterCreate/Update gọi upsertProduct) + chatbot không vỡ.
 */
module.exports = {
  load: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn(),
  upsertProduct: jest.fn().mockResolvedValue(undefined),
  hybridSearch: jest.fn().mockResolvedValue([]),
  cosineSimilarity: jest.fn().mockReturnValue(0),
  items: [],
};
