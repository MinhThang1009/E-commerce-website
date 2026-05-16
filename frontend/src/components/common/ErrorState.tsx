import React from 'react';
import { useTranslation } from 'react-i18next';
import PremiumButton from './PremiumButton';
import { getErrorMessage } from '@/utils/errorUtils';

interface ErrorStateProps {
  error: any;
  onRetry?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showRetryButton?: boolean;
  retryText?: string;
  language?: 'vi' | 'en';
}

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  onRetry,
  className = '',
  size = 'md',
  showRetryButton = true,
  retryText,
  language: _language = 'vi',
}) => {
  const { t } = useTranslation();
  const errorMessage = getErrorMessage(error);
  const effectiveRetryText = retryText || t('common.tryAgain');

  const sizeClasses = {
    sm: {
      container: 'py-8',
      icon: 'h-8 w-8',
      title: 'text-sm',
      description: 'text-xs',
      button: 'px-3 py-1.5 text-sm',
    },
    md: {
      container: 'py-12',
      icon: 'h-12 w-12',
      title: 'text-base',
      description: 'text-sm',
      button: 'px-4 py-2 text-base',
    },
    lg: {
      container: 'py-16',
      icon: 'h-16 w-16',
      title: 'text-lg',
      description: 'text-base',
      button: 'px-6 py-3 text-lg',
    },
  };

  const classes = sizeClasses[size];

  return (
    <div
      className={`flex flex-col items-center text-center ${classes.container} ${className}`}
    >
      <div className={`${classes.icon} text-red-500 mb-4`}>
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>

      <h3
        className={`font-semibold text-neutral-800 dark:text-neutral-200 mb-2 ${classes.title}`}
      >
        {t('common.errorTitle')}
      </h3>

      <p
        className={`text-neutral-600 dark:text-neutral-400 mb-6 max-w-md ${classes.description}`}
      >
        {errorMessage}
      </p>

      {showRetryButton && onRetry && (
        <PremiumButton
          variant="primary"
          size="middle"
          onClick={onRetry}
          className={classes.button}
        >
          {effectiveRetryText}
        </PremiumButton>
      )}
    </div>
  );
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className = '',
}) => {
  const defaultIcon = (
    <svg
      className="h-12 w-12 text-neutral-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );

  return (
    <div
      className={`flex flex-col items-center text-center py-12 ${className}`}
    >
      <div className="mb-4">{icon || defaultIcon}</div>

      <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-md">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <PremiumButton variant="primary" size="middle" onClick={onAction}>
          {actionLabel}
        </PremiumButton>
      )}
    </div>
  );
};

export const NetworkErrorState: React.FC<Omit<ErrorStateProps, 'error'>> = (
  props
) => {
  const { t } = useTranslation();
  const networkError = {
    code: 'ERR_NETWORK',
    message: t('common.networkError'),
  };

  return <ErrorState error={networkError} {...props} />;
};

export const NotFoundState: React.FC<{
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}> = ({
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  const { t } = useTranslation();
  const effectiveTitle = title || t('common.notFound');
  const effectiveDescription = description || t('common.notFoundDesc');
  const effectiveActionLabel = actionLabel || t('common.backToHome');

  const notFoundIcon = (
    <svg
      className="h-12 w-12 text-neutral-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );

  return (
    <EmptyState
      title={effectiveTitle}
      description={effectiveDescription}
      actionLabel={effectiveActionLabel}
      onAction={onAction}
      icon={notFoundIcon}
      className={className}
    />
  );
};

export const NoResultsState: React.FC<{
  searchQuery?: string;
  onClearSearch?: () => void;
  className?: string;
}> = ({ searchQuery, onClearSearch, className = '' }) => {
  const { t } = useTranslation();

  const title = searchQuery
    ? t('common.noResultsFor', { query: searchQuery })
    : t('common.noResults');

  const description = searchQuery
    ? t('common.tryDifferentKeyword')
    : t('common.noResultsDesc');

  return (
    <EmptyState
      title={title}
      description={description}
      actionLabel={searchQuery ? t('common.clearSearch') : undefined}
      onAction={onClearSearch}
      className={className}
    />
  );
};
