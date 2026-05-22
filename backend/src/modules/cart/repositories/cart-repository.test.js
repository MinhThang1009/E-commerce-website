// Unit tests cho SequelizeCartRepository.
// Mock toàn bộ Sequelize models + sequelize instance — không chạm DB.

const SequelizeCartRepository = require('./sequelize-cart-repository');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeModel(defaults = {}) {
  return {
    findAll: jest.fn().mockResolvedValue(defaults.findAll ?? []),
    findOne: jest.fn().mockResolvedValue(defaults.findOne ?? null),
    findByPk: jest.fn().mockResolvedValue(defaults.findByPk ?? null),
    findAndCountAll: jest
      .fn()
      .mockResolvedValue(defaults.findAndCountAll ?? { count: 0, rows: [] }),
    findOrCreate: jest.fn().mockResolvedValue([defaults.findOrCreate ?? {}, false]),
    create: jest.fn().mockResolvedValue(defaults.create ?? {}),
    destroy: jest.fn().mockResolvedValue(defaults.destroy ?? 0),
    sum: jest.fn().mockResolvedValue(defaults.sum ?? 0),
  };
}

function makeSequelize() {
  return {
    transaction: jest.fn(async (work) => work('txn')),
  };
}

function makeRepo(overrides = {}, seqOverride = null) {
  const sequelize = seqOverride ?? makeSequelize();
  const deps = {
    Cart: makeModel(),
    CartItem: makeModel(),
    Product: makeModel(),
    ProductVariant: makeModel(),
    WarrantyPackage: makeModel(),
    sequelize,
    ...overrides,
  };
  return { repo: new SequelizeCartRepository(deps), deps, sequelize };
}

// ─── Constructor validation ────────────────────────────────────────────────────

describe('SequelizeCartRepository — constructor validation', () => {
  const models = () => ({
    Cart: makeModel(),
    CartItem: makeModel(),
    Product: makeModel(),
    ProductVariant: makeModel(),
    WarrantyPackage: makeModel(),
    sequelize: makeSequelize(),
  });

  it('throw khi Cart model bị thiếu', () => {
    const { Cart: _c, ...rest } = models();
    expect(() => new SequelizeCartRepository(rest)).toThrow('Cart model bắt buộc');
  });

  it('throw khi CartItem model bị thiếu', () => {
    const { CartItem: _ci, ...rest } = models();
    expect(() => new SequelizeCartRepository(rest)).toThrow('CartItem model bắt buộc');
  });

  it('throw khi Product model bị thiếu', () => {
    const { Product: _p, ...rest } = models();
    expect(() => new SequelizeCartRepository(rest)).toThrow('Product model bắt buộc');
  });

  it('throw khi ProductVariant model bị thiếu', () => {
    const { ProductVariant: _pv, ...rest } = models();
    expect(() => new SequelizeCartRepository(rest)).toThrow('ProductVariant model bắt buộc');
  });

  it('throw khi sequelize bị thiếu', () => {
    const { sequelize: _s, ...rest } = models();
    expect(() => new SequelizeCartRepository(rest)).toThrow('sequelize bắt buộc');
  });

  it('khởi tạo thành công khi đầy đủ tất cả dependencies', () => {
    expect(() => makeRepo()).not.toThrow();
  });
});

// ─── Cart aggregate methods ────────────────────────────────────────────────────

describe('findActiveCartByUserId', () => {
  it('gọi Cart.findOne với userId và status active', async () => {
    const { repo, deps } = makeRepo();
    const cart = { id: 1, userId: 5, status: 'active' };
    deps.Cart.findOne.mockResolvedValue(cart);

    const result = await repo.findActiveCartByUserId(5);

    expect(deps.Cart.findOne).toHaveBeenCalledWith({ where: { userId: 5, status: 'active' } });
    expect(result).toBe(cart);
  });

  it('trả về null khi không tìm thấy cart active', async () => {
    const { repo, deps } = makeRepo();
    deps.Cart.findOne.mockResolvedValue(null);

    const result = await repo.findActiveCartByUserId(99);

    expect(result).toBeNull();
  });
});

describe('findActiveCartBySessionId', () => {
  it('gọi Cart.findOne với sessionId, status active, và userId null', async () => {
    const { repo, deps } = makeRepo();
    const cart = { id: 2, sessionId: 'sess-abc', status: 'active', userId: null };
    deps.Cart.findOne.mockResolvedValue(cart);

    const result = await repo.findActiveCartBySessionId('sess-abc');

    expect(deps.Cart.findOne).toHaveBeenCalledWith({
      where: { sessionId: 'sess-abc', status: 'active', userId: null },
    });
    expect(result).toBe(cart);
  });
});

