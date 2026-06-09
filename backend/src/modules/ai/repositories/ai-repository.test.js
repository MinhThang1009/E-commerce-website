// Unit tests cho SequelizeAiRepository (src/modules/ai/repositories/SequelizeAiRepository.js)
// Mock toàn bộ Sequelize models — không chạm DB
const SequelizeAiRepository = require('./sequelize-ai-repository');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeModel(defaults = {}) {
  return {
    findAll: jest.fn().mockResolvedValue(defaults.findAll ?? []),
    findByPk: jest.fn().mockResolvedValue(defaults.findByPk ?? null),
    findOne: jest.fn().mockResolvedValue(defaults.findOne ?? null),
    create: jest.fn().mockResolvedValue(defaults.create ?? {}),
  };
}

function makeRepo(overrides = {}) {
  const deps = {
    Product: makeModel({
      // Default: product active, có đủ stock và variants phổ biến (id 7, 10) để stock check pass
      findByPk: {
        status: 'active',
        stockQuantity: 10,
        variants: [
          { id: 7, stockQuantity: 5 },
          { id: 10, stockQuantity: 5 },
        ],
      },
    }),
    ProductVariant: makeModel(),
    Category: makeModel(),
    sequelize: {
      fn: jest.fn(),
      col: jest.fn(),
      literal: jest.fn((s) => s),
      // transaction mock truyền object có LOCK (giống orders repository tests)
      transaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })),
    },
    ...overrides,
  };
  return { repo: new SequelizeAiRepository(deps), deps };
}

// ════════════════════════════════════════════════════════════════════════════
// findProductForCart
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeAiRepository.findProductForCart', () => {
  test('gọi Product.findByPk với productId và include variants', async () => {
    const mockProd = { id: 3, name: 'Adidas NMD' };
    const { repo, deps } = makeRepo({ Product: makeModel({ findByPk: mockProd }) });

    const result = await repo.findProductForCart(3);

    expect(deps.Product.findByPk).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ model: deps.ProductVariant, as: 'variants' }),
        ]),
      }),
    );
    expect(result).toBe(mockProd);
  });

  test('trả null khi sản phẩm không tồn tại', async () => {
    const { repo } = makeRepo({ Product: makeModel({ findByPk: null }) });

    const result = await repo.findProductForCart(9999);

    expect(result).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// addToCart
// ════════════════════════════════════════════════════════════════════════════

// Mock @models ở top-level để addToCart có thể require('@models') lazy
const mockCart = {
  findOne: jest.fn(),
  create: jest.fn(),
  findOrCreate: jest.fn(),
};
const mockCartItem = {
  findOne: jest.fn(),
  create: jest.fn().mockResolvedValue({ id: 99 }),
};

jest.mock('@models', () => ({
  Cart: mockCart,
  CartItem: mockCartItem,
}));

describe('SequelizeAiRepository.addToCart', () => {
  const defaultCart = { id: 1 };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCart.findOrCreate.mockResolvedValue([defaultCart, false]);
    mockCartItem.findOne.mockResolvedValue(null); // không có item sẵn → tạo mới
    mockCartItem.create.mockResolvedValue({ id: 99 });
  });

  test('variantId được cung cấp → KHÔNG gọi ProductVariant.findOne để tìm default (branch if(!resolvedVariantId) = false)', async () => {
    // Branch 5 "undefined" if[1]: !resolvedVariantId là false khi variantId đã có
    const mockVariantFindByPk = jest.fn().mockResolvedValue({ id: 7, price: 50000 });
    const mockVariantFindOne = jest.fn();
    const { repo } = makeRepo({
      ProductVariant: {
        findOne: mockVariantFindOne, // KHÔNG được gọi khi variantId đã có
        findByPk: mockVariantFindByPk,
      },
    });

    await repo.addToCart({ userId: 1, productId: 10, variantId: 7, quantity: 2 });

    // variantId đã có → bỏ qua lookup default variant
    expect(mockVariantFindOne).not.toHaveBeenCalled();
    // ProductVariant.findByPk được gọi với variantId được cung cấp
    expect(mockVariantFindByPk).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ attributes: ['price'] }),
    );
  });

  test('variantId=null, defaultVariant không tìm thấy → resolvedVariantId=null, variant=null, unitPrice=0 (line 105 cond-expr[1])', async () => {
    // Line 105 cond-expr[1]: resolvedVariantId là null → variant = null → unitPrice = 0
    const mockVariantFindByPk = jest.fn();
    const { repo } = makeRepo({
      ProductVariant: {
        findOne: jest.fn().mockResolvedValue(null), // defaultVariant không tồn tại
        findByPk: mockVariantFindByPk,
      },
    });

    await repo.addToCart({ userId: 1, productId: 10, variantId: null, quantity: 1 });

    // resolvedVariantId vẫn null → ProductVariant.findByPk KHÔNG được gọi (variant = null)
    expect(mockVariantFindByPk).not.toHaveBeenCalled();
    // CartItem.create được gọi với variantId=null (unitPrice=0) + transaction option
    expect(mockCartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 10, variantId: null }),
      expect.objectContaining({
        transaction: expect.objectContaining({ LOCK: { UPDATE: 'UPDATE' } }),
      }),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// addToCart — price-fetch & cart-lifecycle branches
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeAiRepository.addToCart (price-fetch & cart-lifecycle)', () => {
  const { Cart, CartItem } = require('@models');

  function makeProductVariantCart(overrides = {}) {
    return {
      findAll: jest.fn().mockResolvedValue([]),
      findByPk: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      ...overrides,
    };
  }

  const DEFAULT_PRODUCT_CART = {
    status: 'active',
    stockQuantity: 10,
    variants: [
      { id: 1, stockQuantity: 5 },
      { id: 5, stockQuantity: 5 },
      { id: 999, stockQuantity: 5 }, // cho phép test price-fetch returning null
    ],
  };

  function makeRepoCart(pvOverrides = {}, productMock = DEFAULT_PRODUCT_CART) {
    const deps = {
      Product: {
        findAll: jest.fn(),
        findByPk: jest.fn().mockResolvedValue(productMock),
        findOne: jest.fn(),
        create: jest.fn(),
      },
      ProductVariant: makeProductVariantCart(pvOverrides),
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

  test('variant tìm thấy → unitPrice = variant.price', async () => {
    const { repo, deps } = makeRepoCart({
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
    const { repo, deps } = makeRepoCart({
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
    const { repo } = makeRepoCart({
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
    const { repo } = makeRepoCart({
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
