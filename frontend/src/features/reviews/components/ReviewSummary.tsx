/**
 * @file ReviewSummary.tsx
 * @layer Component
 * @feature reviews
 * @description UI component cho feature reviews
 */
import { useTranslation } from 'react-i18next';
import { useGetProductReviewsQuery } from '../api/review-api';
import { Rating } from '@/components/common/Rating';

interface ReviewSummaryProps {
  productId: string;
  averageRating?: number;
  totalReviews?: number;
}

const ReviewSummary: React.FC<ReviewSummaryProps> = ({
  productId,
  averageRating = 0,
  totalReviews = 0,
}) => {
  const { t } = useTranslation();
  const { data: reviewsData } = useGetProductReviewsQuery(
    {
      productId,
      limit: 1000, // Lấy tất cả đánh giá để tính tổng quan
    },
    {
      enabled: !!productId && productId !== 'undefined',
    },
  );

  // Tính phân phối đánh giá
  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => {
    const count =
      reviewsData?.data?.reviews?.filter((review: { rating: number }) => review.rating === rating)
        .length || 0;
    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
    return { rating, count, percentage };
  });

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 mb-6">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
        {t('review.summary.title')}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Đánh giá tổng quan */}
        <div className="text-center">
          <div className="text-4xl font-bold text-neutral-900 dark:text-white mb-2">
            {averageRating.toFixed(1)}
          </div>
          <Rating value={averageRating} size="large" readonly />
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
            {t('review.summary.totalReviews', { count: totalReviews })}
          </p>
        </div>

        {/* Phân phối đánh giá */}
        <div className="space-y-2">
          {ratingDistribution.map(({ rating, count, percentage }) => (
            <div key={rating} className="flex items-center space-x-3">
              <span className="text-sm text-neutral-600 dark:text-neutral-400 w-8">
                {t('review.summary.stars', { rating })}
              </span>
              <div className="flex-1 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                <div
                  className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-sm text-neutral-600 dark:text-neutral-400 w-8">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Điểm nổi bật đánh giá */}
      {totalReviews > 0 && (
        <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                {Math.round(
                  ((ratingDistribution[0].count + ratingDistribution[1].count) / totalReviews) *
                    100,
                )}
                %
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                {t('review.summary.satisfied')}
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                {ratingDistribution
                  .filter((r) => r.rating >= 4)
                  .reduce((sum, r) => sum + r.count, 0)}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                {t('review.summary.fourPlus')}
              </div>
            </div>

            <div>
              <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                {reviewsData?.data?.reviews?.filter((r: { isVerified?: boolean }) => r.isVerified)
                  .length || 0}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                {t('review.list.verified')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewSummary;
