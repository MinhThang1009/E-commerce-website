/**
 * @file localize.ts
 * @layer Utility
 * @feature global
 * @description Helper utility function
 */
const VI_EN_COLORS: Record<string, string> = {
  Đen: 'Black',
  Trắng: 'White',
  Bạc: 'Silver',
  Đỏ: 'Red',
  'Xanh dương': 'Blue',
  'Xanh lá': 'Green',
  Vàng: 'Gold',
  Tím: 'Purple',
  Hồng: 'Pink',
  Cam: 'Orange',
  Xám: 'Gray',
  Nâu: 'Brown',
  Xanh: 'Blue',
  'Vàng đồng': 'Champagne Gold',
  'Đen bóng': 'Glossy Black',
  'Trắng ngọc trai': 'Pearl White',
  'Xanh lam': 'Blue',
  'Hồng vàng': 'Rose Gold',
  Titan: 'Titanium',
  'Đen titan': 'Titanium Black',
  'Bạc titan': 'Titanium Silver',
};

export function translateValue(value: string, lang: string): string {
  if (lang !== 'en') return value;
  return VI_EN_COLORS[value] ?? value;
}

// Dùng `object` thay vì `Record<string, unknown>` để chấp nhận mọi kiểu object cụ thể
// (ProductRecommendation, Category, ProductWithVariants, …) mà không cần cast ở call site
export function localizeField(obj: object, field: string, lang: string): string {
  const rec = obj as Record<string, unknown>;
  if (lang === 'en') {
    return String(rec[`${field}En`] ?? rec[`${field}Vi`] ?? rec[field] ?? '');
  }
  return String(rec[`${field}Vi`] ?? rec[field] ?? '');
}
