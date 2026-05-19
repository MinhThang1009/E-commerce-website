process.env.NODE_ENV = 'test';

const mockFindAll = jest.fn();
const mockFindByPk = jest.fn();
const mockCreate = jest.fn();

jest.mock('@models', () => ({
  AttributeGroup: { findAll: mockFindAll, findByPk: mockFindByPk, create: mockCreate },
  AttributeValue: { findByPk: mockFindByPk, create: mockCreate },
  ProductAttributeGroup: { create: mockCreate },
  Product: { findByPk: mockFindByPk },
  ProductVariant: { findAll: mockFindAll },
}));

const repo = require('./sequelize-attribute-repository');

beforeEach(() => jest.clearAllMocks());

test('findAllGroups gọi AttributeGroup.findAll', async () => {
  mockFindAll.mockResolvedValue([]);
  await repo.findAllGroups();
  expect(mockFindAll).toHaveBeenCalled();
});

test('findProductWithGroups gọi Product.findByPk', async () => {
  mockFindByPk.mockResolvedValue(null);
  await repo.findProductWithGroups(1);
  expect(mockFindByPk).toHaveBeenCalledWith(1, expect.any(Object));
});

test('createGroup gọi AttributeGroup.create', async () => {
  mockCreate.mockResolvedValue({ id: 1 });
  await repo.createGroup({ name: 'Màu sắc' });
  expect(mockCreate).toHaveBeenCalled();
});

test('findGroupById gọi AttributeGroup.findByPk', async () => {
  mockFindByPk.mockResolvedValue({ id: 1 });
  await repo.findGroupById(1);
  expect(mockFindByPk).toHaveBeenCalledWith(1);
});

test('createValue gọi AttributeValue.create', async () => {
  mockCreate.mockResolvedValue({ id: 1 });
  await repo.createValue({ name: 'Đỏ' });
  expect(mockCreate).toHaveBeenCalled();
});

test('findValueById gọi AttributeValue.findByPk', async () => {
  mockFindByPk.mockResolvedValue(null);
  await repo.findValueById(1);
  expect(mockFindByPk).toHaveBeenCalledWith(1);
});

test('createProductGroupAssignment gọi ProductAttributeGroup.create', async () => {
  mockCreate.mockResolvedValue({ id: 1 });
  await repo.createProductGroupAssignment({ productId: 1, groupId: 2 });
  expect(mockCreate).toHaveBeenCalled();
});

test('findRecentVariants gọi ProductVariant.findAll', async () => {
  mockFindAll.mockResolvedValue([]);
  await repo.findRecentVariants(1);
  expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ where: { productId: 1 } }));
});
