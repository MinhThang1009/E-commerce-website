/**
 * Phase 44 — Unit tests cho productHelpers (utils/productHelpers.js)
 * Pure functions — không cần mock SDK, chỉ mock models cho updateProductTotalStock.
 */

jest.mock('@models', () => ({
  ProductVariant: { findAll: jest.fn() },
}));
jest.mock('./logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

const {
  calculateTotalStock,
  updateProductTotalStock,
  validateVariantAttributes,
  generateVariantSku,
  hasVariants,
  getVariantStock,
  findVariantByAttributes,
  enrichProductData,
} = require('./product-helpers');
const { ProductVariant } = require('@models');

describe('calculateTotalStock', () => {
  test('Tổng stock của variants', () => {
    expect(
      calculateTotalStock([{ stockQuantity: 10 }, { stockQuantity: 20 }, { stockQuantity: 5 }]),
    ).toBe(35);
  });

  test('Variants rỗng → 0', () => {
    expect(calculateTotalStock([])).toBe(0);
    expect(calculateTotalStock(null)).toBe(0);
    expect(calculateTotalStock(undefined)).toBe(0);
  });

  test('stockQuantity undefined → coi như 0', () => {
    expect(calculateTotalStock([{ stockQuantity: 10 }, { stockQuantity: undefined }, {}])).toBe(10);
  });
});

describe('updateProductTotalStock', () => {
  test('Update Product với tổng stock khi stock > 0', async () => {
    ProductVariant.findAll.mockResolvedValue([{ stockQuantity: 5 }, { stockQuantity: 7 }]);
    const Product = { update: jest.fn().mockResolvedValue([1]) };

    const result = await updateProductTotalStock(42, Product);

    expect(result).toBe(12);
    expect(Product.update).toHaveBeenCalledWith({ stockQuantity: 12 }, { where: { id: 42 } });
  });

  test('stockQuantity = 0 khi không có stock', async () => {
    ProductVariant.findAll.mockResolvedValue([{ stockQuantity: 0 }]);
    const Product = { update: jest.fn().mockResolvedValue([1]) };

    await updateProductTotalStock(1, Product);

    expect(Product.update).toHaveBeenCalledWith({ stockQuantity: 0 }, { where: { id: 1 } });
  });

  test('Re-throw error nếu DB fail', async () => {
    ProductVariant.findAll.mockRejectedValue(new Error('DB down'));
    const Product = { update: jest.fn() };

    await expect(updateProductTotalStock(1, Product)).rejects.toThrow('DB down');
  });
});

describe('validateVariantAttributes', () => {
  test('Variant value nằm trong product values → true', () => {
    expect(
      validateVariantAttributes([{ name: 'color', values: ['red', 'blue'] }], { color: 'red' }),
    ).toBe(true);
  });

  test('Variant value KHÔNG nằm trong product values → false', () => {
    expect(
      validateVariantAttributes([{ name: 'color', values: ['red', 'blue'] }], { color: 'green' }),
    ).toBe(false);
  });

  test('productAttributes rỗng → true (no constraint)', () => {
    expect(validateVariantAttributes([], { color: 'x' })).toBe(true);
    expect(validateVariantAttributes(null, { color: 'x' })).toBe(true);
  });

  test('variantAttributes null → true', () => {
    expect(validateVariantAttributes([{ name: 'color', values: ['red'] }], null)).toBe(true);
  });

  test('Variant skip attribute không có value (continue)', () => {
    expect(
      validateVariantAttributes(
        [
          { name: 'color', values: ['red'] },
          { name: 'size', values: ['M', 'L'] },
        ],
        { color: 'red' }, // chỉ có color, size missing → skip
      ),
    ).toBe(true);
  });

  test('values không phải Array → skip validate', () => {
    expect(
      validateVariantAttributes([{ name: 'color', values: 'not-array' }], { color: 'anything' }),
    ).toBe(true);
  });
});

describe('generateVariantSku', () => {
  test('Concat productSku + uppercase attributes joined "-"', () => {
    expect(generateVariantSku('IPHONE17', { color: 'black', storage: '256gb' })).toBe(
      'IPHONE17-BLACK-256GB',
    );
  });

  test('Strip whitespace trong attribute value', () => {
    expect(generateVariantSku('SKU', { color: 'dark blue' })).toBe('SKU-DARKBLUE');
  });

  test('Multiple spaces collapsed', () => {
    expect(generateVariantSku('X', { config: '32 GB DDR5' })).toBe('X-32GBDDR5');
  });
});

describe('hasVariants', () => {
  test('Product có variants → true', () => {
    expect(hasVariants({ variants: [{ id: 1 }] })).toBe(true);
  });

  test('Product không có variants hoặc rỗng → falsy', () => {
    // hasVariants dùng `&&` short-circuit, undefined/null trả về falsy (không strict false)
    expect(hasVariants({ variants: [] })).toBe(false); // empty array length=0 → strict false
    expect(hasVariants({})).toBeFalsy(); // undefined.length undefined → undefined
    expect(hasVariants({ variants: null })).toBeFalsy(); // null && ... → null
  });
});

describe('getVariantStock', () => {
  const variants = [
    { attributes: { color: 'red', size: 'M' }, stockQuantity: 5 },
    { attributes: { color: 'red', size: 'L' }, stockQuantity: 10 },
    { attributes: { color: 'blue', size: 'M' }, stockQuantity: 3 },
  ];

  test('Match đúng variant → trả stock', () => {
    expect(getVariantStock(variants, { color: 'red', size: 'L' })).toBe(10);
    expect(getVariantStock(variants, { color: 'blue', size: 'M' })).toBe(3);
  });

  test('No match → 0', () => {
    expect(getVariantStock(variants, { color: 'green', size: 'XL' })).toBe(0);
  });

  test('Variants rỗng → 0', () => {
    expect(getVariantStock([], { color: 'x' })).toBe(0);
    expect(getVariantStock(null, { color: 'x' })).toBe(0);
  });
});

describe('findVariantByAttributes', () => {
  const variants = [
    { id: 1, attributes: { color: 'red' } },
    { id: 2, attributes: { color: 'blue' } },
  ];

  test('Match → trả variant object', () => {
    expect(findVariantByAttributes(variants, { color: 'blue' })).toEqual({
      id: 2,
      attributes: { color: 'blue' },
    });
  });

  test('No match → undefined', () => {
    expect(findVariantByAttributes(variants, { color: 'green' })).toBeUndefined();
  });

  test('Variants rỗng → null', () => {
    expect(findVariantByAttributes([], {})).toBeNull();
    expect(findVariantByAttributes(null, {})).toBeNull();
  });
});

describe('enrichProductData', () => {
  it('ảnh có isThumbnail=true → dùng làm thumbnail', () => {
    const product = {
      productImages: [
        { imageUrl: 'alt.jpg', isThumbnail: false },
        { imageUrl: 'thumb.jpg', isThumbnail: true },
      ],
      variants: [],
      stockQuantity: 0,
    };
    enrichProductData(product);
    expect(product.thumbnail).toBe('thumb.jpg');
  });

  it('không có isThumbnail=true → lấy ảnh đầu tiên', () => {
    const product = {
      productImages: [
        { imageUrl: 'first.jpg', isThumbnail: false },
        { imageUrl: 'second.jpg', isThumbnail: false },
      ],
      variants: [],
      stockQuantity: 0,
    };
    enrichProductData(product);
    expect(product.thumbnail).toBe('first.jpg');
  });

  it('productImages rỗng → thumbnail = null', () => {
    const product = { productImages: [], variants: [], stockQuantity: 0 };
    enrichProductData(product);
    expect(product.thumbnail).toBeNull();
  });

  it('không có productImages → thumbnail = null', () => {
    const product = { variants: [], stockQuantity: 0 };
    enrichProductData(product);
    expect(product.thumbnail).toBeNull();
  });

  it('variants có stockQuantity > 0 → inStock = true', () => {
    const product = {
      productImages: [],
      variants: [{ stockQuantity: 5 }, { stockQuantity: 0 }],
      stockQuantity: 0,
    };
    enrichProductData(product);
    expect(product.inStock).toBe(true);
  });

  it('tất cả variants hết hàng nhưng product.stockQuantity > 0 → inStock = true', () => {
    const product = {
      productImages: [],
      variants: [{ stockQuantity: 0 }],
      stockQuantity: 10,
    };
    enrichProductData(product);
    expect(product.inStock).toBe(true);
  });

  it('variants rỗng và stockQuantity = 0 → inStock = false', () => {
    const product = { productImages: [], variants: [], stockQuantity: 0 };
    enrichProductData(product);
    expect(product.inStock).toBe(false);
  });

  it('không có variants và stockQuantity > 0 → inStock = true', () => {
    const product = { productImages: [], stockQuantity: 3 };
    enrichProductData(product);
    expect(product.inStock).toBe(true);
  });

  it('variant.stockQuantity undefined → tính như 0', () => {
    const product = {
      productImages: [],
      variants: [{ stockQuantity: undefined }],
      stockQuantity: 0,
    };
    enrichProductData(product);
    expect(product.inStock).toBe(false);
  });

  it('trả về chính productData đã mutate', () => {
    const product = { productImages: [], variants: [], stockQuantity: 0 };
    const result = enrichProductData(product);
    expect(result).toBe(product);
  });

  it('không throw khi nhận object tối giản', () => {
    expect(() => enrichProductData({})).not.toThrow();
  });
});
