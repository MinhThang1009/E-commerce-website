import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetProductsQuery } from '../api/productApi';
import ProductCard from '@/components/shared/ProductCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Select from '@/components/common/Select';
import Pagination from '@/components/common/Pagination';

const NewArrivalsPage: React.FC = () => {
  const { t } = useTranslation();
  const [sortOption, setSortOption] = useState<'price_asc' | 'price_desc' | 'newest' | 'popular'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 12;

  const {
    data: productsData,
    isLoading,
    error,
  } = useGetProductsQuery({
    sort: sortOption,
    page: currentPage,
    limit,
    newArrivals: true,
  });

  const sortOptions = [
    { value: 'newest', label: t('newArrivals.sortNewest') },
    { value: 'price_asc', label: t('newArrivals.sortPriceAsc') },
    { value: 'price_desc', label: t('newArrivals.sortPriceDesc') },
    { value: 'popular', label: t('newArrivals.sortPopular') },
  ];

  const handleSortChange = (value: string) => {
    setSortOption(value as 'price_asc' | 'price_desc' | 'newest' | 'popular');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          {t('newArrivals.errorTitle')}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {t('newArrivals.errorDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-500 rounded-xl p-8 mb-12 text-white text-center">
        <h1 className="text-4xl font-bold mb-4">{t('newArrivals.heroTitle')}</h1>
        <p className="text-lg max-w-2xl mx-auto mb-6">
          {t('newArrivals.heroDesc')}
        </p>
        <div className="inline-block bg-white text-blue-600 font-bold py-3 px-6 rounded-full text-lg">
          {t('newArrivals.heroBadge')}
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center mb-8">
        <p className="text-neutral-600 dark:text-neutral-400 mb-4 md:mb-0">
          {productsData?.total
            ? t('newArrivals.showing', { shown: productsData.data?.length || 0, total: productsData.total })
            : t('newArrivals.browse')}
        </p>
        <div className="w-full md:w-48">
          <Select
            options={sortOptions}
            value={sortOption}
            onChange={handleSortChange}
            placeholder={t('newArrivals.sortBy')}
          />
        </div>
      </div>

      {productsData?.data?.length === 0 ? (
        <div className="text-center py-12 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-neutral-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
            {t('newArrivals.empty')}
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-6">
            {t('newArrivals.emptyHint')}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {productsData?.data?.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>

          {productsData?.total && Math.ceil(productsData.total / productsData.limit) > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(productsData.total / productsData.limit)}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
};

export default NewArrivalsPage;
