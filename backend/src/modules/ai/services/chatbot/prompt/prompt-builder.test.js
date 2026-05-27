/**
 * @file promptBuilder.test.js
 * @description Tests cho promptBuilder.js — phủ lowConfidence branch (line 21)
 *   và null name branch (line 32).
 */

const { buildAugmentedPrompt } = require('./prompt-builder');

const makeProduct = (overrides = {}) => ({
  id: 1,
  name: 'iPhone 15 Pro',
  category: 'Điện thoại',
  shortDescription: 'Flagship Apple',
  price: 29990000,
  basePrice: null,
  inStock: true,
  ...overrides,
});

describe('buildAugmentedPrompt — product list formatting', () => {
  test('trả về chuỗi prompt chứa tên sản phẩm', () => {
    const result = buildAugmentedPrompt('iphone 15', [makeProduct()], {});
    expect(result).toContain('iPhone 15 Pro');
  });

  test('sản phẩm không có trong DB → "(Không tìm thấy sản phẩm nào)"', () => {
    const result = buildAugmentedPrompt('test query', [], {});
    expect(result).toContain('Không tìm thấy');
  });

  // Line 21 — lowConfidence branch
  test('lowConfidence=true → thêm "⚠️[low confidence]" prefix (line 21)', () => {
    const lowConfProduct = makeProduct({ lowConfidence: true });
    const result = buildAugmentedPrompt('test', [lowConfProduct], {});
    expect(result).toContain('⚠️[low confidence]');
  });

  test('lowConfidence=false → không có prefix warning', () => {
    const result = buildAugmentedPrompt('test', [makeProduct({ lowConfidence: false })], {});
    expect(result).not.toContain('⚠️[low confidence]');
  });

  // category || 'Sản phẩm'
  test('product không có category → dùng "Sản phẩm" mặc định', () => {
    const result = buildAugmentedPrompt('test', [makeProduct({ category: null })], {});
    expect(result).toContain('Sản phẩm');
  });

  // shortDescription || 'Mô tả đang cập nhật'
  test('product không có shortDescription → "Mô tả đang cập nhật"', () => {
    const result = buildAugmentedPrompt('test', [makeProduct({ shortDescription: null })], {});
    expect(result).toContain('Mô tả đang cập nhật');
  });

  // inStock false → 'Hết hàng'
  test('inStock=false → hiển thị "Hết hàng"', () => {
    const result = buildAugmentedPrompt('test', [makeProduct({ inStock: false })], {});
    expect(result).toContain('Hết hàng');
  });

  // price ?? basePrice
  test('price=null → dùng basePrice fallback', () => {
    const result = buildAugmentedPrompt(
      'test',
      [makeProduct({ price: null, basePrice: 25000000 })],
      {},
    );
    expect(result).toContain('25');
  });

  // Line 32: p.name?.toLowerCase() || '' — null name
  test('product với name=null → dùng "" làm tên (line 32)', () => {
    const products = [makeProduct({ name: null })];
    // Không crash khi name là null
    const result = buildAugmentedPrompt('test query 15', products, {});
    expect(typeof result).toBe('string');
  });

  // Line 54: variants branch — v.stockQuantity > 0 ? còn hàng : hết hàng
  test('product có variants → text chứa "Phiên bản:" và giá từng variant', () => {
    const product = makeProduct({
      variants: [
        { variantName: '128GB', price: 25000000, stockQuantity: 5 },
        { variantName: '256GB', price: 30000000, stockQuantity: 0 },
      ],
    });
    const result = buildAugmentedPrompt('test', [product], {});
    expect(result).toContain('Phiên bản:');
    expect(result).toContain('128GB');
    expect(result).toContain('còn hàng');
    expect(result).toContain('hết hàng');
  });

  test('product có variants với price=null → không hiển thị giá variant', () => {
    const product = makeProduct({
      variants: [{ variantName: 'Basic', price: null, stockQuantity: 3 }],
    });
    const result = buildAugmentedPrompt('test', [product], {});
    expect(result).toContain('Basic');
    expect(result).toContain('còn hàng');
  });

  test('product có ratingAverage > 0 → hiển thị đánh giá', () => {
    const product = makeProduct({ ratingAverage: 4.5 });
    const result = buildAugmentedPrompt('test', [product], {});
    expect(result).toContain('Đánh giá: 4.5/5');
  });

  test('product có ratingAverage = 0 → không hiển thị đánh giá', () => {
    const product = makeProduct({ ratingAverage: 0 });
    const result = buildAugmentedPrompt('test', [product], {});
    expect(result).not.toContain('Đánh giá:');
  });

  test('product có description khác shortDescription → hiển thị mô tả', () => {
    const product = makeProduct({
      shortDescription: 'Ngắn gọn',
      description: 'Mô tả chi tiết dài hơn',
    });
    const result = buildAugmentedPrompt('test', [product], {});
    expect(result).toContain('Mô tả: Mô tả chi tiết dài hơn');
  });

  test('product có specifications → hiển thị thông số', () => {
    const product = makeProduct({ specifications: 'RAM: 8GB | Pin: 4000mAh' });
    const result = buildAugmentedPrompt('test', [product], {});
    expect(result).toContain('Thông số: RAM: 8GB');
  });
});
