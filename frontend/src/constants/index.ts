export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  ADMIN_LIMIT: 20,
} as const;

export const UPLOAD = {
  MAX_FILE_SIZE_MB: 5,
  ACCEPTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
} as const;

export const LOYALTY = {
  POINTS_PER_ORDER_VND: 1000,
  MIN_REDEEM_POINTS: 100,
} as const;
