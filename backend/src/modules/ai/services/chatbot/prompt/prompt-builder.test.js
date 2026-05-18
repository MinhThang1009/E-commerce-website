/**
 * @file promptBuilder.test.js
 * @description Tests cho promptBuilder.js — phủ lowConfidence branch (line 21)
 *   và null name branch (line 32).
 */

const { createPrompt } = require('./prompt-builder');

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

describe('createPrompt — product list formatting', () => {
  test('trả về chuỗi prompt chứa tên sản phẩm', () => {
    const result = createPrompt('iphone 15', [makeProduct()], {});
    expect(result).toContain('iPhone 15 Pro');
  });

  test('sản phẩm không có trong DB → "(Không tìm thấy sản phẩm nào)"', () => {
    const result = createPrompt('test query', [], {});
    expect(result).toContain('Không tìm thấy');
  });

  // Line 21 — lowConfidence branch
  test('lowConfidence=true → thêm "⚠️[low confidence]" prefix (line 21)', () => {
    const lowConfProduct = makeProduct({ lowConfidence: true });
    const result = createPrompt('test', [lowConfProduct], {});
    expect(result).toContain('⚠️[low confidence]');
  });

  test('lowConfidence=false → không có prefix warning', () => {
    const result = createPrompt('test', [makeProduct({ lowConfidence: false })], {});
    expect(result).not.toContain('⚠️[low confidence]');
  });

  // category || 'Sản phẩm'
  test('product không có category → dùng "Sản phẩm" mặc định', () => {
    const result = createPrompt('test', [makeProduct({ category: null })], {});
    expect(result).toContain('Sản phẩm');
  });

  // shortDescription || 'Mô tả đang cập nhật'
  test('product không có shortDescription → "Mô tả đang cập nhật"', () => {
    const result = createPrompt('test', [makeProduct({ shortDescription: null })], {});
    expect(result).toContain('Mô tả đang cập nhật');
  });

  // inStock false → 'Hết hàng'
  test('inStock=false → hiển thị "Hết hàng"', () => {
    const result = createPrompt('test', [makeProduct({ inStock: false })], {});
    expect(result).toContain('Hết hàng');
  });

  // price ?? basePrice
  test('price=null → dùng basePrice fallback', () => {
    const result = createPrompt('test', [makeProduct({ price: null, basePrice: 25000000 })], {});
    expect(result).toContain('25');
  });

  // Line 32: p.name?.toLowerCase() || '' — null name
  test('product với name=null → dùng "" làm tên (line 32)', () => {
    const products = [makeProduct({ name: null })];
    // Không crash khi name là null
    const result = createPrompt('test query 15', products, {});
    expect(typeof result).toBe('string');
  });
});
