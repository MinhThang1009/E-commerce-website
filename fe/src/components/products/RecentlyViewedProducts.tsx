import React from 'react';
import { useGetRecentlyViewedQuery } from '@/services/productApi';
import ProductCard from '@/components/features/ProductCard';

const SkeletonPulse = () => (
  <div className="animate-pulse bg-neutral-200 dark:bg-neutral-700 rounded-lg h-64 w-full" />
);

interface RecentlyViewedProductsProps {
  limit?: number;
  title?: string;
}

const RecentlyViewedProducts: React.FC<RecentlyViewedProductsProps> = ({ 
  limit = 10, 
  title = "Sản phẩm đã xem" 
}) => {
  const { data, isLoading, error } = useGetRecentlyViewedQuery({ limit });

  if (isLoading) {
    return (
      <div className="py-8">
        <h2 className="text-2xl font-bold mb-6">{title}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <SkeletonPulse key={i} />
          ))}
        </div>
      </div>
    );
  }

  const products = Array.isArray(data?.data) ? data.data : data?.data?.products || [];

  if (error || !products || products.length === 0) {
    return null;
  }

  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {products.map((product: any) => (
          <ProductCard key={product.id} {...product} />
        ))}
      </div>
    </div>
  );
};

export default RecentlyViewedProducts;
