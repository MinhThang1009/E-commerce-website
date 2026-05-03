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
  PICSUM_BASE_URL: 'https://picsum.photos/seed',
  SEEDS: {
    BOOKS: 'books',
    CLOTHING: 'clothing',
    ELECTRONICS: 'electronics',
    FOOD: 'food',
    SPORTS: 'sports',
    DEFAULT: 'default',
  },
} as const;

/**
 * Tạo hash từ văn bản để tạo seed ảnh nhất quán
 */
const generateSeed = (text: string): number => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash = hash & hash; // Chuyển đổi sang số nguyên 32 bit
  }
  return Math.abs(hash) % 1000; // Giới hạn trong khoảng 0-999
};

/**
 * Lấy ảnh phù hợp cho danh mục dựa theo tên và slug
 */
export const getCategoryImage = (name: string, slug: string): string => {
  const seed = generateSeed(name);
  const baseName = name.toLowerCase();
  const baseSlug = slug.toLowerCase();

  // Xác định loại danh mục dựa theo từ khóa
  if (baseSlug.includes('book') || baseSlug.includes('sach')) {
    return `${IMAGE_CONFIG.PICSUM_BASE_URL}/${IMAGE_CONFIG.SEEDS.BOOKS}-${seed}/800/600`;
  }

  if (
    baseSlug.includes('cloth') ||
    baseSlug.includes('fashion') ||
    baseSlug.includes('quanao')
  ) {
    return `${IMAGE_CONFIG.PICSUM_BASE_URL}/${IMAGE_CONFIG.SEEDS.CLOTHING}-${seed}/800/600`;
  }

  if (
    baseSlug.includes('electron') ||
    baseSlug.includes('tech') ||
    baseSlug.includes('dien')
  ) {
    return `${IMAGE_CONFIG.PICSUM_BASE_URL}/${IMAGE_CONFIG.SEEDS.ELECTRONICS}-${seed}/800/600`;
  }

  if (baseSlug.includes('food') || baseSlug.includes('thucpham')) {
    return `${IMAGE_CONFIG.PICSUM_BASE_URL}/${IMAGE_CONFIG.SEEDS.FOOD}-${seed}/800/600`;
  }

  if (baseSlug.includes('sport') || baseSlug.includes('thethao')) {
    return `${IMAGE_CONFIG.PICSUM_BASE_URL}/${IMAGE_CONFIG.SEEDS.SPORTS}-${seed}/800/600`;
  }

  // Ảnh dự phòng mặc định với seed duy nhất
  return `${IMAGE_CONFIG.PICSUM_BASE_URL}/${encodeURIComponent(baseName)}-${seed}/800/600`;
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
  fallbackSrc: string
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
  } = {}
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
    })
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
  sizes: number[] = [400, 800, 1200]
): string => {
  if (!baseUrl) return '';

  return sizes
    .map((size) => `${optimizeImageUrl(baseUrl, { width: size })} ${size}w`)
    .join(', ');
};

