/**
 * @file ErrorState.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import PremiumButton from './PremiumButton';
import { getErrorMessage } from '@/utils/error-utils';
import { ShoppingCart, Search, Heart, Package, Inbox } from 'lucide-react';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showRetryButton?: boolean;
  retryText?: string;
  language?: 'vi' | 'en';
}

type EmptyVariant = 'cart' | 'search' | 'wishlist' | 'orders' | 'generic';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  variant?: EmptyVariant;
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
    <div className={`flex flex-col items-center text-center ${classes.container} ${className}`}>
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

      <h3 className={`font-semibold text-neutral-800 dark:text-neutral-200 mb-2 ${classes.title}`}>
        {t('common.errorTitle')}
      </h3>

      <p className={`text-neutral-600 dark:text-neutral-400 mb-6 max-w-md ${classes.description}`}>
        {errorMessage}
      </p>

      {showRetryButton && onRetry && (
        <PremiumButton variant="primary" size="middle" onClick={onRetry} className={classes.button}>
          {effectiveRetryText}
        </PremiumButton>
      )}
    </div>
  );
};

const VARIANT_CONFIG: Record<EmptyVariant, { Icon: React.ElementType; gradient: string }> = {
  cart: { Icon: ShoppingCart, gradient: 'from-primary-400 to-blue-500' },
  search: { Icon: Search, gradient: 'from-amber-400 to-orange-500' },
  wishlist: { Icon: Heart, gradient: 'from-rose-400 to-pink-500' },
  orders: { Icon: Package, gradient: 'from-purple-400 to-indigo-500' },
  generic: { Icon: Inbox, gradient: 'from-neutral-400 to-neutral-500' },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  variant = 'generic',
  className = '',
}) => {
  const config = VARIANT_CONFIG[variant];

  const illustratedIcon = (
    <div className="relative mb-2">
      <div
        className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${config.gradient} opacity-10 absolute inset-0 m-auto blur-xl`}
      />
      <div
        className={`relative w-20 h-20 rounded-2xl bg-gradient-to-br ${config.gradient} bg-opacity-10 flex items-center justify-center`}
      >
        <config.Icon className="size-9 text-white" strokeWidth={1.5} />
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col items-center text-center py-16 ${className}`}>
      <div className="mb-4">{icon || illustratedIcon}</div>

      <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{title}</h3>

      {description && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 max-w-sm leading-relaxed">
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
