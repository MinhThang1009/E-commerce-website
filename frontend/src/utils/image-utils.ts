/**
 * @file imageUtils.ts
 * @layer Utility
 * @feature global
 * @description Helper utility function
 */

const IMAGE_CONFIG = {
  FALLBACK_CATEGORY_IMAGE: 'https://placehold.co/800x600/e2e8f0/1e293b',
  CATEGORY_IMAGES: {
    'dien-thoai':
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/42/342667/iphone-17-xanh-6-638930798970669098-750x500.jpg',
    laptop:
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/44/358086/macbook-pro-14-inch-m5-16gb-512gb-thumb-638962954605863722-600x600.jpg',
    smartwatch:
      'https://cdn.tgdd.vn/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-den-tb-600x600.jpg',
    tablet: 'https://cdn.tgdd.vn/Products/Images/522/335311/ipad-11-5g-sliver-thumb-600x600.jpg',
    'dong-ho':
      'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-thumb-600x600.jpg',
    'phu-kien': 'https://cdn.tgdd.vn/Products/Images/7077/336899/mi-band-10-den-600x600.jpg',
  } as Record<string, string>,
} as const;

export const getCategoryImage = (_name: string, slug: string): string => {
  const baseSlug = slug.toLowerCase().trim();

  if (IMAGE_CONFIG.CATEGORY_IMAGES[baseSlug]) {
    return IMAGE_CONFIG.CATEGORY_IMAGES[baseSlug];
  }

  if (
    baseSlug.includes('dien-thoai') ||
    baseSlug.includes('phone') ||
    baseSlug.includes('mobile')
  ) {
    return IMAGE_CONFIG.CATEGORY_IMAGES['dien-thoai'];
  }
  if (baseSlug.includes('laptop') || baseSlug.includes('may-tinh')) {
    return IMAGE_CONFIG.CATEGORY_IMAGES['laptop'];
  }
  if (baseSlug.includes('smartwatch') || baseSlug.includes('smart-watch')) {
    return IMAGE_CONFIG.CATEGORY_IMAGES['smartwatch'];
  }
  if (baseSlug.includes('tablet') || baseSlug.includes('may-tinh-bang')) {
    return IMAGE_CONFIG.CATEGORY_IMAGES['tablet'];
  }
  if (baseSlug.includes('dong-ho') || baseSlug.includes('watch')) {
    return IMAGE_CONFIG.CATEGORY_IMAGES['dong-ho'];
  }

  return IMAGE_CONFIG.CATEGORY_IMAGES['smartwatch'];
};

export const createCategoryImageErrorHandler = (categoryName: string) => {
  return (event: React.SyntheticEvent<HTMLImageElement>) => {
    const target = event.target as HTMLImageElement;
    target.src = `${IMAGE_CONFIG.FALLBACK_CATEGORY_IMAGE}?text=${encodeURIComponent(categoryName)}`;
  };
};
