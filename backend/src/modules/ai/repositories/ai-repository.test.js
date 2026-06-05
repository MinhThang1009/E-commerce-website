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
    Product: makeModel(),
    ProductVariant: makeModel(),
    Category: makeModel(),
    sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn((s) => s) },
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
    mockCart.findOne.mockResolvedValue(defaultCart);
    mockCart.create.mockResolvedValue(defaultCart);
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
    // CartItem.create được gọi với variantId=null (unitPrice=0)
    expect(mockCartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 10, variantId: null }),
    );
  });
});