describe('findOrCreateActiveCartByUserId', () => {
  it('gọi Cart.findOrCreate với đúng where và defaults', async () => {
    const { repo, deps } = makeRepo();
    const cart = { id: 3, userId: 7, status: 'active' };
    deps.Cart.findOrCreate.mockResolvedValue([cart, true]);

    const result = await repo.findOrCreateActiveCartByUserId(7);

    expect(deps.Cart.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, status: 'active' },
        defaults: { userId: 7 },
      }),
    );
    expect(result).toBe(cart);
  });

  it('forward options (transaction) vào findOrCreate', async () => {
    const { repo, deps } = makeRepo();
    deps.Cart.findOrCreate.mockResolvedValue([{ id: 1 }, false]);

    await repo.findOrCreateActiveCartByUserId(3, { transaction: 'txn' });

    expect(deps.Cart.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ transaction: 'txn' }),
    );
  });
});

describe('findOrCreateActiveCartBySessionId', () => {
  it('gọi Cart.findOrCreate với sessionId và defaults', async () => {
    const { repo, deps } = makeRepo();
    const cart = { id: 4, sessionId: 'guest-123', status: 'active' };
    deps.Cart.findOrCreate.mockResolvedValue([cart, true]);

    const result = await repo.findOrCreateActiveCartBySessionId('guest-123');

    expect(deps.Cart.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: 'guest-123', status: 'active' },
        defaults: { sessionId: 'guest-123' },
      }),
    );
    expect(result).toBe(cart);
  });
});

describe('saveCart', () => {
  it('gọi cart.save() với options', async () => {
    const { repo } = makeRepo();
    const cart = { save: jest.fn().mockResolvedValue('saved') };

    const result = await repo.saveCart(cart, { transaction: 'tx' });

    expect(cart.save).toHaveBeenCalledWith({ transaction: 'tx' });
    expect(result).toBe('saved');
  });
});

// ─── Cart item methods ─────────────────────────────────────────────────────────

describe('findCartItemById', () => {
  it('gọi CartItem.findByPk với id và options', async () => {
    const { repo, deps } = makeRepo();
    const item = { id: 10 };
    deps.CartItem.findByPk.mockResolvedValue(item);

    const result = await repo.findCartItemById(10, { include: ['Product'] });

    expect(deps.CartItem.findByPk).toHaveBeenCalledWith(10, { include: ['Product'] });
    expect(result).toBe(item);
  });
});

describe('findCartItemsByCartId', () => {
  it('gọi CartItem.findAll với where cartId và options', async () => {
    const { repo, deps } = makeRepo();
    const items = [{ id: 1 }, { id: 2 }];
    deps.CartItem.findAll.mockResolvedValue(items);

    const result = await repo.findCartItemsByCartId(5, { transaction: 'tx' });

    expect(deps.CartItem.findAll).toHaveBeenCalledWith({
      where: { cartId: 5 },
      transaction: 'tx',
    });
    expect(result).toBe(items);
  });
});

describe('findCartItemMatching', () => {
  it('gọi CartItem.findOne với query và options', async () => {
    const { repo, deps } = makeRepo();
    const query = { cartId: 1, productId: 10, variantId: null };
    const item = { id: 3, ...query };
    deps.CartItem.findOne.mockResolvedValue(item);

    const result = await repo.findCartItemMatching(query, { transaction: 'tx' });

    expect(deps.CartItem.findOne).toHaveBeenCalledWith({ where: query, transaction: 'tx' });
    expect(result).toBe(item);
  });
});

describe('createCartItem', () => {
  it('gọi CartItem.create với payload và options', async () => {
    const { repo, deps } = makeRepo();
    const payload = { cartId: 1, productId: 5, quantity: 2 };
    const created = { id: 7, ...payload };
    deps.CartItem.create.mockResolvedValue(created);

    const result = await repo.createCartItem(payload, { transaction: 'tx' });

    expect(deps.CartItem.create).toHaveBeenCalledWith(payload, { transaction: 'tx' });
    expect(result).toBe(created);
  });
});

describe('saveCartItem', () => {
  it('gọi item.save() với options', async () => {
    const { repo } = makeRepo();
    const item = { save: jest.fn().mockResolvedValue('item-saved') };

    const result = await repo.saveCartItem(item, { transaction: 'tx' });

    expect(item.save).toHaveBeenCalledWith({ transaction: 'tx' });
    expect(result).toBe('item-saved');
  });
});

describe('deleteCartItem', () => {
  it('gọi item.destroy() với options', async () => {
    const { repo } = makeRepo();
    const item = { destroy: jest.fn().mockResolvedValue(1) };

    const result = await repo.deleteCartItem(item, { transaction: 'tx' });

    expect(item.destroy).toHaveBeenCalledWith({ transaction: 'tx' });
    expect(result).toBe(1);
  });
});

describe('clearCartItems', () => {
  it('gọi CartItem.destroy với where cartId và options', async () => {
    const { repo, deps } = makeRepo();
    deps.CartItem.destroy.mockResolvedValue(5);

    const result = await repo.clearCartItems(3, { transaction: 'tx' });

    expect(deps.CartItem.destroy).toHaveBeenCalledWith({ where: { cartId: 3 }, transaction: 'tx' });
    expect(result).toBe(5);
  });
});

