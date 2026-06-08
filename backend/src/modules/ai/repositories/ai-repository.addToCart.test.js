// Test riêng cho SequelizeAiRepository.addToCart
// Dùng module-level jest.mock để intercept dynamic require('@models') trong addToCart.

jest.mock('@models', () => ({
  Cart: {
    findOne: jest.fn(),
    create: jest.fn(),
    findOrCreate: jest.fn(),
  },
  CartItem: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

const SequelizeAiRepository = require('./sequelize-ai-repository');
const { Cart, CartItem } = require('@models');

function makeProductVariant(overrides = {}) {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    findByPk: jest.fn(),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

// Product mặc định: active, có stock, và có các variant id phổ biến dùng trong tests
const DEFAULT_PRODUCT = {
  status: 'active',
  stockQuantity: 10,
  variants: [
    { id: 1, stockQuantity: 5 },
    { id: 5, stockQuantity: 5 },
    { id: 999, stockQuantity: 5 }, // cho phép test price-fetch returning null
  ],
};

function makeRepo(pvOverrides = {}, productMock = DEFAULT_PRODUCT) {
  const deps = {
    Product: {
      findAll: jest.fn(),
      findByPk: jest.fn().mockResolvedValue(productMock),
      findOne: jest.fn(),
      create: jest.fn(),
    },
    ProductVariant: makeProductVariant(pvOverrides),
    Category: { findAll: jest.fn(), findByPk: jest.fn() },
    sequelize: {
      fn: jest.fn(),
      col: jest.fn(),
      literal: jest.fn((s) => s),
      // transaction mock truyền đúng object có LOCK (giống orders tests)
      transaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })),
    },
  };
  return { repo: new SequelizeAiRepository(deps), deps };
}

beforeEach(() => {
  jest.clearAllMocks();
  // findOrCreate returns [cart, created] — mặc định trả cart sẵn (created=false)
  Cart.findOrCreate.mockResolvedValue([{ id: 'cart1' }, false]);
  CartItem.findOne.mockResolvedValue(null);
  CartItem.create.mockResolvedValue({ id: 'item1' });
});

describe('SequelizeAiRepository.addToCart', () => {
  test('variant tìm thấy → unitPrice = variant.price', async () => {
    const { repo, deps } = makeRepo({
      findByPk: jest.fn().mockResolvedValue({ price: '299000' }),
    });

    await repo.addToCart({ userId: 1, productId: 10, variantId: 5, quantity: 2 });

    expect(deps.ProductVariant.findByPk).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ attributes: ['price'] }),
    );
    expect(CartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ unitPrice: '299000', quantity: 2 }),
      expect.objectContaining({
        transaction: expect.objectContaining({ LOCK: { UPDATE: 'UPDATE' } }),
      }),
    );
  });

  test('variant không tìm thấy → unitPrice = 0 (line 156 falsy branch)', async () => {
    const { repo, deps } = makeRepo({
      findByPk: jest.fn().mockResolvedValue(null),
    });

    await repo.addToCart({ userId: 1, productId: 10, variantId: 999, quantity: 1 });

    expect(deps.ProductVariant.findByPk).toHaveBeenCalledWith(
      999,
      expect.objectContaining({ attributes: ['price'] }),
    );
    expect(CartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ unitPrice: 0 }),
      expect.objectContaining({
        transaction: expect.objectContaining({ LOCK: { UPDATE: 'UPDATE' } }),
      }),
    );
  });

  test('chưa có cart → findOrCreate tạo cart mới (atomic)', async () => {
    Cart.findOrCreate.mockResolvedValue([{ id: 'new-cart' }, true]); // created=true
    const { repo } = makeRepo({
      findByPk: jest.fn().mockResolvedValue({ price: '100000' }),
    });

    await repo.addToCart({ userId: 2, productId: 5, variantId: 1, quantity: 1 });

    expect(Cart.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 2, status: 'active' } }),
    );
    expect(CartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ cartId: 'new-cart' }),
      expect.objectContaining({
        transaction: expect.objectContaining({ LOCK: { UPDATE: 'UPDATE' } }),
      }),
    );
  });

  test('đã có item cùng product+variant → cập nhật quantity thay vì tạo mới (line 114)', async () => {
    const existingItem = {
      id: 'existing-item',
      quantity: 3,
      update: jest.fn().mockResolvedValue({ id: 'existing-item', quantity: 5 }),
    };
    CartItem.findOne.mockResolvedValue(existingItem);
    const { repo } = makeRepo({
      findByPk: jest.fn().mockResolvedValue({ price: '200000' }),
    });

    const result = await repo.addToCart({ userId: 1, productId: 10, variantId: 5, quantity: 2 });

    // Phải gọi update thay vì create
    expect(existingItem.update).toHaveBeenCalledWith(
      { quantity: 5 },
      expect.objectContaining({
        transaction: expect.objectContaining({ LOCK: { UPDATE: 'UPDATE' } }),
      }),
    ); // 3 + 2 = 5
    expect(CartItem.create).not.toHaveBeenCalled();
    expect(result.quantity).toBe(5);
  });
});
