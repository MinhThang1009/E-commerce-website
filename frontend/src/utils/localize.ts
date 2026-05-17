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

export function localizeField(obj: Record<string, unknown>, field: string, lang: string): string {
  if (lang === 'en') {
    return obj[`${field}En`] || obj[`${field}Vi`] || obj[field] || '';
  }
  return obj[`${field}Vi`] || obj[field] || '';
}
