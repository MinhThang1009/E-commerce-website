/**
 * Final branch coverage tests — nhắm vào các nhánh chưa được cover còn lại.
 *
 * Modules:
 *   - src/modules/cart/services/cartService.js       (lines 71, 248, 324-327, 418)
 *   - src/modules/catalog/services/catalogService.js (lines 344, 356, 419, 526, 539, 548-549, 553, 896)
 *   - src/modules/orders/services/ordersService.js   (line 309)
 *   - src/controllers/payment.js                     (lines 305, 330, 355, 634/636)
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — CartService branches
// ═══════════════════════════════════════════════════════════════════════════

const CartService = require('../modules/cart/services/cartService');

function buildCartService() {
  const cartRepository = {
    findActiveCartByUserId: jest.fn(),
    findActiveCartBySessionId: jest.fn(),
    findOrCreateActiveCartByUserId: jest.fn(),
    findOrCreateActiveCartBySessionId: jest.fn(),
    saveCart: jest.fn((c) => Promise.resolve(c)),
    findCartItemById: jest.fn(),
    findCartItemsByCartId: jest.fn().mockResolvedValue([]),
    findCartItemMatching: jest.fn(),
    createCartItem: jest.fn(),
    saveCartItem: jest.fn((i) => Promise.resolve(i)),
    deleteCartItem: jest.fn().mockResolvedValue(),
    clearCartItems: jest.fn().mockResolvedValue(),
    sumCartItemQuantity: jest.fn(),
    findProductById: jest.fn(),
    findVariantByIdAndProductId: jest.fn(),
    findActiveWarrantyPackagesByIds: jest.fn().mockResolvedValue([]),
    findCartItemsWithDetails: jest.fn().mockResolvedValue([]),
    findCartItemByIdWithCartAndStock: jest.fn(),
    findCartItemsForValidation: jest.fn().mockResolvedValue([]),
    findCartItemsForMerge: jest.fn().mockResolvedValue([]),
    runInTransaction: jest.fn((work) => work({})),
  };
  const eventBus = { publish: jest.fn().mockResolvedValue() };
  const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
  const service = new CartService({ cartRepository, eventBus, logger });
  return { service, cartRepository, logger };
}

// ─── Line 71: FALSE branch của `item.Product ? item.Product.basePrice : 0`
// Cách duy nhất để hit nhánh này là: item.ProductVariant = null (outer false) VÀ item.Product = null.
// Để phân biệt với test đã có (cả 2 null, không có warrantyPackages):
// Ta tạo item có ProductVariant = truthy để dùng variant.price, sau đó item thứ 2 ProductVariant=null, Product=null.
// Theo yêu cầu: "item có ProductVariant nhưng Product = null" → outer ternary lấy variant.price (TRUE branch).
// Còn nhánh FALSE của inner (`item.Product ? ... : 0`) xảy ra khi: ProductVariant=null VÀ Product=null.

describe('CartService._buildCartResponse — line 71: item có ProductVariant truthy nhưng Product null', () => {
  it('price = variant.price khi ProductVariant có giá trị dù Product = null', async () => {
    // Outer ternary TRUE: item.ProductVariant truthy → price = item.ProductVariant.price
    // Inner `(item.Product ? ... : 0)` không được evaluate ở đây
    // Test xác nhận hành vi khi Product null nhưng ProductVariant có giá trị
    const { service, cartRepository } = buildCartService();
    const item = {
      toJSON: () => ({
        id: 50,
        quantity: 3,
        variantId: 10,
        warrantyPackageIds: [],
        Product: null, // Product = null (edge case sau deletion)
        ProductVariant: { price: 75000 }, // ProductVariant có giá trị
      }),
      quantity: 3,
    };
    cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

    const result = await service._buildCartResponse({ id: 1 });

    // price = ProductVariant.price = 75000, quantity = 3 → subtotal = 225000
    expect(result.subtotal).toBe(225000);
    expect(result.totalItems).toBe(3);
  });
});

// ─── Line 248: FALSE branch của `else if (baseStockQuantity < quantity)`
// Condition: cartItem.ProductVariant = null → vào else branch
//            baseStockQuantity (10) >= quantity (5) → KHÔNG throw
// → update thành công

describe('CartService.updateCartItem — line 248 FALSE: ProductVariant null, baseStockQuantity >= quantity', () => {
  it('không ném lỗi khi ProductVariant null và baseStockQuantity đủ cho quantity', async () => {
    // Line 247: ProductVariant null → vào else branch (line 251)
    // Line 251: baseStockQuantity (10) < quantity (5) = FALSE → không throw
    const { service, cartRepository } = buildCartService();

    const cartItem = {
      Cart: { userId: 1 },
      Product: { defaultVariant: { stockQuantity: 10 } },
      ProductVariant: null, // null → else branch tại line 247
      quantity: 1,
    };
    cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue(cartItem);
    cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
    cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

    // quantity=5, baseStockQuantity=10 → 10 < 5 = false → không throw
    await service.updateCartItem({ user: { id: 1 }, itemId: 5, quantity: 5 });

    // Quantity được cập nhật thành công
    expect(cartItem.quantity).toBe(5);
    expect(cartRepository.saveCartItem).toHaveBeenCalledWith(cartItem);
  });
});

// ─── Lines 324-327: FALSE branch của `if (actualQuantity > 0)` trong else branch (không có variantId)
// Condition: không có variantId, baseStockQuantity = 0 (qua guard tại 309)
// Nhưng guard tại 309 check: `!product || (baseStockQuantity <= 0 && !variantId)` → continue (skip)
// Để hit line 323-327: cần baseStockQuantity > 0 (qua guard) nhưng sau Math.min = 0
// Thực tế: nếu baseStockQuantity > 0, Math.min(quantity, baseStockQuantity) > 0 luôn luôn
// → actualQuantity = 0 chỉ khi quantity = 0 (edge case)
// Hoặc: product tồn tại, baseStockQuantity = 0 nhưng có variantId khác → guard bị bypass vì variantId truthy
// → vào if(variantId) branch thay vì else → không vào else path
//
// Cách hit FALSE của actualQuantity > 0 ở else path: truyền quantity = 0
// Guard tại 309: !product = false, baseStockQuantity=0, !variantId=true → (0<=0 && true) = true → continue
// Để bypass guard: cần baseStockQuantity > 0
// Nếu baseStockQuantity > 0 và quantity = 0 → Math.min(0, N) = 0 → actualQuantity = 0 → false branch

describe('CartService.syncCart — lines 324-327 FALSE: actualQuantity = 0 (quantity=0, no variant)', () => {
  it('không tạo cart item khi quantity = 0 (actualQuantity = Math.min(0, N) = 0)', async () => {
    // baseStockQuantity = 5 > 0 (qua guard tại 309)
    // variantId = null (vào else branch tại line 322)
    // actualQuantity = Math.min(0, 5) = 0 → if(0) = false → không gọi createCartItem
    const { service, cartRepository } = buildCartService();
    cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
    cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });
    cartRepository.findProductById.mockResolvedValue({
      id: 1,
      basePrice: 80000,
      defaultVariant: { stockQuantity: 5 }, // > 0 để qua guard
    });

    await service.syncCart({
      user: { id: 1 },
      items: [{ productId: 1, quantity: 0 }], // quantity = 0 → actualQuantity = 0
    });

    // actualQuantity = 0 → if(actualQuantity > 0) = false → không tạo
    expect(cartRepository.createCartItem).not.toHaveBeenCalled();
  });

  it('không tạo cart item khi product không có defaultVariant và không có variantId (actualQuantity = 0)', async () => {
    // baseStockQuantity = 0, !variantId = true → guard tại 309: (0<=0 && true) = true → continue
    // item bị skip hoàn toàn (guard, không đến actualQuantity check)
    const { service, cartRepository } = buildCartService();
    cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
    cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });
    cartRepository.findProductById.mockResolvedValue({
      id: 2,
      basePrice: 50000,
      defaultVariant: null, // defaultVariant null → baseStockQuantity = 0
    });

    await service.syncCart({
      user: { id: 1 },
      items: [{ productId: 2, quantity: 3 }], // không có variantId
    });

    // Guard pass → continue → không tạo item
    expect(cartRepository.createCartItem).not.toHaveBeenCalled();
  });
});

// ─── Line 418: FALSE branch của `item.ProductVariant ? price : item.Product.basePrice`
// Condition: item.ProductVariant = null → currentPrice = item.Product.basePrice

describe('CartService.validateCart — line 418 FALSE: item không có ProductVariant', () => {
  it('currentPrice = item.Product.basePrice khi ProductVariant null', async () => {
    // Line 417: item.ProductVariant = null → (false) → item.Product.basePrice
    const { service, cartRepository } = buildCartService();
    cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 1 });
    cartRepository.findCartItemsForValidation.mockResolvedValue([
      {
        id: 10,
        productId: 5,
        variantId: null,
        unitPrice: 120000,
        quantity: 2,
        Product: {
          id: 5,
          name: 'Bàn phím cơ',
          basePrice: 120000, // currentPrice sẽ = basePrice
          defaultVariant: { stockQuantity: 8 },
        },
        ProductVariant: null, // FALSE branch tại line 417
      },
    ]);

    const result = await service.validateCart({ user: { id: 1 } });

    // currentPrice = Product.basePrice = 120000
    expect(result.items[0].currentPrice).toBe(120000);
    // name = Product.name (không có variant prefix)
    expect(result.items[0].name).toBe('Bàn phím cơ');
    // priceChanged = false vì unitPrice = currentPrice
    expect(result.items[0].priceChanged).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — CatalogService branches
// ═══════════════════════════════════════════════════════════════════════════

const CatalogService = require('../modules/catalog/services/catalogService');

function makeProductRow(overrides = {}) {
  const data = {
    id: 1,
    name: 'Test Product',
    slug: 'test-product',
    basePrice: '10000000',
    compareAtPrice: null,
    stockQuantity: 10,
    isFeatured: false,
    productImages: [],
    variants: [],
    categories: [],
    reviews: [],
    ...overrides,
  };
  return { ...data, toJSON: () => ({ ...data }) };
}

function makeCatalogService(repoOverrides = {}, cacheOverrides = undefined) {
  const catalogRepository = {
    findAllCategoriesSorted: jest.fn().mockResolvedValue([]),
    getCategoryProductCounts: jest.fn().mockResolvedValue({}),
    findCategoryById: jest.fn().mockResolvedValue(null),
    findCategoryByIdOrSlug: jest.fn().mockResolvedValue(null),
    findCategoryBySlug: jest.fn().mockResolvedValue(null),
    createCategory: jest.fn().mockResolvedValue({ id: 1 }),
    saveCategory: jest.fn().mockResolvedValue(),
    deleteCategory: jest.fn().mockResolvedValue(),
    countProductsByCategoryId: jest.fn().mockResolvedValue(0),
    findProductsByCategoryId: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findAllBrands: jest.fn().mockResolvedValue([]),
    findBrandIdsByCategoryId: jest.fn().mockResolvedValue([]),
    findBrandById: jest.fn().mockResolvedValue(null),
    findBrandBySlug: jest.fn().mockResolvedValue(null),
    createBrand: jest.fn().mockResolvedValue({ id: 1 }),
    saveBrand: jest.fn().mockResolvedValue(),
    deleteBrand: jest.fn().mockResolvedValue(),
    countProductsByBrandId: jest.fn().mockResolvedValue(0),
    findProductsByBrandId: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findAllCollections: jest.fn().mockResolvedValue([]),
    findCollectionById: jest.fn().mockResolvedValue(null),
    findCollectionBySlug: jest.fn().mockResolvedValue(null),
    createCollection: jest.fn().mockResolvedValue({ id: 1 }),
    saveCollection: jest.fn().mockResolvedValue(),
    deleteCollection: jest.fn().mockResolvedValue(),
    setCollectionProducts: jest.fn().mockResolvedValue(),
    findProductsByCollectionId: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findProductsList: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findProductByIdWithFullDetails: jest.fn().mockResolvedValue(null),
    findProductBySlugWithFullDetails: jest.fn().mockResolvedValue(null),
    findProductByPk: jest.fn().mockResolvedValue(null),
    findFeaturedProducts: jest.fn().mockResolvedValue([]),
    findRelatedProducts: jest.fn().mockResolvedValue([]),
    findRelatedProductsFallback: jest.fn().mockResolvedValue([]),
    searchProducts: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findProductSuggestions: jest.fn().mockResolvedValue([]),
    findNewArrivals: jest.fn().mockResolvedValue([]),
    findBestSellersRaw: jest.fn().mockResolvedValue([]),
    findProductsByIdsOrdered: jest.fn().mockResolvedValue([]),
    findDeals: jest.fn().mockResolvedValue([]),
    findProductVariantsByProductId: jest.fn().mockResolvedValue([]),
    findProductRatingsRows: jest.fn().mockResolvedValue([]),
    getProductPriceRange: jest.fn().mockResolvedValue({ min: 0, max: 0 }),
    findAttributeValuesByName: jest.fn().mockResolvedValue([]),
    findOtherAttributes: jest.fn().mockResolvedValue([]),
    findRecentlyViewedByUser: jest.fn().mockResolvedValue([]),
    upsertRecentlyViewed: jest.fn().mockResolvedValue(),
    pruneRecentlyViewed: jest.fn().mockResolvedValue(),
    createProduct: jest.fn().mockResolvedValue({ id: 1 }),
    saveProduct: jest.fn().mockResolvedValue(),
    deleteProduct: jest.fn().mockResolvedValue(),
    findCategoriesByIds: jest.fn().mockResolvedValue([]),
    setProductCategories: jest.fn().mockResolvedValue(),
    createProductSpecifications: jest.fn().mockResolvedValue(),
    createProductAttributes: jest.fn().mockResolvedValue(),
    clearProductAttributes: jest.fn().mockResolvedValue(),
    createProductVariants: jest.fn().mockResolvedValue(),
    clearProductVariants: jest.fn().mockResolvedValue(),
    findWarrantyPackagesByIds: jest.fn().mockResolvedValue([]),
    setProductWarrantyPackages: jest.fn().mockResolvedValue(),
    runInTransaction: jest.fn((fn) => fn({})),
    ...repoOverrides,
  };

  const cacheStore =
    cacheOverrides !== undefined
      ? cacheOverrides
      : {
          get: jest.fn().mockResolvedValue(null),
          setEx: jest.fn().mockResolvedValue(),
          del: jest.fn().mockResolvedValue(),
          delPattern: jest.fn().mockResolvedValue(),
          delMany: jest.fn().mockResolvedValue(),
        };

  const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
  const service = new CatalogService({
    catalogRepository,
    cacheStore,
    eventBus: { publish: jest.fn() },
    logger,
  });

  return { service, catalogRepository, cacheStore, logger };
}

// ─── Line 344: `|| basePrice` path — `sorted[0].price = null` → NaN → fallback basePrice

describe('CatalogService._pickDisplayPrice — line 344: sorted[0].price = null → NaN || basePrice', () => {
  it('trả về basePrice khi variant đầu tiên sau sort có price = null', () => {
    // variants: [{price: null}, {price: 5000}]
    // sorted by parseFloat: NaN (null) và 5000
    // sort(NaN - 5000) → undefined order, nhưng sorted[0] có thể là null-price variant
    // parseFloat(null) = NaN → falsy → || basePrice
    const { service } = makeCatalogService();

    // Để đảm bảo sorted[0].price = null: chỉ có 1 variant với price = null
    const result = service._pickDisplayPrice({
      basePrice: '9000000',
      variants: [{ price: null }], // sorted[0].price = null → parseFloat(null) = NaN → || basePrice
    });

    // NaN || 9000000 = 9000000
    expect(result).toBe(9000000);
  });

  it('trả về basePrice khi variant đầu tiên có price = 0 (falsy)', () => {
    // parseFloat(0) = 0 → falsy → || basePrice
    const { service } = makeCatalogService();

    const result = service._pickDisplayPrice({
      basePrice: '5000000',
      variants: [{ price: 0 }, { price: '8000000' }],
    });

    // sorted[0] = price:0 (nhỏ nhất) → 0 || 5000000 = 5000000
    expect(result).toBe(5000000);
  });
});

// ─── Line 356: `_clearProductCache` catch — `delPattern` throws → logger.warn

describe('CatalogService._clearProductCache — line 356: delPattern throw → logger.warn', () => {
  it('log warn khi cacheStore.delPattern throw, không crash', async () => {
    const warnFn = jest.fn();
    const cacheWithThrow = {
      get: jest.fn().mockResolvedValue(null),
      setEx: jest.fn().mockResolvedValue(),
      del: jest.fn().mockResolvedValue(),
      delPattern: jest.fn().mockRejectedValue(new Error('Redis connection lost')),
      delMany: jest.fn().mockResolvedValue(),
    };
    const service = new CatalogService({
      catalogRepository: { findProductsList: jest.fn().mockResolvedValue({ count: 0, rows: [] }) },
      cacheStore: cacheWithThrow,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: warnFn },
    });

    // Không throw — error được catch bên trong
    await expect(service._clearProductCache(10, 'my-product')).resolves.toBeUndefined();

    // logger.warn được gọi với message chứa 'clearProductCache'
    expect(warnFn).toHaveBeenCalledWith(
      expect.stringContaining('clearProductCache'),
      expect.any(String),
    );
  });
});

// ─── Line 419: `else if (cSlugs.length > 0)` TRUE branch
// Condition: collection chỉ gồm non-numeric slugs → cIds=[], cSlugs=['electronics'] → collectionSlugsIn set

describe('CatalogService.getAllProducts — line 419: collection slug array (cSlugs.length > 0)', () => {
  it('collectionSlugsIn được set khi collection chỉ gồm slug strings', async () => {
    // collection = ['electronics'] → cIds=[] (không numeric), cSlugs=['electronics']
    // cIds.length = 0 → không set collectionIdsIn
    // else if (cSlugs.length > 0) → TRUE → set collectionSlugsIn
    const { service, catalogRepository } = makeCatalogService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({ collection: ['electronics'] });

    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ collectionSlugsIn: ['electronics'] }),
      }),
    );
  });

  it('collectionSlugsIn set với nhiều slugs', async () => {
    const { service, catalogRepository } = makeCatalogService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({ collection: ['summer-sale', 'new-arrival'] });

    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({
          collectionSlugsIn: expect.arrayContaining(['summer-sale', 'new-arrival']),
        }),
      }),
    );
  });
});

// ─── Line 526: `compareAtPrice: parseFloat(productJson.compareAtPrice) || null`
// FALSE path: compareAtPrice = 0 → parseFloat(0) = 0 → falsy → || null = null

describe('CatalogService._buildProductDetailResponse — line 526: compareAtPrice = 0 → null', () => {
  it('compareAtPrice = null khi productJson.compareAtPrice = 0', () => {
    // parseFloat(0) = 0 → falsy → 0 || null = null
    const { service } = makeCatalogService();
    const data = {
      id: 101,
      name: 'Sản phẩm A',
      slug: 'san-pham-a',
      basePrice: '5000000',
      compareAtPrice: 0, // 0 → parseFloat = 0 → || null = null
      stockQuantity: 5,
      isFeatured: false,
      productImages: [],
      variants: [],
      categories: [],
      reviews: [],
    };
    const product = { ...data, toJSON: () => ({ ...data }) };

    const result = service._buildProductDetailResponse(product, {});

    expect(result.compareAtPrice).toBeNull();
  });

  it('compareAtPrice = null khi productJson.compareAtPrice = null', () => {
    // parseFloat(null) = NaN → falsy → NaN || null = null
    const { service } = makeCatalogService();
    const product = makeProductRow({
      id: 102,
      compareAtPrice: null,
      variants: [],
      reviews: [],
    });

    const result = service._buildProductDetailResponse(product, {});

    expect(result.compareAtPrice).toBeNull();
  });
});

// ─── Line 539: FALSE branch của `if (!selectedVariant && normColor)`
// Condition: selectedVariant đã được tìm thấy bằng skuId (truthy) VÀ normColor cũng có giá trị
// → `!selectedVariant` = false → không vào color search (skip)

describe('CatalogService._buildProductDetailResponse — line 539 FALSE: selectedVariant found by skuId, normColor present', () => {
  it('không vào color search khi selectedVariant đã được tìm bằng skuId (dù normColor có giá trị)', () => {
    // skuId match → selectedVariant = variant id=10 (truthy)
    // queryColor = 'đỏ' → normColor truthy
    // Line 537: if (!selectedVariant && normColor) → !truthy && truthy → false → bỏ qua color search
    const { service } = makeCatalogService();
    const product = makeProductRow({
      id: 200,
      name: 'Balo X',
      basePrice: '500000',
      reviews: [],
      variants: [
        {
          id: 10,
          price: '500000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đỏ',
          isDefault: false,
          attributes: { color: 'đỏ' },
          sku: 'SKU-DO',
          specifications: {},
        },
        {
          id: 11,
          price: '600000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'Xanh',
          isDefault: true,
          attributes: { color: 'xanh' },
          sku: 'SKU-XANH',
          specifications: {},
        },
      ],
    });

    // skuId='10' → chọn variant id=10; queryColor='xanh' → normColor='xanh' (khác với variant đã chọn)
    // Nhưng vì selectedVariant đã có từ skuId → !selectedVariant = false → không vào color search
    const result = service._buildProductDetailResponse(product, {
      skuId: '10',
      queryColor: 'xanh',
    });

    // Variant được chọn phải là id=10 (từ skuId), không phải id=11 (từ normColor)
    expect(result.sku).toBe('SKU-DO');
  });
});

// ─── Lines 548-549: `if (!selectedVariant)` TRUE branch → fallback `variants.find(isDefault) || variants[0]`
// Condition: normColor không match bất kỳ variant nào → selectedVariant = null
// → `variants.find(isDefault) || variants[0]` được dùng

describe('CatalogService._buildProductDetailResponse — lines 548-549: normColor miss → fallback isDefault', () => {
  it('chọn variant isDefault khi normColor không match bất kỳ variant nào', () => {
    // queryColor = 'màu không tồn tại' → không match → selectedVariant = null sau color search
    // Line 544: variants.find(v => v.isDefault === true || v.isDefault === 1) → id=20 (isDefault=true)
    const { service } = makeCatalogService();
    const product = makeProductRow({
      id: 201,
      name: 'Giày thể thao',
      basePrice: '1200000',
      reviews: [],
      variants: [
        {
          id: 19,
          price: '1200000',
          compareAtPrice: null,
          stockQuantity: 4,
          variantName: 'Đen',
          isDefault: false,
          attributes: { color: 'đen' },
          sku: 'SKU-19',
          specifications: {},
        },
        {
          id: 20,
          price: '1300000',
          compareAtPrice: null,
          stockQuantity: 2,
          variantName: 'Trắng',
          isDefault: true, // isDefault=true → được chọn khi color miss
          attributes: { color: 'trắng' },
          sku: 'SKU-20',
          specifications: {},
        },
      ],
    });

    // queryColor = 'vàng' → không match 'đen' hay 'trắng' → normColor miss → fallback isDefault
    const result = service._buildProductDetailResponse(product, { queryColor: 'vàng' });

    expect(result.sku).toBe('SKU-20'); // isDefault=true variant được chọn
  });

  it('fallback sang variants[0] khi normColor miss và không có isDefault', () => {
    // Không có variant nào có isDefault=true → variants[0] được chọn
    const { service } = makeCatalogService();
    const product = makeProductRow({
      id: 202,
      name: 'Túi du lịch',
      basePrice: '800000',
      reviews: [],
      variants: [
        {
          id: 30,
          price: '800000',
          compareAtPrice: null,
          stockQuantity: 6,
          variantName: 'Xanh navy',
          isDefault: false,
          attributes: { color: 'xanh navy' },
          sku: 'SKU-30',
          specifications: {},
        },
        {
          id: 31,
          price: '850000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'Xám',
          isDefault: false,
          attributes: { color: 'xám' },
          sku: 'SKU-31',
          specifications: {},
        },
      ],
    });

    // queryColor = 'hồng' → không match → fallback: find(isDefault) = undefined → || variants[0]
    const result = service._buildProductDetailResponse(product, { queryColor: 'hồng' });

    expect(result.sku).toBe('SKU-30'); // variants[0] được chọn
  });
});

// ─── Line 553: `if (selectedVariant)` TRUE branch — selectedVariant không null → process attrs
// Đây là phần trong block sau khi selectedVariant được set. Thực tế mọi test với variants
// đều hit branch này, nhưng để đảm bảo chắc chắn:

describe('CatalogService._buildProductDetailResponse — line 553: selectedVariant truthy → process attrs', () => {
  it('isVariantProduct = true khi selectedVariant được chọn (line 553 TRUE branch)', () => {
    // Line 548: selectedVariant truthy (tìm theo isDefault) → if(selectedVariant) → TRUE
    // → isVariantProduct = true, attrs được extract
    const { service } = makeCatalogService();
    const product = makeProductRow({
      id: 203,
      name: 'Áo thun',
      basePrice: '300000',
      reviews: [],
      variants: [
        {
          id: 40,
          price: '300000',
          compareAtPrice: null,
          stockQuantity: 10,
          variantName: 'M - Đen',
          isDefault: true,
          attributes: { color: 'đen', size: 'M' },
          sku: 'SKU-M-DEN',
          specifications: {},
        },
      ],
    });

    // Không truyền skuId hay queryColor → selectedVariant = isDefault variant
    const result = service._buildProductDetailResponse(product, {});

    // selectedVariant truthy → isVariantProduct = true (line 553 TRUE branch)
    expect(result.isVariantProduct).toBe(true);
    expect(result.sku).toBe('SKU-M-DEN');
    expect(result.currentVariant).toBeDefined();
  });
});

// ─── Line 896: `v.name || v.variantName || v.displayName` — full fallback chain
// Condition: v.name = null, v.variantName = null → uses v.displayName

describe('CatalogService.createProduct — line 896: variant name fallback → v.displayName', () => {
  it('dùng v.displayName khi v.name và v.variantName đều null/undefined', async () => {
    // Line 895: name: v.name || v.variantName || v.displayName
    // v.name = null, v.variantName = null → || v.displayName = 'Bản mặc định'
    const { service, catalogRepository } = makeCatalogService();
    catalogRepository.createProduct.mockResolvedValue({ id: 500 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 500 }));

    await service.createProduct({
      payload: {
        name: 'Sản phẩm test displayName',
        price: 10000,
        variants: [
          {
            price: 10000,
            stockQuantity: 5,
            name: null, // null → fallback
            variantName: null, // null → fallback
            displayName: 'Bản mặc định', // final fallback
          },
        ],
      },
    });

    expect(catalogRepository.createProductVariants).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Bản mặc định' })]),
      expect.any(Object),
    );
  });

  it('dùng v.variantName khi v.name = null nhưng v.variantName có giá trị', async () => {
    // Line 895: v.name = null → || v.variantName = 'Đỏ L'
    const { service, catalogRepository } = makeCatalogService();
    catalogRepository.createProduct.mockResolvedValue({ id: 501 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 501 }));

    await service.createProduct({
      payload: {
        name: 'Sản phẩm test variantName',
        price: 8000,
        variants: [
          {
            price: 8000,
            stockQuantity: 3,
            name: null,
            variantName: 'Đỏ L', // second in chain
            displayName: 'Fallback không dùng',
          },
        ],
      },
    });

    expect(catalogRepository.createProductVariants).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Đỏ L' })]),
      expect.any(Object),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — OrdersService branches
// ═══════════════════════════════════════════════════════════════════════════

const OrdersService = require('../modules/orders/services/ordersService');

const CONSTANTS = {
  POINTS_EARN_RATE: 1000,
  POINTS_VALUE: 100,
  SHIPPING_FREE_THRESHOLD: 500000,
  SHIPPING_BASE_RATE: 30000,
  SHIPPING_WEIGHT_RATE: 5000,
};

function buildOrdersService() {
  const repo = {
    runInTransaction: jest.fn(async (work) => work({})),
    findProductWithDefaultVariant: jest.fn(),
    findVariantBasic: jest.fn(),
    lockProduct: jest.fn(),
    lockVariant: jest.fn(),
    decrementProductStock: jest.fn().mockResolvedValue(),
    decrementVariantStock: jest.fn().mockResolvedValue(),
    restoreProductStock: jest.fn().mockResolvedValue(),
    restoreVariantStock: jest.fn().mockResolvedValue(),
    findActiveWarrantyPackagesByIds: jest.fn().mockResolvedValue([]),
    findOrCreateActiveCart: jest.fn(),
    findActiveCartBySessionId: jest.fn().mockResolvedValue(null),
    findCartByPkWithItemsDetails: jest.fn(),
    findCartItemMatching: jest.fn().mockResolvedValue(null),
    saveCartItem: jest.fn().mockResolvedValue(),
    deleteCartItem: jest.fn().mockResolvedValue(),
    saveCart: jest.fn().mockResolvedValue(),
    findActiveCartsByUser: jest.fn().mockResolvedValue([]),
    clearCartItems: jest.fn().mockResolvedValue(),
    findActiveDiscountCode: jest.fn().mockResolvedValue(null),
    incrementDiscountCodeUsage: jest.fn().mockResolvedValue(),
    findUserById: jest.fn(),
    updateUserPoints: jest.fn().mockResolvedValue(),
    createLoyaltyHistory: jest.fn().mockResolvedValue(),
    updateLoyaltyHistoryOrderId: jest.fn().mockResolvedValue(),
    createOrder: jest.fn(),
    createOrderItem: jest.fn(),
    createInventoryLogs: jest.fn().mockResolvedValue(),
    saveOrder: jest.fn(async (o) => o),
    cancelPendingOrdersByUser: jest.fn().mockResolvedValue(),
    findUserOrdersWithItems: jest.fn(),
    findOrderByPkWithItemsAndUser: jest.fn(),
    findOrderByNumberAndUserId: jest.fn(),
    findOrderForCancel: jest.fn(),
    findOrderByNumberWithUserEmail: jest.fn(),
    findOrderByIdAndUserId: jest.fn(),
    findAllOrdersWithUser: jest.fn(),
  };

  const emailGateway = {
    sendOrderConfirmationEmail: jest.fn().mockResolvedValue(),
    sendOrderCancellationEmail: jest.fn().mockResolvedValue(),
    sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(),
  };

  const eventBus = { publish: jest.fn().mockResolvedValue() };
  const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

  const service = new OrdersService({
    ordersRepository: repo,
    emailGateway,
    eventBus,
    logger,
    constants: CONSTANTS,
  });

  return { service, repo, emailGateway, eventBus, logger };
}

function mkOrderProduct(overrides = {}) {
  return {
    id: 1,
    name: 'Sản phẩm A',
    basePrice: 100000,
    status: 'active',
    thumbnail: 'img.jpg',
    stockQuantity: 10,
    ...overrides,
  };
}

function mkOrderBody(overrides = {}) {
  return {
    shippingFirstName: 'Anh',
    shippingLastName: 'Nguyen',
    shippingCompany: null,
    shippingAddress1: '123 Lê Lợi',
    shippingAddress2: null,
    shippingCity: 'HCM',
    shippingState: null,
    shippingZip: '70000',
    shippingCountry: 'VN',
    shippingPhone: '0901234567',
    billingFirstName: 'Anh',
    billingLastName: 'Nguyen',
    billingCompany: null,
    billingAddress1: '123 Lê Lợi',
    billingAddress2: null,
    billingCity: 'HCM',
    billingState: null,
    billingZip: '70000',
    billingCountry: 'VN',
    billingPhone: '0901234567',
    paymentMethod: 'cod',
    notes: null,
    discountCode: null,
    pointsToUse: 0,
    ...overrides,
  };
}

// ─── Line 309: `if (pendingInventoryLogs.length > 0)` TRUE branch
// Condition: items có productId → pendingInventoryLogs được push → length > 0 → createInventoryLogs

describe('OrdersService.createOrder — line 309 TRUE: pendingInventoryLogs.length > 0 → createInventoryLogs', () => {
  it('gọi createInventoryLogs với orderId đúng khi có item không có variantId', async () => {
    // Buy-now flow với 1 item không có variantId:
    // → lockProduct path → pushes vào pendingInventoryLogs
    // → line 309: pendingInventoryLogs.length > 0 (TRUE) → createInventoryLogs được gọi
    const { service, repo } = buildOrdersService();

    const product = mkOrderProduct({ id: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 15 });

    const createdOrder = {
      id: 777,
      number: 'ORD-INVLOG-01',
      status: 'pending',
      total: 130000,
      userId: 1,
      createdAt: new Date(),
    };
    const createdItem = {
      id: 777,
      orderId: 777,
      productId: 5,
      variantId: null,
      name: 'Sản phẩm A',
      quantity: 2,
      unitPrice: 100000,
      subtotal: 200000,
    };
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue(createdItem);

    const user = { id: 1, email: 'user@test.com' };
    // items không có variantId → lockProduct → tạo inventory log
    const body = mkOrderBody({ items: [{ productId: 5, quantity: 2 }] });

    await service.createOrder({ user, body, sessionIdCookie: null });

    // Verify createInventoryLogs được gọi (line 309 TRUE branch)
    expect(repo.createInventoryLogs).toHaveBeenCalled();

    // Verify log có đủ thông tin và orderId được gán
    const logCall = repo.createInventoryLogs.mock.calls[0][0];
    expect(logCall).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orderId: 777, // orderId từ created order
          productId: 5,
          changeType: 'sale',
          changeAmount: -2, // âm vì là bán hàng
        }),
      ]),
    );
  });

  it('gọi createInventoryLogs với variantId khi item có variant', async () => {
    // Buy-now flow với variantId → lockVariant path → pushes log với variantId
    // → line 309 TRUE → createInventoryLogs
    const { service, repo } = buildOrdersService();

    const product = mkOrderProduct({ id: 6 });
    const variant = {
      id: 20,
      name: 'Đỏ/M',
      sku: 'SKU-020',
      price: 150000,
      weight: '0.3',
      stockQuantity: 8,
    };
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.findVariantBasic.mockResolvedValue(variant);
    repo.lockVariant.mockResolvedValue({ ...variant, stockQuantity: 8 });

    const createdOrder = {
      id: 888,
      number: 'ORD-VARLOG-01',
      status: 'pending',
      total: 180000,
      userId: 1,
      createdAt: new Date(),
    };
    const createdItem = { id: 888, orderId: 888 };
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue(createdItem);

    const user = { id: 1, email: 'user@test.com' };
    const body = mkOrderBody({ items: [{ productId: 6, variantId: 20, quantity: 1 }] });

    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createInventoryLogs).toHaveBeenCalled();
    const logCall = repo.createInventoryLogs.mock.calls[0][0];
    expect(logCall).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orderId: 888,
          productId: 6,
          variantId: 20,
          changeType: 'sale',
        }),
      ]),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — Payment controller branches
// ═══════════════════════════════════════════════════════════════════════════

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-final-branch';
process.env.FRONTEND_URL = 'https://shop.test';
process.env.SEPAY_API_KEY = 'test-sepay-api-key-final';

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../middlewares/rateLimiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, res, next) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { id: 1, role: 'admin' };
      return next();
    }
    return res.status(401).json({ status: 'fail', message: 'Chưa xác thực' });
  },
  optionalAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('../middlewares/adminAuth', () => ({
  adminAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('../shared/adminAudit', () => ({
  AdminAuditService: { logAction: jest.fn(), logSuccessfulLogin: jest.fn() },
  auditMiddleware: (_req, _res, next) => next(),
}));

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('../config/sequelize', () => ({
  define: jest.fn().mockReturnValue(class MockModel {}),
  fn: jest.fn(),
  col: jest.fn(),
  where: jest.fn(),
  literal: jest.fn(),
  query: jest.fn().mockResolvedValue([]),
  transaction: jest.fn().mockImplementation(async (cb) => {
    if (typeof cb === 'function') return cb({ LOCK: { UPDATE: 'UPDATE' } });
    return { LOCK: { UPDATE: 'UPDATE' }, commit: jest.fn(), rollback: jest.fn() };
  }),
}));

let mockFinalOrderFindByPk = jest.fn();
let mockFinalOrderFindOne = jest.fn();
let mockFinalOrderUpdate = jest.fn();
let mockFinalDiscountCodeFindByPk = jest.fn();
let mockFinalDiscountCodeIncrement = jest.fn();
let mockFinalCartFindAll = jest.fn();
let mockFinalCartItemDestroy = jest.fn();

jest.mock('../models', () => {
  const sequelizePkg = require('sequelize');
  return {
    Order: {
      findByPk: (...args) => mockFinalOrderFindByPk(...args),
      findOne: (...args) => mockFinalOrderFindOne(...args),
      update: (...args) => mockFinalOrderUpdate(...args),
      findAll: jest.fn().mockResolvedValue([]),
    },
    OrderItem: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
    },
    User: {
      findByPk: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    Cart: {
      findAll: (...args) => mockFinalCartFindAll(...args),
      findOne: jest.fn().mockResolvedValue(null),
    },
    CartItem: {
      destroy: (...args) => mockFinalCartItemDestroy(...args),
    },
    DiscountCode: {
      findByPk: (...args) => mockFinalDiscountCodeFindByPk(...args),
      increment: (...args) => mockFinalDiscountCodeIncrement(...args),
    },
    Product: { findByPk: jest.fn().mockResolvedValue(null) },
    ProductVariant: { findByPk: jest.fn().mockResolvedValue(null) },
    sequelize: {
      transaction: jest
        .fn()
        .mockImplementation(async (cb) =>
          typeof cb === 'function' ? cb({ LOCK: { UPDATE: 'UPDATE' } }) : {},
        ),
      fn: jest.fn(),
      col: jest.fn(),
      where: jest.fn(),
      literal: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
    },
    Op: sequelizePkg.Op,
  };
});

jest.mock('../modules/payment/services/momoService', () => ({
  createPaymentUrl: jest.fn(),
  verifySignature: jest.fn(),
}));

jest.mock('../modules/payment/services/vnpayService', () => ({
  createPaymentUrl: jest.fn().mockReturnValue('https://vnpay.test/pay'),
  verifyReturnUrl: jest.fn(),
  refund: jest.fn(),
}));

jest.mock('../services/email', () => ({
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/productHelpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(0),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-TEST'),
}));

const express = require('express');
const supertest = require('supertest');
