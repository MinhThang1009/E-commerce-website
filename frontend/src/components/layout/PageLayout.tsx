/**
 * @file PageLayout.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
/**
 * Component PageLayout
 * Cung cấp cấu trúc bố cục nhất quán cho tất cả các trang
 */

import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FullPageLoading } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  keywords?: string;
  className?: string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  containerSize?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showContainer?: boolean;
  noPaddingTop?: boolean;
}

/**
 * Component bố cục trang chính
 */
export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  description,
  keywords,
  className = '',
  isLoading = false,
  error,
  onRetry,
  containerSize = 'xl',
  showContainer = true,
  noPaddingTop = false,
}) => {
  const getContainerClass = () => {
    if (!showContainer) return '';

    const sizeClasses = {
      sm: 'max-w-2xl',
      md: 'max-w-4xl',
      lg: 'max-w-6xl',
      xl: 'max-w-7xl',
      full: 'max-w-full',
    };

    return `container mx-auto px-4 ${sizeClasses[containerSize]}`;
  };

  const pageTitle = title ? `${title} | TechStore` : 'TechStore';

  // Hiển thị loading toàn trang
  if (isLoading) {
    return <FullPageLoading />;
  }

  // Hiển thị trạng thái lỗi
  if (error) {
    return (
      <PageLayout showContainer={showContainer} containerSize={containerSize}>
        <ErrorState error={error} onRetry={onRetry} size="lg" className="py-16" />
      </PageLayout>
    );
  }

  return (
    <>
      {/* Thẻ meta SEO */}
      <Helmet>
        <title>{pageTitle}</title>
        {description && <meta name="description" content={description} />}
        {keywords && <meta name="keywords" content={keywords} />}
        <meta property="og:title" content={pageTitle} />
        {description && <meta property="og:description" content={description} />}
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        {description && <meta name="twitter:description" content={description} />}
      </Helmet>

      {/* Nội dung trang */}
      <main
        className={`min-h-screen ${noPaddingTop ? '' : 'pt-16 sm:pt-[4.5rem] lg:pt-20'} ${className}`}
      >
        <div className={getContainerClass()}>{children}</div>
      </main>
    </>
  );
};

export default PageLayout;
