/**
 * utils-logic.mutation-kill.test.js
 *
 * Kill mutant: product-helpers (stock/variant logic), localize (FIELD_MAPS + fallback), i18n (t + nested).
 */

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockVariantFindAll = jest.fn();
jest.mock('@models', () => ({ ProductVariant: { findAll: (...a) => mockVariantFindAll(...a) } }));

const ph = require('@utils/product-helpers');
const { localizeEntity, localizeList, FIELD_MAPS } = require('@utils/localize');
const { t } = require('@utils/i18n');
const logger = require('@utils/logger');

beforeEach(() => jest.clearAllMocks());

// ══════════════════════════════════════════════════════════════════════════════
// product-helpers
// ══════════════════════════════════════════════════════════════════════════════

describe('calculateTotalStock', () => {
  it('rỗng/null → 0', () => {
    expect(ph.calculateTotalStock([])).toBe(0);
    expect(ph.calculateTotalStock(null)).toBe(0);
  });
  it('cộng stockQuantity các variant (||0 cho thiếu)', () => {
    expect(ph.calculateTotalStock([{ stockQuantity: 3 }, { stockQuantity: 2 }, {}])).toBe(5);
  });
});

describe('validateVariantAttributes', () => {
  it('không có productAttributes → true', () => {
    expect(ph.validateVariantAttributes([], { color: 'x' })).toBe(true);
    expect(ph.validateVariantAttributes(null, { color: 'x' })).toBe(true);
  });
  it('không có variantAttributes → true', () => {
    expect(ph.validateVariantAttributes([{ name: 'color', values: ['Đỏ'] }], null)).toBe(true);
  });
  it('giá trị variant không nằm trong values → false + log debug', () => {
    expect(
      ph.validateVariantAttributes([{ name: 'color', values: ['Đỏ', 'Xanh'] }], { color: 'Vàng' }),
    ).toBe(false);
    expect(logger.debug).toHaveBeenCalled();
  });
  it('giá trị variant hợp lệ → true', () => {
    expect(ph.validateVariantAttributes([{ name: 'color', values: ['Đỏ'] }], { color: 'Đỏ' })).toBe(
      true,
    );
  });
  it('variant thiếu attr đó → bỏ qua (continue) → true', () => {
    expect(ph.validateVariantAttributes([{ name: 'color', values: ['Đỏ'] }], { size: 'L' })).toBe(
      true,
    );
  });
});

describe('generateVariantSku', () => {
  it('uppercase + strip space + join "-" + prefix', () => {
    expect(ph.generateVariantSku('IP16', { color: 'xanh duong', storage: '128gb' })).toBe(
      'IP16-XANHDUONG-128GB',
    );
  });
  it('strip TẤT CẢ khoảng trắng (regex /\\s/g) — nhiều space', () => {
    expect(ph.generateVariantSku('SKU', { color: 'a  b  c' })).toBe('SKU-ABC');
  });
});

describe('hasVariants', () => {
  it('có variants → true; rỗng → false', () => {
    expect(ph.hasVariants({ variants: [{ id: 1 }] })).toBe(true);
    expect(ph.hasVariants({ variants: [] })).toBe(false);
  });
});

describe('getVariantStock', () => {
  const variants = [
    { attributes: { color: 'Đỏ' }, stockQuantity: 7 },
    { attributes: { color: 'Xanh' }, stockQuantity: 3 },
  ];
  it('khớp attributes → stockQuantity', () => {
    expect(ph.getVariantStock(variants, { color: 'Đỏ' })).toBe(7);
  });
  it('không khớp → 0', () => {
    expect(ph.getVariantStock(variants, { color: 'Vàng' })).toBe(0);
  });
  it('không variants → 0', () => {
    expect(ph.getVariantStock([], { color: 'Đỏ' })).toBe(0);
  });
});

describe('findVariantByAttributes', () => {
  const variants = [{ attributes: { color: 'Đỏ' }, id: 1 }];
  it('khớp → variant', () => {
    expect(ph.findVariantByAttributes(variants, { color: 'Đỏ' }).id).toBe(1);
  });
  it('không variants → null', () => {
    expect(ph.findVariantByAttributes(null, { color: 'Đỏ' })).toBeNull();
  });
  it('chỉ khớp 1/2 attribute → KHÔNG match (every, không phải some)', () => {
    const v = [{ attributes: { color: 'Đỏ', size: 'M' }, id: 1 }];
    expect(ph.findVariantByAttributes(v, { color: 'Đỏ', size: 'L' })).toBeUndefined();
  });
});

