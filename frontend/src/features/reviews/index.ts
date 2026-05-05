// Barrel export feature reviews — public surface

// Components
export { default as ProductReviews } from './components/ProductReviews';
export { default as ReviewForm } from './components/ReviewForm';
export { default as ReviewList } from './components/ReviewList';
export { default as ReviewModal } from './components/ReviewModal';
export { default as ReviewSection } from './components/ReviewSection';
export { default as ReviewSummary } from './components/ReviewSummary';

// API endpoints (RTK Query)
export {
  reviewApi,
  useGetProductReviewsQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
  useMarkReviewHelpfulMutation,
  useGetUserReviewsQuery,
} from './api/reviewApi';
export type { Review, ReviewFilters, CreateReviewData } from './api/reviewApi';

// Kiểu dữ liệu
export * from './types/review.types';
