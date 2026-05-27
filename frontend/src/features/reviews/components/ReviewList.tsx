/**
 * @file ReviewList.tsx
 * @layer Component
 * @feature reviews
 * @description UI component cho feature reviews
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocale } from '@/utils/format';
import { useGetProductReviewsQuery, Review, ReviewFilters } from '../api/review-api';
import { Rating } from '@/components/common/Rating';

interface ReviewListProps {
  productId: string;
}

const ReviewList: React.FC<ReviewListProps> = ({ productId }) => {
  const { t } = useTranslation();

  const [filters, setFilters] = useState<ReviewFilters>({
    page: 1,
    limit: 10,
    sort: 'newest',
  });

  const {
    data: reviewsData,
    isLoading,
    error,
  } = useGetProductReviewsQuery(
    { productId, ...filters },
    {
      enabled: !!productId && productId !== 'undefined',
    },
  );

  const handleFilterChange = (newFilters: Partial<ReviewFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handleLoadMore = () => {
    if (reviewsData && (filters.page ?? 1) < reviewsData.data.pages) {
      setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(getLocale(), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-700 rounded-full"></div>
                <div className="space-y-1">
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24"></div>
                  <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-32"></div>
                </div>
              </div>
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
              <div className="h-16 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
        <div className="text-center text-red-600 dark:text-red-400">
          <p>{t('review.list.error')}</p>
        </div>
      </div>
    );
  }

  const reviews = reviewsData?.data?.reviews || [];
  const totalReviews = reviewsData?.data?.total || 0;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-neutral-900 dark:text-white">
          {t('review.list.title', { count: totalReviews })}
        </h3>

        <div className="flex items-center space-x-4">
          <select
            value={filters.sort}
            onChange={(e) => handleFilterChange({ sort: e.target.value as ReviewFilters['sort'] })}
            className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white text-sm"
          >
            <option value="newest">{t('review.list.sortNewest')}</option>
            <option value="oldest">{t('review.list.sortOldest')}</option>
            <option value="highest_rating">{t('review.list.sortHighest')}</option>
            <option value="lowest_rating">{t('review.list.sortLowest')}</option>
          </select>

          <select
            value={filters.rating || ''}
            onChange={(e) =>
              handleFilterChange({
                rating: e.target.value ? parseInt(e.target.value) : undefined,
              })
            }
            className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white text-sm"
          >
            <option value="">{t('review.list.allStars')}</option>
            <option value="5">{t('review.list.stars', { count: 5 })}</option>
            <option value="4">{t('review.list.stars', { count: 4 })}</option>
            <option value="3">{t('review.list.stars', { count: 3 })}</option>
            <option value="2">{t('review.list.stars', { count: 2 })}</option>
            <option value="1">{t('review.list.stars', { count: 1 })}</option>
          </select>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1l-4 4z"
            />
          </svg>
          <p>{t('review.list.empty')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review: Review) => (
            <div
              key={review.id}
              className="border-b border-neutral-200 dark:border-neutral-700 pb-6 last:border-b-0"
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-medium">
                    {review.user?.firstName?.charAt(0) || 'U'}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-medium text-neutral-900 dark:text-white">
                        {review.user?.firstName} {review.user?.lastName}
                      </h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <Rating value={review.rating} size="small" readonly />
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {formatDate(review.createdAt)}
                        </span>
                        {review.isVerified && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {t('review.list.verified')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {review.title && (
                    <h5 className="text-sm font-medium text-neutral-900 dark:text-white mb-2">
                      {review.title}
                    </h5>
                  )}

                  <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-3">
                    {review.content}
                  </p>

                  {(() => {
                    try {
                      const parsedImages =
                        typeof review.images === 'string'
                          ? JSON.parse(review.images)
                          : Array.isArray(review.images)
                            ? review.images
                            : [];

                      return Array.isArray(parsedImages) && parsedImages.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {parsedImages.map((image: string, index: number) => (
                            <img
                              key={index}
                              src={image}
                              alt={`Review image ${index + 1}`}
                              className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                window.open(image, '_blank');
                              }}
                            />
                          ))}
                        </div>
                      ) : null;
                    } catch (_e) {
                      return null;
                    }
                  })()}
                </div>
              </div>
            </div>
          ))}

          {reviewsData && (filters.page ?? 1) < reviewsData.data.pages && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                className="px-6 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                {t('review.list.loadMore')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewList;
