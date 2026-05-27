/**
 * @file LoadingState.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
/**
 * Các component trạng thái loading
 * Các trạng thái loading tái sử dụng cho nhiều tình huống khác nhau
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

/**
 * Component Loading Spinner
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full border-t-2 border-b-2 border-primary-500 ${sizeClasses[size]}`}
      />
      {text && (
        <p className={`mt-2 text-neutral-600 dark:text-neutral-400 ${textSizeClasses[size]}`}>
          {text}
        </p>
      )}
    </div>
  );
};

/**
 * Loading Skeleton cho card sản phẩm
 */
export const ProductCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`bg-white dark:bg-neutral-800 rounded-2xl shadow-md p-4 ${className}`}>
      <div className="aspect-square shimmer rounded-xl mb-3" />
      <div className="h-4 shimmer rounded mb-2" />
      <div className="h-4 shimmer rounded w-3/4 mb-3" />
      <div className="h-5 shimmer rounded w-1/2 mb-2" />
      <div className="flex items-center space-x-1 mb-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-3 w-3 shimmer rounded-full" />
        ))}
      </div>
      <div className="h-10 shimmer rounded-xl" />
    </div>
  );
};

/**
 * Loading Skeleton cho card danh mục
 */
export const CategoryCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-white dark:bg-neutral-800 rounded-xl shadow-lg overflow-hidden ${className}`}
    >
      {/* Skeleton ảnh */}
      <div className="aspect-w-3 aspect-h-2 bg-neutral-200 dark:bg-neutral-700" />

      {/* Skeleton nội dung */}
      <div className="p-6 space-y-2">
        <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3" />
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
      </div>
    </div>
  );
};

/**
 * Component loading toàn trang
 */
export const FullPageLoading: React.FC<{ message?: string }> = ({ message }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-white dark:bg-neutral-900 flex items-center justify-center z-50">
      <LoadingSpinner size="lg" text={message ?? t('common.loading')} />
    </div>
  );
};