describe('sumCartItemQuantity', () => {
  it('gọi CartItem.sum với quantity và where cartId', async () => {
    const { repo, deps } = makeRepo();
    deps.CartItem.sum.mockResolvedValue(7);

    const result = await repo.sumCartItemQuantity(2);

    expect(deps.CartItem.sum).toHaveBeenCalledWith('quantity', { where: { cartId: 2 } });
    expect(result).toBe(7);
  });

  it('trả về 0 khi giỏ hàng rỗng', async () => {
    const { repo, deps } = makeRepo();
    deps.CartItem.sum.mockResolvedValue(0);

    const result = await repo.sumCartItemQuantity(99);

    expect(result).toBe(0);
  });
});

// ─── Catalog (cross-module) methods ───────────────────────────────────────────

describe('findProductById', () => {
  it('gọi Product.findByPk với include defaultVariant', async () => {
    const { repo, deps } = makeRepo();
    const product = { id: 10, name: 'SP A', defaultVariant: { id: 1 } };
    deps.Product.findByPk.mockResolvedValue(product);

    const result = await repo.findProductById(10);

    expect(deps.Product.findByPk).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ association: 'defaultVariant' }),
        ]),
      }),
    );
    expect(result).toBe(product);
  });
});

describe('findVariantByIdAndProductId', () => {
  it('gọi ProductVariant.findOne với id và productId', async () => {
    const { repo, deps } = makeRepo();
    const variant = { id: 5, productId: 10 };
    deps.ProductVariant.findOne.mockResolvedValue(variant);

    const result = await repo.findVariantByIdAndProductId(5, 10);

    expect(deps.ProductVariant.findOne).toHaveBeenCalledWith({ where: { id: 5, productId: 10 } });
    expect(result).toBe(variant);
  });
});

// ─── Eager load helpers ────────────────────────────────────────────────────────

describe('findCartItemsWithDetails', () => {
  it('gọi CartItem.findAll với include Product, ProductVariant', async () => {
    const { repo, deps } = makeRepo();
    const items = [{ id: 1 }, { id: 2 }];
    deps.CartItem.findAll.mockResolvedValue(items);

    const result = await repo.findCartItemsWithDetails(10);

    expect(deps.CartItem.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cartId: 10 },
        include: expect.arrayContaining([
          expect.objectContaining({ model: deps.Product }),
          expect.objectContaining({ model: deps.ProductVariant }),
        ]),
      }),
    );
    expect(result).toBe(items);
  });
});

describe('findCartItemByIdWithCartAndStock', () => {
  it('gọi CartItem.findByPk với include Cart, Product, ProductVariant', async () => {
    const { repo, deps } = makeRepo();
    const item = { id: 5 };
    deps.CartItem.findByPk.mockResolvedValue(item);

    const result = await repo.findCartItemByIdWithCartAndStock(5);

    expect(deps.CartItem.findByPk).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ model: deps.Cart }),
          expect.objectContaining({ model: deps.Product }),
          expect.objectContaining({ model: deps.ProductVariant }),
        ]),
      }),
    );
    expect(result).toBe(item);
  });
});

describe('findCartItemsForValidation', () => {
  it('gọi CartItem.findAll với include Product và ProductVariant', async () => {
    const { repo, deps } = makeRepo();
    deps.CartItem.findAll.mockResolvedValue([]);

    await repo.findCartItemsForValidation(3);

    expect(deps.CartItem.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cartId: 3 },
        include: expect.arrayContaining([
          expect.objectContaining({ model: deps.Product }),
          expect.objectContaining({ model: deps.ProductVariant }),
        ]),
      }),
    );
  });
});

describe('findCartItemsForMerge', () => {
  it('gọi CartItem.findAll với include Product, ProductVariant và options', async () => {
    const { repo, deps } = makeRepo();
    const items = [{ id: 1 }];
    deps.CartItem.findAll.mockResolvedValue(items);

    const result = await repo.findCartItemsForMerge(2, { transaction: 'tx' });

    expect(deps.CartItem.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cartId: 2 },
        transaction: 'tx',
        include: expect.arrayContaining([
          expect.objectContaining({ model: deps.Product }),
          expect.objectContaining({ model: deps.ProductVariant }),
        ]),
      }),
    );
    expect(result).toBe(items);
  });
});

// ─── Transaction ──────────────────────────────────────────────────────────────

describe('runInTransaction', () => {
  it('gọi sequelize.transaction với work function', async () => {
    const { repo, sequelize } = makeRepo();
    const work = jest.fn().mockResolvedValue('result');

    const result = await repo.runInTransaction(work);

    expect(sequelize.transaction).toHaveBeenCalledWith(work);
    expect(result).toBe('result');
  });
});
