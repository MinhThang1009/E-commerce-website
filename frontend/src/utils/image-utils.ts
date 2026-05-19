/**
 * @file imageUtils.ts
 * @layer Utility
 * @feature global
 * @description Helper utility function
 */
/**
 * Các hàm tiện ích xử lý ảnh
 * Xử lý và tối ưu ảnh tập trung
 */

/**
 * Cấu hình cho các tiện ích xử lý ảnh
 */
const IMAGE_CONFIG = {
  FALLBACK_CATEGORY_IMAGE: 'https://placehold.co/800x600/e2e8f0/1e293b',
  FALLBACK_PRODUCT_IMAGE: 'https://placehold.co/400x400/f1f5f9/64748b',
  // Ảnh thực từ sản phẩm trong DB — không dùng picsum/Unsplash
  // Ưu tiên sản phẩm mới nhất trong từng danh mục
  CATEGORY_IMAGES: {
    // Điện thoại → iPhone 17 (id=1/2)
    'dien-thoai':
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/42/342667/iphone-17-xanh-6-638930798970669098-750x500.jpg',
    // Laptop → MacBook Pro 14" M5 (id=24, mới nhất trong DB)
    laptop:
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/44/358086/macbook-pro-14-inch-m5-16gb-512gb-thumb-638962954605863722-600x600.jpg',
    // Smartwatch → Apple Watch Ultra 3 (id=47, mới nhất trong DB)
    smartwatch:
      'https://cdn.tgdd.vn/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-den-tb-600x600.jpg',
    // Tablet → iPad A16 5G (id=14, mới nhất trong DB)
    tablet: 'https://cdn.tgdd.vn/Products/Images/522/335311/ipad-11-5g-sliver-thumb-600x600.jpg',
    // Đồng hồ → CASIO A158WA (id=56)
    'dong-ho':
      'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-thumb-600x600.jpg',
    // Phụ kiện → Mi Band 10 (id=53)
    'phu-kien': 'https://cdn.tgdd.vn/Products/Images/7077/336899/mi-band-10-den-600x600.jpg',
  } as Record<string, string>,
} as const;

/**
 * Lấy ảnh phù hợp cho danh mục dựa theo slug — dùng ảnh thực từ sản phẩm trong DB.
 * Không còn dùng picsum.photos hoặc Unsplash.
 */
export const getCategoryImage = (_name: string, slug: string): string => {
  const baseSlug = slug.toLowerCase().trim();

  // Exact slug match
  if (IMAGE_CONFIG.CATEGORY_IMAGES[baseSlug]) {
    return IMAGE_CONFIG.CATEGORY_IMAGES[baseSlug];
  }

  // Keyword fallback
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

  // Default: Samsung watch (đẹp, phù hợp tech store)
  return IMAGE_CONFIG.CATEGORY_IMAGES['smartwatch'];
};

/**
 * Lấy ảnh dự phòng cho danh mục
 */
export const getCategoryFallbackImage = (categoryName: string): string => {
  return `${IMAGE_CONFIG.FALLBACK_CATEGORY_IMAGE}?text=${encodeURIComponent(categoryName)}`;
};

/**
 * Lấy ảnh dự phòng cho sản phẩm
 */
export const getProductFallbackImage = (productName: string): string => {
  return `${IMAGE_CONFIG.FALLBACK_PRODUCT_IMAGE}?text=${encodeURIComponent(productName)}`;
};

/**
 * Xử lý lỗi ảnh với ảnh dự phòng
 */
export const handleImageError = (
  event: React.SyntheticEvent<HTMLImageElement>,
  fallbackSrc: string,
): void => {
  const target = event.target as HTMLImageElement;
  target.src = fallbackSrc;
};

/**
 * Tạo hàm xử lý lỗi ảnh cho danh mục
 */
export const createCategoryImageErrorHandler = (categoryName: string) => {
  return (event: React.SyntheticEvent<HTMLImageElement>) => {
    handleImageError(event, getCategoryFallbackImage(categoryName));
  };
};

/**
 * Tạo hàm xử lý lỗi ảnh cho sản phẩm
 */
export const createProductImageErrorHandler = (productName: string) => {
  return (event: React.SyntheticEvent<HTMLImageElement>) => {
    handleImageError(event, getProductFallbackImage(productName));
  };
};

/**
 * Tối ưu URL ảnh cho các kích thước khác nhau
 */
export const optimizeImageUrl = (
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpg' | 'png';
  } = {},
): string => {
  if (!url) return '';

  // Nếu là URL Picsum, có thể thêm tham số
  if (url.includes('picsum.photos')) {
    const { width = 800, height = 600, quality = 80 } = options;
    return `${url}?w=${width}&h=${height}&q=${quality}`;
  }

  // Nếu là URL placeholder, có thể thay đổi kích thước
  if (url.includes('placehold.co')) {
    const { width = 400, height = 400 } = options;
    return url.replace(/\d+x\d+/, `${width}x${height}`);
  }

  // Trả về URL gốc nếu không thể tối ưu
  return url;
};

/**
 * Tải trước ảnh để cải thiện hiệu suất
 */
export const preloadImages = (urls: string[]): Promise<void[]> => {
  return Promise.all(
    urls.map((url) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
    }),
  );
};

/**
 * Kiểm tra URL ảnh có hợp lệ không
 */
export const isValidImageUrl = (url: string): boolean => {
  if (!url) return false;

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const urlLower = url.toLowerCase();

  return (
    imageExtensions.some((ext) => urlLower.includes(ext)) ||
    urlLower.includes('picsum.photos') ||
    urlLower.includes('placehold.co')
  );
};

/**
 * Tạo srcSet ảnh responsive
 */
export const generateResponsiveImageSrcSet = (
  baseUrl: string,
  sizes: number[] = [400, 800, 1200],
): string => {
  if (!baseUrl) return '';

  return sizes.map((size) => `${optimizeImageUrl(baseUrl, { width: size })} ${size}w`).join(', ');
};
