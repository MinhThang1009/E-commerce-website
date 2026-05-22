export const SHIPPING = {
  FREE_THRESHOLD: 5_000_000, // Miễn phí ship nếu subtotal >= 5,000,000 VND (đồng bộ backend)
  BASE_RATE: 30_000,
  MAX_FEE: 100_000,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  ADMIN_LIMIT: 20,
} as const;

export const UPLOAD = {
  MAX_FILE_SIZE_MB: 5,
  ACCEPTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
} as const;
