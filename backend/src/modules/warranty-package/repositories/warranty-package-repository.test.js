process.env.NODE_ENV = 'test';

const mockFindAndCountAll = jest.fn();
const mockFindByPk = jest.fn();
const mockFindAll = jest.fn();
const mockFindOne = jest.fn();
const mockCreate = jest.fn();

jest.mock('@models', () => ({
  WarrantyPackage: {
    findAndCountAll: mockFindAndCountAll,
    findByPk: mockFindByPk,
    create: mockCreate,
  },
  ProductWarranty: { findAll: mockFindAll, findOne: mockFindOne },
  Product: { findByPk: mockFindByPk },
}));

const repo = require('./sequelize-warranty-package-repository');

beforeEach(() => jest.clearAllMocks());

test('findAll gọi WarrantyPackage.findAndCountAll', async () => {
  mockFindAndCountAll.mockResolvedValue({ count: 0, rows: [] });
  await repo.findAll({ where: {}, offset: 0, limit: 10 });
  expect(mockFindAndCountAll).toHaveBeenCalled();
});

test('findById gọi WarrantyPackage.findByPk', async () => {
  mockFindByPk.mockResolvedValue(null);
  await repo.findById(1);
  expect(mockFindByPk).toHaveBeenCalledWith(1);
});

test('findByProduct gọi ProductWarranty.findAll', async () => {
  mockFindAll.mockResolvedValue([]);
  await repo.findByProduct(1);
  expect(mockFindAll).toHaveBeenCalled();
});

test('productExists gọi Product.findByPk', async () => {
  mockFindByPk.mockResolvedValue({ id: 1 });
  await repo.productExists(1);
  expect(mockFindByPk).toHaveBeenCalledWith(1);
});

test('isUsedByProduct gọi ProductWarranty.findOne', async () => {
  mockFindOne.mockResolvedValue(null);
  await repo.isUsedByProduct(1);
  expect(mockFindOne).toHaveBeenCalled();
});

test('create gọi WarrantyPackage.create', async () => {
  mockCreate.mockResolvedValue({ id: 1 });
  await repo.create({ name: 'Gói 1 năm' });
  expect(mockCreate).toHaveBeenCalled();
});
