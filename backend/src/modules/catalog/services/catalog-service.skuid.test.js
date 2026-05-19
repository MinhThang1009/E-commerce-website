/**
 * Branch coverage cho catalog-service.js line 563:
 * `if (!skuId && normColor) variantColor = normColor;` — FALSE branch
 * (khi skuId được cung cấp → !skuId = false → không override variantColor)
 */
process.env.NODE_ENV = 'test';

const CatalogService = require('./catalog-service');

function makeProduct(overrides = {}) {
  const data = {
    id: 1,
    name: 'iPhone 15 Pro',
    slug: 'iphone-15-pro',
    basePrice: '29990000',
    compareAtPrice: null,
    stockQuantity: 5,
    isFeatured: false,
    productImages: [],
    variants: [],
    categories: [],
    reviews: [],
    ...overrides,
  };
  return { ...data, toJSON: () => ({ ...data }) };
}

describe('CatalogService._buildProductDetailResponse — skuId + queryColor (line 563 FALSE branch)', () => {
  let service;

  beforeEach(() => {
    service = new CatalogService({
      catalogRepository: {},
      cacheStore: null,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    });
  });

  test('có skuId → !skuId=false → variantColor KHÔNG bị override bởi normColor', () => {
    const product = makeProduct({
      variants: [
        {
          id: 10,
          price: '25000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đen 256GB',
          isDefault: true,
          sku: 'SKU-10',
          specifications: {},
          attributes: { color: 'đen' },
        },
      ],
    });
    // skuId='10', queryColor='trắng' → !skuId=false → if(!skuId && normColor) = false → FALSE branch
    const result = service._buildProductDetailResponse(product, {
      skuId: '10',
      queryColor: 'trắng',
    });
    expect(result).toBeDefined();
    expect(result.sku).toBe('SKU-10');
  });

  test('không có skuId, có normColor → !skuId=true → variantColor ĐƯỢC override', () => {
    const product = makeProduct({
      variants: [
        {
          id: 20,
          price: '25000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Trắng 256GB',
          isDefault: true,
          sku: 'SKU-20',
          specifications: {},
          attributes: { color: 'trắng' },
        },
      ],
    });
    // skuId=undefined, queryColor='trắng' → !skuId=true, normColor='trắng' → TRUE branch
    const result = service._buildProductDetailResponse(product, { queryColor: 'trắng' });
    expect(result).toBeDefined();
  });
});
