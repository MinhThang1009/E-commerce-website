/**
 * Branch coverage tests cho wishlistService.js
 * Target: line 17-18
 *
 * Line 17: const variantStock = (p.variants || []).reduce(...)
 * Line 18: p.stockQuantity = variantStock || (p.defaultVariant ? p.defaultVariant.stockQuantity : 0)
 *
 * Nhánh cần cover:
 * - variantStock = 0 AND p.defaultVariant = null → 0 từ ternary FALSE branch (line 18)
 *   (p.defaultVariant ? ... : 0) evaluates to `0` khi defaultVariant null
 * - Kèm theo: inStock branch khi cả variantStock và defaultVariant stock đều 0
 */

const WishlistService = require('./wishlistService');

function buildService() {
  const wishlistRepository = {
    findByUserIdWithProducts: jest.fn(),
    findProductById: jest.fn(),
    findItem: jest.fn(),
    createItem: jest.fn().mockResolvedValue(),
    deleteItem: jest.fn().mockResolvedValue(),
    clearByUserId: jest.fn().mockResolvedValue(),
  };
  const service = new WishlistService({
    wishlistRepository,
    eventBus: { publish: jest.fn().mockResolvedValue() },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  });
  return { service, wishlistRepository };
}

// ── Line 18: variantStock = 0, p.defaultVariant = null → ternary FALSE branch ──

describe('getWishlist — line 18: variantStock = 0 và defaultVariant = null → stockQuantity = 0', () => {
  it('stockQuantity = 0 khi variantStock = 0 và defaultVariant null (ternary FALSE branch)', async () => {
    // Line 18: variantStock = 0 (falsy) → (p.defaultVariant ? ... : 0)
    //          p.defaultVariant = null → ternary FALSE → returns 0
    const { service, wishlistRepository } = buildService();

    const productJson = {
      id: 1, name: 'Sản phẩm hết hàng',
      variants: [], // variantStock = reduce([]) = 0
      defaultVariant: null, // null → ternary FALSE → 0
      productImages: [],
    };
    wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
      { Product: { toJSON: () => ({ ...productJson }) } },
    ]);

    const result = await service.getWishlist({ userId: 1 });

    // stockQuantity phải là 0 (từ ternary FALSE branch)
    expect(result.products[0].stockQuantity).toBe(0);
    // inStock cũng phải false (variantStock = 0, defaultVariant = null → 0 > 0 = false)
    expect(result.products[0].inStock).toBe(false);
  });

  it('stockQuantity = 0 khi variants array null/undefined → variantStock = 0 và defaultVariant = null', async () => {
    // Line 17: (p.variants || []) — nếu variants null → dùng []
    // Line 18: variantStock = 0, defaultVariant = null → 0
    const { service, wishlistRepository } = buildService();

    const productJson = {
      id: 2, name: 'SP không có variant',
      variants: null, // null → p.variants || [] = []
      defaultVariant: null,
      productImages: [],
    };
    wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
      { Product: { toJSON: () => ({ ...productJson }) } },
    ]);

    const result = await service.getWishlist({ userId: 1 });

    expect(result.products[0].stockQuantity).toBe(0);
    expect(result.products[0].inStock).toBe(false);
  });

  it('stockQuantity lấy từ defaultVariant khi variantStock = 0 (ternary TRUE branch — để verify rõ)', async () => {
    // Đây là TRUE branch để đối chiếu: defaultVariant tồn tại → stockQuantity từ defaultVariant
    const { service, wishlistRepository } = buildService();

    const productJson = {
      id: 3, name: 'SP có defaultVariant',
      variants: [], // variantStock = 0
      defaultVariant: { stockQuantity: 5 }, // truthy → ternary TRUE → 5
      productImages: [],
    };
    wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
      { Product: { toJSON: () => ({ ...productJson }) } },
    ]);

    const result = await service.getWishlist({ userId: 1 });

    // ternary TRUE: defaultVariant.stockQuantity = 5
    expect(result.products[0].stockQuantity).toBe(5);
    expect(result.products[0].inStock).toBe(true);
  });

  it('inStock FALSE branch: variantStock = 0 và defaultVariant.stockQuantity = 0', async () => {
    // Line 19: inStock = variantStock > 0 || (defaultVariant ? defaultVariant.stock > 0 : false)
    // Khi variantStock = 0, defaultVariant.stockQuantity = 0 → inStock = false
    const { service, wishlistRepository } = buildService();

    const productJson = {
      id: 4, name: 'SP stock = 0',
      variants: [{ stockQuantity: 0 }], // variantStock = 0
      defaultVariant: { stockQuantity: 0 }, // truthy nhưng stock = 0
      productImages: [],
    };
    wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
      { Product: { toJSON: () => ({ ...productJson }) } },
    ]);

    const result = await service.getWishlist({ userId: 1 });

    expect(result.products[0].inStock).toBe(false);
    // stockQuantity = variantStock (0) || defaultVariant.stockQuantity (0) = 0
    expect(result.products[0].stockQuantity).toBe(0);
  });
});
