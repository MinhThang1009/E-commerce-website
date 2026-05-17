// Unit tests cho SequelizeWishlistRepository (0% → ~100% covered).
// Mock toàn bộ Sequelize models — không chạm DB.

const SequelizeWishlistRepository = require('./SequelizeWishlistRepository');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeModel(defaults = {}) {
  return {
    findAll: jest.fn().mockResolvedValue(defaults.findAll ?? []),
    findOne: jest.fn().mockResolvedValue(defaults.findOne ?? null),
    findByPk: jest.fn().mockResolvedValue(defaults.findByPk ?? null),
    create: jest.fn().mockResolvedValue(defaults.create ?? {}),
    destroy: jest.fn().mockResolvedValue(defaults.destroy ?? 1),
  };
}

function makeRepo(overrides = {}) {
  const deps = {
    Wishlist: makeModel(),
    Product: makeModel(),
    ...overrides,
  };
  return { repo: new SequelizeWishlistRepository(deps), deps };
}

// ─── Constructor validation ────────────────────────────────────────────────────

describe('SequelizeWishlistRepository — constructor', () => {
  it('throw khi Wishlist model bị thiếu', () => {
    expect(() => new SequelizeWishlistRepository({ Product: makeModel() }))
      .toThrow('Wishlist model bắt buộc');
  });

  it('throw khi Product model bị thiếu', () => {
    expect(() => new SequelizeWishlistRepository({ Wishlist: makeModel() }))
      .toThrow('Product model bắt buộc');
  });

  it('khởi tạo thành công khi đầy đủ cả hai model', () => {
    expect(() => makeRepo()).not.toThrow();
  });
});

// ─── findByUserIdWithProducts ─────────────────────────────────────────────────

describe('findByUserIdWithProducts', () => {
  it('gọi Wishlist.findAll với userId và include Product', async () => {
    const { repo, deps } = makeRepo();
    const items = [{ id: 1, userId: 42, Product: { id: 10, name: 'SP A' } }];
    deps.Wishlist.findAll.mockResolvedValue(items);

    const result = await repo.findByUserIdWithProducts(42);

    expect(deps.Wishlist.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 42 },
        order: [['createdAt', 'DESC']],
      }),
    );
    expect(result).toBe(items);
  });

  it('include Product với đúng attributes', async () => {
    const { repo, deps } = makeRepo();
    deps.Wishlist.findAll.mockResolvedValue([]);

    await repo.findByUserIdWithProducts(1);

    const call = deps.Wishlist.findAll.mock.calls[0][0];
    const productInclude = call.include[0];
    expect(productInclude.model).toBe(deps.Product);
    expect(productInclude.attributes).toContain('id');
    expect(productInclude.attributes).toContain('name');
    expect(productInclude.attributes).toContain('slug');
  });

  it('include có nested associations: productImages, defaultVariant, variants', async () => {
    const { repo, deps } = makeRepo();
    deps.Wishlist.findAll.mockResolvedValue([]);

    await repo.findByUserIdWithProducts(5);

    const call = deps.Wishlist.findAll.mock.calls[0][0];
    const nestedIncludes = call.include[0].include;
    const associations = nestedIncludes.map((i) => i.association);
    expect(associations).toContain('productImages');
    expect(associations).toContain('defaultVariant');
    expect(associations).toContain('variants');
  });

  it('trả về danh sách rỗng khi user không có wishlist', async () => {
    const { repo, deps } = makeRepo();
    deps.Wishlist.findAll.mockResolvedValue([]);

    const result = await repo.findByUserIdWithProducts(99);

    expect(result).toEqual([]);
  });
});

// ─── findItem ─────────────────────────────────────────────────────────────────

describe('findItem', () => {
  it('gọi Wishlist.findOne với userId và productId đúng', async () => {
    const { repo, deps } = makeRepo();
    const item = { id: 7, userId: 1, productId: 10 };
    deps.Wishlist.findOne.mockResolvedValue(item);

    const result = await repo.findItem(1, 10);

    expect(deps.Wishlist.findOne).toHaveBeenCalledWith({ where: { userId: 1, productId: 10 } });
    expect(result).toBe(item);
  });

  it('trả về null khi item không tồn tại', async () => {
    const { repo, deps } = makeRepo();
    deps.Wishlist.findOne.mockResolvedValue(null);

    const result = await repo.findItem(1, 999);

    expect(result).toBeNull();
  });
});

// ─── createItem ───────────────────────────────────────────────────────────────

describe('createItem', () => {
  it('gọi Wishlist.create với payload đúng', async () => {
    const { repo, deps } = makeRepo();
    const payload = { userId: 3, productId: 20 };
    const created = { id: 5, ...payload };
    deps.Wishlist.create.mockResolvedValue(created);

    const result = await repo.createItem(payload);

    expect(deps.Wishlist.create).toHaveBeenCalledWith(payload);
    expect(result).toBe(created);
  });
});

// ─── deleteItem ───────────────────────────────────────────────────────────────

describe('deleteItem', () => {
  it('gọi item.destroy() trên instance được truyền vào', async () => {
    const { repo } = makeRepo();
    const item = { id: 3, destroy: jest.fn().mockResolvedValue(1) };

    const result = await repo.deleteItem(item);

    expect(item.destroy).toHaveBeenCalled();
    expect(result).toBe(1);
  });
});

// ─── clearByUserId ────────────────────────────────────────────────────────────

describe('clearByUserId', () => {
  it('gọi Wishlist.destroy với where userId', async () => {
    const { repo, deps } = makeRepo();
    deps.Wishlist.destroy.mockResolvedValue(3);

    const result = await repo.clearByUserId(7);

    expect(deps.Wishlist.destroy).toHaveBeenCalledWith({ where: { userId: 7 } });
    expect(result).toBe(3);
  });

  it('trả về 0 khi không có item nào bị xóa', async () => {
    const { repo, deps } = makeRepo();
    deps.Wishlist.destroy.mockResolvedValue(0);

    const result = await repo.clearByUserId(99);

    expect(result).toBe(0);
  });
});

// ─── findProductById ─────────────────────────────────────────────────────────

describe('findProductById', () => {
  it('gọi Product.findByPk với id đúng', async () => {
    const { repo, deps } = makeRepo();
    const product = { id: 15, name: 'Sản phẩm X' };
    deps.Product.findByPk.mockResolvedValue(product);

    const result = await repo.findProductById(15);

    expect(deps.Product.findByPk).toHaveBeenCalledWith(15);
    expect(result).toBe(product);
  });

  it('trả về null khi sản phẩm không tồn tại', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findByPk.mockResolvedValue(null);

    const result = await repo.findProductById(9999);

    expect(result).toBeNull();
  });
});
