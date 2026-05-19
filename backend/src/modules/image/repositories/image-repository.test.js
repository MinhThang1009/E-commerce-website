process.env.NODE_ENV = 'test';

const mockCreate = jest.fn();
const mockFindByPk = jest.fn();
const mockFindAll = jest.fn();
const mockFindOne = jest.fn();

jest.mock('@models/image', () => ({
  create: mockCreate,
  findByPk: mockFindByPk,
  findAll: mockFindAll,
  findOne: mockFindOne,
}));

const repo = require('./sequelize-image-repository');

beforeEach(() => jest.clearAllMocks());

test('create gọi Image.create', async () => {
  mockCreate.mockResolvedValue({ id: 1 });
  await repo.create({ filePath: '/uploads/a.jpg' });
  expect(mockCreate).toHaveBeenCalled();
});

test('findById gọi Image.findByPk', async () => {
  mockFindByPk.mockResolvedValue(null);
  await repo.findById(1);
  expect(mockFindByPk).toHaveBeenCalledWith(1);
});

test('findByProduct gọi Image.findAll với entityType product', async () => {
  mockFindAll.mockResolvedValue([]);
  await repo.findByProduct(5);
  expect(mockFindAll).toHaveBeenCalledWith(
    expect.objectContaining({ where: { entityType: 'product', entityId: 5 } }),
  );
});

test('findAll gọi Image.findAll với where', async () => {
  mockFindAll.mockResolvedValue([]);
  await repo.findAll({ isActive: true });
  expect(mockFindAll).toHaveBeenCalledWith({ where: { isActive: true } });
});

test('findByFilePath gọi Image.findOne', async () => {
  mockFindOne.mockResolvedValue(null);
  await repo.findByFilePath('/uploads/a.jpg');
  expect(mockFindOne).toHaveBeenCalledWith({ where: { filePath: '/uploads/a.jpg' } });
});