describe('enrichProductData', () => {
  it('thumbnail: ưu tiên isThumbnail, inStock từ variant stock', () => {
    const out = ph.enrichProductData({
      productImages: [{ imageUrl: 'a.jpg' }, { imageUrl: 'thumb.jpg', isThumbnail: true }],
      variants: [{ stockQuantity: 2 }],
      stockQuantity: 0,
    });
    expect(out.thumbnail).toBe('thumb.jpg');
    expect(out.inStock).toBe(true);
  });
  it('không có isThumbnail → ảnh đầu tiên; không ảnh → null', () => {
    expect(ph.enrichProductData({ productImages: [{ imageUrl: 'first.jpg' }] }).thumbnail).toBe(
      'first.jpg',
    );
    expect(ph.enrichProductData({}).thumbnail).toBeNull();
  });
  it('inStock false khi cả variant lẫn product stock = 0', () => {
    expect(
      ph.enrichProductData({ variants: [{ stockQuantity: 0 }], stockQuantity: 0 }).inStock,
    ).toBe(false);
  });
});

describe('updateProductTotalStock', () => {
  it('tính tổng từ ProductVariant + Product.update + trả total', async () => {
    mockVariantFindAll.mockResolvedValue([{ stockQuantity: 4 }, { stockQuantity: 6 }]);
    const Product = { update: jest.fn().mockResolvedValue() };
    const total = await ph.updateProductTotalStock(99, Product);
    expect(total).toBe(10);
    expect(Product.update).toHaveBeenCalledWith({ stockQuantity: 10 }, { where: { id: 99 } });
    expect(mockVariantFindAll).toHaveBeenCalledWith({
      where: { productId: 99 },
      attributes: ['stockQuantity'],
    });
  });
  it('lỗi DB → log error (kèm message) + throw', async () => {
    mockVariantFindAll.mockRejectedValue(new Error('db fail'));
    await expect(ph.updateProductTotalStock(1, { update: jest.fn() })).rejects.toThrow('db fail');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('tồn kho'),
      expect.anything(),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// localize
// ══════════════════════════════════════════════════════════════════════════════

describe('localizeEntity', () => {
  it('product vi → field = _vi (fallback _en)', () => {
    const out = localizeEntity(
      { nameVi: 'Tên', nameEn: 'Name', shortDescriptionVi: null, shortDescriptionEn: 'EN' },
      'vi',
      'product',
    );
    expect(out.name).toBe('Tên');
    expect(out.shortDescription).toBe('EN'); // vi null → fallback en
  });

  it('product en → field = _en (fallback _vi)', () => {
    const out = localizeEntity({ nameVi: 'Tên', nameEn: 'Name' }, 'en', 'product');
    expect(out.name).toBe('Name');
  });

  it('cả 5 field product được localize', () => {
    const out = localizeEntity(
      {
        nameVi: 'n',
        descriptionVi: 'd',
        shortDescriptionVi: 's',
        seoTitleVi: 'st',
        seoDescriptionVi: 'sd',
      },
      'vi',
      'product',
    );
    expect(out.name).toBe('n');
    expect(out.description).toBe('d');
    expect(out.shortDescription).toBe('s');
    expect(out.seoTitle).toBe('st');
    expect(out.seoDescription).toBe('sd');
  });

  it('entity null hoặc type không hỗ trợ → trả nguyên', () => {
    expect(localizeEntity(null, 'vi', 'product')).toBeNull();
    expect(localizeEntity({ a: 1 }, 'vi', 'unknown')).toEqual({ a: 1 });
  });

  it('gọi toJSON() nếu là Sequelize instance', () => {
    const inst = { toJSON: () => ({ nameVi: 'fromJSON' }) };
    expect(localizeEntity(inst, 'vi', 'brand').name).toBe('fromJSON');
  });

  it('cả 2 thiếu → null', () => {
    expect(localizeEntity({ nameVi: null, nameEn: null }, 'vi', 'brand').name).toBeNull();
  });

  it('FIELD_MAPS export đủ product/category/brand', () => {
    expect(FIELD_MAPS.product.length).toBe(5);
    expect(FIELD_MAPS.category.length).toBe(2);
    expect(FIELD_MAPS.brand).toEqual([['name', 'nameVi', 'nameEn']]);
  });
});

describe('localizeList', () => {
  it('map từng entity; null → []', () => {
    expect(localizeList([{ nameVi: 'A' }], 'vi', 'brand')[0].name).toBe('A');
    expect(localizeList(null, 'vi', 'brand')).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// i18n
// ══════════════════════════════════════════════════════════════════════════════

describe('t (i18n)', () => {
  it('key tồn tại → trả chuỗi dịch', () => {
    expect(t('ai.messageInvalid', 'vi')).toBe('Tin nhắn không hợp lệ');
  });
  it('key không tồn tại → null', () => {
    expect(t('khong.ton.tai.key', 'vi')).toBeNull();
  });
  it('lang không hỗ trợ → fallback vi', () => {
    expect(t('ai.messageInvalid', 'fr')).toBe('Tin nhắn không hợp lệ');
  });
  it('thay thế {{param}}', () => {
    // dùng key có param: email.otp.subject có {{storeName}}
    expect(t('email.otp.subject', 'vi', { storeName: 'Shop' })).toContain('Shop');
  });
  it('param thiếu → thay bằng ""', () => {
    const out = t('email.otp.subject', 'vi', {});
    expect(out).not.toContain('{{');
  });
});
