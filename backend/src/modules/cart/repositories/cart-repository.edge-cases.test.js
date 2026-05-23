// Tests nhắm vào các nhánh chưa được cover trong SequelizeCartRepository.
// Uncovered lines: 56-74 (saveCart + CartItem methods với/không options),
//                 166 (findCartItemsForMerge options spread)

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
    sequelize,
    ...overrides,
  };
  return { repo: new SequelizeCartRepository(deps), deps, sequelize };
}

// ─── saveCart — branch: không truyền options (default {}) vs truyền options ───

describe('saveCart', () => {
  it('gọi cart.save() với default options {} khi không truyền options', async () => {
    // Branch: options = {} (default parameter branch)
    const { repo } = makeRepo();
    const cart = { save: jest.fn().mockResolvedValue('saved') };

    await repo.saveCart(cart);

    expect(cart.save).toHaveBeenCalledWith({});
  });
});

// ─── findCartItemById — branch: options rỗng vs có options ───────────────────

describe('findCartItemById', () => {
  it('gọi CartItem.findByPk với default options {} khi không truyền options', async () => {
    // Branch: options = {} (default parameter branch)
    const { repo, deps } = makeRepo();
    deps.CartItem.findByPk.mockResolvedValue({ id: 1 });

    await repo.findCartItemById(1);

    expect(deps.CartItem.findByPk).toHaveBeenCalledWith(1, {});
  });
});

// ─── findCartItemsByCartId — branch: không truyền options ────────────────────

describe('findCartItemsByCartId', () => {
  it('gọi CartItem.findAll với where cartId và default options {} khi không truyền options', async () => {
    // Branch: options = {} (default parameter branch)
    const { repo, deps } = makeRepo();
    deps.CartItem.findAll.mockResolvedValue([{ id: 1 }]);

    await repo.findCartItemsByCartId(5);

    expect(deps.CartItem.findAll).toHaveBeenCalledWith({ where: { cartId: 5 } });
  });
});

// ─── findCartItemMatching — branch: không truyền options ─────────────────────

describe('findCartItemMatching', () => {
  it('gọi CartItem.findOne với where query và default options {} khi không truyền options', async () => {
    // Branch: options = {} (default parameter branch)
    const { repo, deps } = makeRepo();
    const query = { cartId: 1, productId: 10 };
    deps.CartItem.findOne.mockResolvedValue({ id: 3 });

    await repo.findCartItemMatching(query);

    expect(deps.CartItem.findOne).toHaveBeenCalledWith({ where: query });
  });
});

// ─── createCartItem — branch: không truyền options ───────────────────────────

describe('createCartItem', () => {
  it('gọi CartItem.create với payload và default options {} khi không truyền options', async () => {
    // Branch: options = {} (default parameter branch)
    const { repo, deps } = makeRepo();
    const payload = { cartId: 1, productId: 5, quantity: 2 };
    deps.CartItem.create.mockResolvedValue({ id: 7, ...payload });

    await repo.createCartItem(payload);

    expect(deps.CartItem.create).toHaveBeenCalledWith(payload, {});
  });
});

// ─── saveCartItem — branch: không truyền options ─────────────────────────────

describe('saveCartItem', () => {
  it('gọi item.save() với default options {} khi không truyền options', async () => {
    // Branch: options = {} (default parameter branch)
    const { repo } = makeRepo();
    const item = { save: jest.fn().mockResolvedValue('item-saved') };

    await repo.saveCartItem(item);

    expect(item.save).toHaveBeenCalledWith({});
  });
});

// ─── deleteCartItem — branch: không truyền options ───────────────────────────

describe('deleteCartItem', () => {
  it('gọi item.destroy() với default options {} khi không truyền options', async () => {
    // Branch: options = {} (default parameter branch)
    const { repo } = makeRepo();
    const item = { destroy: jest.fn().mockResolvedValue(1) };

    await repo.deleteCartItem(item);

    expect(item.destroy).toHaveBeenCalledWith({});
  });
});

// ─── clearCartItems — branch: không truyền options ───────────────────────────

describe('clearCartItems', () => {
  it('gọi CartItem.destroy với where cartId và default options {} khi không truyền options', async () => {
    // Branch: options = {} (default parameter)
    const { repo, deps } = makeRepo();
    deps.CartItem.destroy.mockResolvedValue(3);

    await repo.clearCartItems(7);

    expect(deps.CartItem.destroy).toHaveBeenCalledWith({ where: { cartId: 7 } });
  });
});

// ─── findCartItemsForMerge — branch: không truyền options (line 166) ─────────

describe('findCartItemsForMerge', () => {
  it('gọi CartItem.findAll không có extra options khi options rỗng', async () => {
    // Line 166: findCartItemsForMerge(cartId, options = {}) → spread ...options
    const { repo, deps } = makeRepo();
    const items = [{ id: 1 }];
    deps.CartItem.findAll.mockResolvedValue(items);

    const result = await repo.findCartItemsForMerge(5);

    // Không có transaction trong call → chỉ có where, include
    expect(deps.CartItem.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cartId: 5 } }),
    );
    expect(deps.CartItem.findAll).not.toHaveBeenCalledWith(
      expect.objectContaining({ transaction: expect.anything() }),
    );
    expect(result).toBe(items);
  });

  it('spread options vào findAll khi truyền options có transaction', async () => {
    const { repo, deps } = makeRepo();
    deps.CartItem.findAll.mockResolvedValue([]);

    await repo.findCartItemsForMerge(3, { transaction: 'my-txn' });

    expect(deps.CartItem.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ transaction: 'my-txn', where: { cartId: 3 } }),
    );
  });
});

// ─── findOrCreateActiveCartByUserId — branch: không truyền options ────────────

describe('findOrCreateActiveCartByUserId', () => {
  it('gọi findOrCreate với default options {} khi không truyền options', async () => {
    // Branch: options = {} (default parameter)
    const { repo, deps } = makeRepo();
    const cart = { id: 1, userId: 5 };
    deps.Cart.findOrCreate.mockResolvedValue([cart, true]);

    const result = await repo.findOrCreateActiveCartByUserId(5);

    // Khi spread {} vào findOrCreate → chỉ where và defaults
    expect(deps.Cart.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 5, status: 'active' } }),
    );
    expect(result).toBe(cart);
  });
});

// ─── findOrCreateActiveCartBySessionId — branch: không truyền options ─────────

describe('findOrCreateActiveCartBySessionId', () => {
  it('gọi findOrCreate với default options {} khi không truyền options', async () => {
    // Branch: options = {} (default parameter)
    const { repo, deps } = makeRepo();
    const cart = { id: 2, sessionId: 'sess-test' };
    deps.Cart.findOrCreate.mockResolvedValue([cart, false]);

    const result = await repo.findOrCreateActiveCartBySessionId('sess-test');

    expect(deps.Cart.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionId: 'sess-test', status: 'active' } }),
    );
    expect(result).toBe(cart);
  });
});
