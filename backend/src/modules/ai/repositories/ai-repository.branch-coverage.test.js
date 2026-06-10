jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_r, _s, n) => n(),
  apiLimiter: (_r, _s, n) => n(),
  authLimiter: (_r, _s, n) => n(),
  otpLimiter: (_r, _s, n) => n(),
}));

const AIRepo = require('./sequelize-ai-repository');
const models = require('@models');

describe('SequelizeAIRepository — branch coverage', () => {
  let repo;

  beforeEach(() => {
    repo = new AIRepo({
      Product: { findByPk: jest.fn() },
      ProductVariant: { findByPk: jest.fn(), findOne: jest.fn() },
      Category: {},
      sequelize: { transaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'FOR UPDATE' } })) },
    });
  });

  afterEach(() => jest.restoreAllMocks());

  test('createAnalyticsEvent: userId truthy', async () => {
    jest.spyOn(models.ChatMessage, 'create').mockResolvedValue({ id: 1 });
    await repo.createAnalyticsEvent({ event: 'view', userId: 42, sessionId: 's1', productId: 1 });
    expect(models.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 42 }));
  });

  test('createAnalyticsEvent: userId falsy → null', async () => {
    jest.spyOn(models.ChatMessage, 'create').mockResolvedValue({ id: 1 });
    await repo.createAnalyticsEvent({ event: 'view', userId: null, sessionId: 's1', productId: 1 });
    expect(models.ChatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null }),
    );
  });

  test('addToCart: variants exist but totalStock=0 → throw productOutOfStock', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: [{ id: 10, stockQuantity: 0 }],
    });
    await expect(repo.addToCart({ userId: 1, productId: 1, quantity: 1 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('addToCart: default variant resolved, stock=0 → throw', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: [
        { id: 10, stockQuantity: 5 },
        { id: 20, stockQuantity: 0 },
      ],
    });
    repo.ProductVariant.findOne.mockResolvedValue({ id: 20, price: 100 });
    await expect(repo.addToCart({ userId: 1, productId: 1, quantity: 1 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('addToCart: explicit variantId not found → throw', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: [{ id: 10, stockQuantity: 5 }],
    });
    await expect(
      repo.addToCart({ userId: 1, productId: 1, variantId: 99, quantity: 1 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('addToCart: explicit variantId stock=0 → throw', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: [
        { id: 10, stockQuantity: 0 },
        { id: 20, stockQuantity: 5 },
      ],
    });
    await expect(
      repo.addToCart({ userId: 1, productId: 1, variantId: 10, quantity: 1 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('addToCart: product.variants null + variantId → || [] fallback', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: null,
    });
    await expect(
      repo.addToCart({ userId: 1, productId: 1, variantId: 99, quantity: 1 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('addToCart: product.variants null → resolve fallback', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: null,
    });
    repo.ProductVariant.findOne.mockResolvedValue({ id: 10, price: 100 });
    await expect(repo.addToCart({ userId: 1, productId: 1, quantity: 1 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('addToCart: existing item + variant stock exceeded → throw', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: [{ id: 10, stockQuantity: 3 }],
    });
    repo.ProductVariant.findOne.mockResolvedValue({ id: 10, price: 100 });
    repo.ProductVariant.findByPk.mockResolvedValue({ price: 100 });
    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    jest.spyOn(models.CartItem, 'findOne').mockResolvedValue({ quantity: 2, update: jest.fn() });
    await expect(repo.addToCart({ userId: 1, productId: 1, quantity: 2 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('addToCart: no variant + existing item + product stock exceeded → throw', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 3,
      variants: [],
    });
    repo.ProductVariant.findOne.mockResolvedValue(null);
    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    jest.spyOn(models.CartItem, 'findOne').mockResolvedValue({ quantity: 2, update: jest.fn() });
    await expect(repo.addToCart({ userId: 1, productId: 1, quantity: 2 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('addToCart: existing item + stock OK → update quantity', async () => {
    const updateFn = jest.fn().mockResolvedValue({ quantity: 3 });
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: [{ id: 10, stockQuantity: 10 }],
    });
    repo.ProductVariant.findOne.mockResolvedValue({ id: 10, price: 100 });
    repo.ProductVariant.findByPk.mockResolvedValue({ price: 100 });
    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    jest.spyOn(models.CartItem, 'findOne').mockResolvedValue({ quantity: 2, update: updateFn });
    await repo.addToCart({ userId: 1, productId: 1, quantity: 1 });
    expect(updateFn).toHaveBeenCalledWith({ quantity: 3 }, expect.any(Object));
  });

  // Verifies [M1]: item MỚI cũng phải bị chặn khi quantity vượt stock (trước fix chỉ check stock > 0)
  test('addToCart: item mới + quantity vượt variant stock → throw cartQuantityExceedsStock', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: [{ id: 10, stockQuantity: 2 }],
    });
    repo.ProductVariant.findOne.mockResolvedValue({ id: 10, price: 100 });
    repo.ProductVariant.findByPk.mockResolvedValue({ price: 100 });
    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    jest.spyOn(models.CartItem, 'findOne').mockResolvedValue(null); // chưa có item → nhánh create
    const createSpy = jest.spyOn(models.CartItem, 'create').mockResolvedValue({ id: 1 });
    await expect(repo.addToCart({ userId: 1, productId: 1, quantity: 50 })).rejects.toMatchObject({
      statusCode: 400,
      message: 'ai.cartQuantityExceedsStock',
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  // Verifies [M1]: SP không variant — item mới quantity vượt product.stockQuantity → throw
  test('addToCart: item mới không variant + quantity vượt product stock → throw', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 3,
      variants: [],
    });
    repo.ProductVariant.findOne.mockResolvedValue(null);
    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    jest.spyOn(models.CartItem, 'findOne').mockResolvedValue(null);
    jest.spyOn(models.CartItem, 'create').mockResolvedValue({ id: 1 });
    await expect(repo.addToCart({ userId: 1, productId: 1, quantity: 5 })).rejects.toMatchObject({
      statusCode: 400,
      message: 'ai.cartQuantityExceedsStock',
    });
  });

  test('addToCart: no existing item → CartItem.create', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: [],
    });
    repo.ProductVariant.findOne.mockResolvedValue(null);
    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    jest.spyOn(models.CartItem, 'findOne').mockResolvedValue(null);
    jest.spyOn(models.CartItem, 'create').mockResolvedValue({ id: 1 });
    await repo.addToCart({ userId: 1, productId: 1, quantity: 1 });
    expect(models.CartItem.create).toHaveBeenCalled();
  });

  // Verifies [M8]: body không gửi variantId (undefined) → phải normalize thành null trước khi
  // đưa vào where — Sequelize 6 throw "invalid undefined value" nếu where chứa undefined
  test('addToCart: variantId undefined → where dùng null, không phải undefined', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: [],
    });
    repo.ProductVariant.findOne.mockResolvedValue(null);
    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    const findOneSpy = jest.spyOn(models.CartItem, 'findOne').mockResolvedValue(null);
    const createSpy = jest.spyOn(models.CartItem, 'create').mockResolvedValue({ id: 1 });
    await repo.addToCart({ userId: 1, productId: 1, quantity: 1 }); // variantId KHÔNG truyền
    expect(findOneSpy.mock.calls[0][0].where.variantId).toBeNull();
    expect(createSpy.mock.calls[0][0].variantId).toBeNull();
  });

  // Verifies [M11]: variant.price null (schema cho phép) → unitPrice fallback basePrice
  test('addToCart: variant.price null → unitPrice fallback basePrice', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      basePrice: 5000000,
      variants: [{ id: 10, stockQuantity: 5 }],
    });
    repo.ProductVariant.findOne.mockResolvedValue({ id: 10, price: null });
    repo.ProductVariant.findByPk.mockResolvedValue({ price: null });
    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    jest.spyOn(models.CartItem, 'findOne').mockResolvedValue(null);
    const createSpy = jest.spyOn(models.CartItem, 'create').mockResolvedValue({ id: 1 });
    await repo.addToCart({ userId: 1, productId: 1, variantId: 10, quantity: 1 });
    expect(createSpy.mock.calls[0][0].unitPrice).toBe(5000000);
  });

  test('addToCart: existing item + product.variants null → || [] fallback', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: null,
    });
    repo.ProductVariant.findOne.mockResolvedValue(null);
    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    jest
      .spyOn(models.CartItem, 'findOne')
      .mockResolvedValue({ quantity: 2, update: jest.fn().mockResolvedValue() });
    await repo.addToCart({ userId: 1, productId: 1, quantity: 1 });
    expect(models.CartItem.findOne).toHaveBeenCalled();
  });
});
