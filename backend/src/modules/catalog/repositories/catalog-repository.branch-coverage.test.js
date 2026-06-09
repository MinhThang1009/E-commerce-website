jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const CatalogRepo = require('./sequelize-catalog-repository');

describe('SequelizeCatalogRepository — branch coverage', () => {
  test('findProductRatingsSummary: row null → count=0, average=0', async () => {
    const repo = new CatalogRepo({
      Product: {},
      ProductImage: {},
      ProductVariant: {},
      Category: {},
      Brand: {},
      Review: { findOne: jest.fn().mockResolvedValue(null), findAll: jest.fn() },
      ProductAttribute: {},
      Attribute: {},
      RecentlyViewedProduct: {},
      sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn(), Op: {} },
    });
    const result = await repo.findProductRatingsSummary(1);
    expect(result).toEqual({
      count: 0,
      average: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  test('findProductRatingsSummary: row with data → parse correctly', async () => {
    const repo = new CatalogRepo({
      Product: {},
      ProductImage: {},
      ProductVariant: {},
      Category: {},
      Brand: {},
      Review: {
        findOne: jest.fn().mockResolvedValue({
          count: '25',
          average: '4.23456',
          r1: '1',
          r2: '2',
          r3: '3',
          r4: '9',
          r5: '10',
        }),
        findAll: jest.fn(),
      },
      ProductAttribute: {},
      Attribute: {},
      RecentlyViewedProduct: {},
      sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn(), Op: {} },
    });
    const result = await repo.findProductRatingsSummary(1);
    expect(result.count).toBe(25);
    expect(result.average).toBe(4.2);
  });

  test('findProductRatingsSummary: no Review model → throw', async () => {
    const repo = new CatalogRepo({
      Product: {},
      ProductImage: {},
      ProductVariant: {},
      Category: {},
      Brand: {},
      Review: null,
      ProductAttribute: {},
      Attribute: {},
      RecentlyViewedProduct: {},
      sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn(), Op: {} },
    });
    await expect(repo.findProductRatingsSummary(1)).rejects.toThrow('Review model bắt buộc');
  });

  test('findProductRatingsRows: no Review model → throw', async () => {
    const repo = new CatalogRepo({
      Product: {},
      ProductImage: {},
      ProductVariant: {},
      Category: {},
      Brand: {},
      Review: null,
      ProductAttribute: {},
      Attribute: {},
      RecentlyViewedProduct: {},
      sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn(), Op: {} },
    });
    await expect(repo.findProductRatingsRows(1)).rejects.toThrow('Review model bắt buộc');
  });

  test('_buildProductOrderClause: unsafe order → fallback DESC', () => {
    const repo = new CatalogRepo({
      Product: {},
      ProductImage: {},
      ProductVariant: {},
      Category: {},
      Brand: {},
      Review: null,
      ProductAttribute: {},
      Attribute: {},
      RecentlyViewedProduct: {},
      sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn(), Op: {}, where: jest.fn() },
    });
    expect(repo._buildProductOrderClause('createdAt', 'INVALID')).toEqual([['createdAt', 'DESC']]);
  });

  test('_buildProductOrderClause: unsafe sort → fallback createdAt', () => {
    const repo = new CatalogRepo({
      Product: {},
      ProductImage: {},
      ProductVariant: {},
      Category: {},
      Brand: {},
      Review: null,
      ProductAttribute: {},
      Attribute: {},
      RecentlyViewedProduct: {},
      sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn(), Op: {}, where: jest.fn() },
    });
    expect(repo._buildProductOrderClause('hackedField', 'ASC')).toEqual([['createdAt', 'ASC']]);
  });

  test('_buildProductOrderClause: null order → fallback DESC', () => {
    const repo = new CatalogRepo({
      Product: {},
      ProductImage: {},
      ProductVariant: {},
      Category: {},
      Brand: {},
      Review: null,
      ProductAttribute: {},
      Attribute: {},
      RecentlyViewedProduct: {},
      sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn(), Op: {}, where: jest.fn() },
    });
    expect(repo._buildProductOrderClause('name', null)).toEqual([['name', 'DESC']]);
  });
});
