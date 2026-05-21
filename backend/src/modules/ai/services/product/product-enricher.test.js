/**
 * Tests cho enrichProductData — tính thumbnail và inStock từ product associations.
 */
const { enrichProductData } = require('./product-enricher');

describe('enrichProductData', () => {
  // ── thumbnail ──────────────────────────────────────────────────────────────

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

  // ── inStock ────────────────────────────────────────────────────────────────

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

  // ── return value ───────────────────────────────────────────────────────────

  it('trả về chính productData đã mutate', () => {
    const product = { productImages: [], variants: [], stockQuantity: 0 };
    const result = enrichProductData(product);
    expect(result).toBe(product);
  });

  it('không throw khi nhận object tối giản', () => {
    expect(() => enrichProductData({})).not.toThrow();
  });
});
