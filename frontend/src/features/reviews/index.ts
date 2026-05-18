/**
 * @file index.ts
 * @layer Barrel
 * @feature reviews
 * @description Public API exports cho feature reviews
 */
// Barrel export feature reviews — public surface

// Components
export { default as ProductReviews } from './components/ProductReviews';
export { default as ReviewForm } from './components/ReviewForm';
export { default as ReviewList } from './components/ReviewList';
export { default as ReviewModal } from './components/ReviewModal';
export { default as ReviewSection } from './components/ReviewSection';
export { default as ReviewSummary } from './components/ReviewSummary';

// API hooks (TanStack Query) + query keys
export {
  reviewKeys,
  useGetProductReviewsQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
  useMarkReviewHelpfulMutation,
  useGetUserReviewsQuery,
} from './api/review-api';
export type { Review, ReviewFilters, CreateReviewData } from './api/review-api';

// Kiểu dữ liệu
export * from './types/review.types';
