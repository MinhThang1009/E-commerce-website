/**
 * @file RecentlyViewedProducts.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGetRecentlyViewedQuery } from '../api/productApi';
import { ProductCard } from '@/features/catalog';

const SkeletonPulse = () => (
  <div className="animate-pulse bg-neutral-200 dark:bg-neutral-700 rounded-lg h-64 w-full" />
);

interface RecentlyViewedProductsProps {
  limit?: number;
  title?: string;
}

const RecentlyViewedProducts: React.FC<RecentlyViewedProductsProps> = ({ limit = 10, title }) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('product.recentlyViewed');
  const { data: rawData, isLoading, error } = useGetRecentlyViewedQuery({ limit });

  // Deduplicate — recently_viewed có thể chứa cùng product nhiều lần
  const data = React.useMemo(() => {
    if (!rawData?.data) return rawData;
    const seen = new Set<string>();
    const unique = rawData.data.filter((p: { id: string }) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    return { ...rawData, data: unique };
  }, [rawData]);

  if (isLoading) {
    return (
      <div className="py-8">
        <h2 className="text-2xl font-bold mb-6">{resolvedTitle}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <SkeletonPulse key={i} />
          ))}
        </div>
      </div>
    );
  }

  const products = data?.data || [];

  if (error || !products || products.length === 0) {
    return null;
  }

  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold mb-6">{resolvedTitle}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {products.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ProductCard cần nhiều props
          (product: any) => (
            <ProductCard key={product.id} {...product} />
          ),
        )}
      </div>
    </div>
  );
};

export default RecentlyViewedProducts;
