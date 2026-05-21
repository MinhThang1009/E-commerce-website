// Test riêng cho SequelizeAiRepository.addToCart
// Dùng module-level jest.mock để intercept dynamic require('@models') trong addToCart.

jest.mock('@models', () => ({
  Cart: {
    findOne: jest.fn(),
    create: jest.fn(),
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

function makeRepo(pvOverrides = {}) {
  const deps = {
    Product: { findAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() },
    ProductVariant: makeProductVariant(pvOverrides),
    Category: { findAll: jest.fn(), findByPk: jest.fn() },
    sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn((s) => s) },
  };
  return { repo: new SequelizeAiRepository(deps), deps };
}

beforeEach(() => {
  jest.clearAllMocks();
  Cart.findOne.mockResolvedValue({ id: 'cart1' });
  Cart.create.mockResolvedValue({ id: 'new-cart' });
  CartItem.findOne.mockResolvedValue(null);
  CartItem.create.mockResolvedValue({ id: 'item1' });
});

describe('SequelizeAiRepository.addToCart', () => {
  test('variant tìm thấy → unitPrice = variant.price', async () => {
    const { repo, deps } = makeRepo({
      findByPk: jest.fn().mockResolvedValue({ price: '299000' }),
    });

    await repo.addToCart({ userId: 1, productId: 10, variantId: 5, quantity: 2 });

    expect(deps.ProductVariant.findByPk).toHaveBeenCalledWith(5, { attributes: ['price'] });
    expect(CartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ unitPrice: '299000', quantity: 2 }),
    );
  });

  test('variant không tìm thấy → unitPrice = 0 (line 156 falsy branch)', async () => {
    const { repo, deps } = makeRepo({
      findByPk: jest.fn().mockResolvedValue(null),
    });

    await repo.addToCart({ userId: 1, productId: 10, variantId: 999, quantity: 1 });

    expect(deps.ProductVariant.findByPk).toHaveBeenCalledWith(999, { attributes: ['price'] });
    expect(CartItem.create).toHaveBeenCalledWith(expect.objectContaining({ unitPrice: 0 }));
  });

  test('chưa có cart → Cart.create được gọi', async () => {
    Cart.findOne.mockResolvedValue(null);
    const { repo } = makeRepo({
      findByPk: jest.fn().mockResolvedValue({ price: '100000' }),
    });

    await repo.addToCart({ userId: 2, productId: 5, variantId: 1, quantity: 1 });

    expect(Cart.create).toHaveBeenCalledWith({ userId: 2, status: 'active' });
    expect(CartItem.create).toHaveBeenCalledWith(expect.objectContaining({ cartId: 'new-cart' }));
  });
});
