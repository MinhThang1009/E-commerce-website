import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ProductCard } from '@/features/catalog';
import { ProductListCard } from '@/features/catalog';
import { FilterPanel } from '@/features/catalog';
import Pagination from '@/components/common/Pagination';
import Select from '@/components/common/Select';
import { PremiumButton, BannerDisplay } from '@/components/common';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { Product, ProductFilters } from '../types/product.types';
import { Category } from '../types/category.types';
import { useGetProductsQuery } from '../api/productApi';
import { useGetCategoriesQuery } from '../api/categoryApi';
import { useGetBrandsQuery } from '../api/brandApi';
import { useGetCollectionsQuery } from '../api/collectionApi';
import { useTranslation } from 'react-i18next';
import { localizeField } from '@/utils/localize';

// Tùy chọn sắp xếp sẽ được xử lý bên trong component do dùng hooks

const ShopPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const sortOptions = [
    { value: 'newest', label: t('shop.sort.newest') },
    { value: 'price_asc', label: t('shop.sort.price_asc') },
    { value: 'price_desc', label: t('shop.sort.price_desc') },
    { value: 'popular', label: t('shop.sort.popular') },
  ];
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Lấy giá trị bộ lọc từ URL
  const categoryId = searchParams.get('category') || undefined;
  const brandId = searchParams.getAll('brand');
  const collectionId = searchParams.getAll('collection');
  const search = searchParams.get('search') || undefined;
  const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
  const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;
  const sort = (searchParams.get('sort') as ProductFilters['sort']) || 'newest';
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
  const limit = 12;

  // Bộ lọc đã chọn cho panel lọc
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({
    categories: categoryId ? [categoryId] : [],
    brand: brandId,
    collection: collectionId,
  });

  // Khoảng giá cho panel lọc
  const [priceRange, setPriceRange] = useState({
    min: minPrice || 0,
    max: maxPrice || 10000000, // 10 triệu VND
  });

  // Sử dụng TanStack Query hooks
  const {
    data: productsData,
    isLoading: isProductsLoading,
    error: _productsError,
  } = useGetProductsQuery({
    categoryId,
    brand: brandId.length > 0 ? brandId : undefined,
    collection: collectionId.length > 0 ? collectionId : undefined,
    search,
    minPrice,
    maxPrice,
    sort: sort as ProductFilters['sort'],
    page,
    limit,
  });

  const { data: categoriesData, isLoading: isCategoriesLoading } = useGetCategoriesQuery();

  const { data: brandsData, isLoading: _isBrandsLoading } = useGetBrandsQuery({
    isActive: true,
    categoryId: categoryId, // Tự động lọc thương hiệu theo danh mục đang chọn
  });

  const { data: collectionsData, isLoading: _isCollectionsLoading } = useGetCollectionsQuery({
    isActive: true,
  });

  // Cập nhật bộ lọc đã chọn khi tham số URL thay đổi
  const brandIdStr = brandId.join(',');
  const collectionIdStr = collectionId.join(',');
  useEffect(() => {
    setSelectedFilters({
      categories: categoryId ? [categoryId] : [],
      brand: brandIdStr ? brandIdStr.split(',') : [],
      collection: collectionIdStr ? collectionIdStr.split(',') : [],
    });

    setPriceRange({
      min: minPrice || 0,
      max: maxPrice || 10000000,
    });
  }, [categoryId, brandIdStr, collectionIdStr, minPrice, maxPrice]);

  // Cập nhật URL khi bộ lọc thay đổi
  const updateFilters = (newFilters: Partial<ProductFilters>) => {
    const updatedParams = new URLSearchParams(searchParams);

    // Cập nhật hoặc xóa từng tham số bộ lọc
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        updatedParams.delete(key);
      } else {
        updatedParams.set(key, String(value));
      }
    });

    // Đặt lại về trang 1 khi bộ lọc thay đổi
    if (Object.keys(newFilters).some((key) => key !== 'page')) {
      updatedParams.set('page', '1');
    }

    setSearchParams(updatedParams);
  };

  // Xử lý thay đổi sắp xếp
  const handleSortChange = (value: string) => {
    updateFilters({ sort: value as ProductFilters['sort'] });
  };

  // Xử lý chuyển trang
  const handlePageChange = (newPage: number) => {
    updateFilters({ page: newPage });
  };

  // Xử lý thay đổi khoảng giá
  const handlePriceRangeChange = (range: { min: number; max: number }) => {
    updateFilters({ minPrice: range.min, maxPrice: range.max });
  };

  // Xử lý thay đổi bộ lọc
  const handleFilterChange = (groupId: string, optionId: string, isSelected: boolean) => {
    const updatedParams = new URLSearchParams(searchParams);

    if (groupId === 'categories') {
      if (isSelected) {
        updatedParams.set('category', optionId);
      } else {
        updatedParams.delete('category');
      }
    } else if (groupId === 'brand' || groupId === 'collection') {
      const currentValues = updatedParams.getAll(groupId);
      const strOptionId = String(optionId);
      if (isSelected) {
        if (!currentValues.includes(strOptionId)) {
          updatedParams.append(groupId, strOptionId);
        }
      } else {
        const newValues = currentValues.filter((v) => v !== strOptionId);
        updatedParams.delete(groupId);
        newValues.forEach((v) => updatedParams.append(groupId, v));
      }
    }

    // Đặt lại về trang 1 khi bộ lọc thay đổi
    updatedParams.set('page', '1');

    setSearchParams(updatedParams);
  };

  // Xử lý xóa bộ lọc
  const handleClearFilters = () => {
    const updatedParams = new URLSearchParams();
    if (search) updatedParams.set('search', search);
    updatedParams.set('page', '1');
    updatedParams.set('sort', 'newest');
    setSearchParams(updatedParams);
  };

  // Xác định trạng thái đang tải
  const isLoading = isProductsLoading || isCategoriesLoading;

  // Chuẩn bị các nhóm bộ lọc cho panel lọc
  const filterGroups = [
    {
      id: 'categories',
      name: t('filters.category'),
      options: (categoriesData || []).map((category: Category) => ({
        id: category.id,
        name: `${localizeField(category, 'name', i18n.language)} (${category.productCount || 0})`,
      })),
    },
    {
      id: 'brand',
      name: t('filters.brand'),
      options:
        brandsData?.data?.map(
          (brand: { id: string; name: string; nameVi?: string; nameEn?: string }) => ({
            id: brand.id,
            name: localizeField(brand, 'name', i18n.language),
          }),
        ) || [],
    },
    {
      id: 'collection',
      name: t('filters.collection'),
      options:
        collectionsData?.data?.map(
          (collection: { id: string; name: string; nameVi?: string; nameEn?: string }) => ({
            id: collection.id,
            name: localizeField(collection, 'name', i18n.language),
          }),
        ) || [],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950">
      {/* Thẻ meta SEO cho trang cửa hàng */}
      <Helmet>
        <title>{t('shop.seo.title')}</title>
        <meta name="description" content={t('shop.seo.description')} />
        <meta property="og:title" content={t('shop.seo.title')} />
        <meta property="og:description" content={t('shop.seo.description')} />
        <meta property="og:type" content="website" />
        <link
          rel="canonical"
          href={`${import.meta.env.VITE_SITE_URL || 'https://techstore.vn'}/shop`}
        />
      </Helmet>
      <div className="container mx-auto px-4 py-8 animate-fadeIn">
        {/* Tiêu đề trang */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-neutral-800 dark:text-neutral-100 mb-3">
            {t('shop.title')}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-lg">
            {productsData?.total
              ? t('shop.stats', {
                  current: productsData.data?.length || 0,
                  total: productsData.total,
                })
              : t('shop.subtitle')}
          </p>
        </div>

        {/* Nút lọc trên mobile */}
        <div className="lg:hidden mb-4">
          <PremiumButton
            variant="outline"
            size="large"
            iconType="settings"
            onClick={() => setIsMobileFilterOpen(true)}
            className="w-full"
          >
            {t('shop.filtersButton')}
          </PremiumButton>
        </div>

        {/* Điều khiển trên mobile */}
        <div className="lg:hidden mb-6 space-y-4">
          {/* Chuyển chế độ hiển thị - Mobile */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('shop.viewMode')}:
            </span>
            <div className="flex items-center bg-white dark:bg-neutral-800 rounded-lg p-1 border border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-primary-500 text-white'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
                aria-label={t('shop.gridView')}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-primary-500 text-white'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
                aria-label={t('shop.listView')}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>

          <Select
            options={sortOptions}
            value={sort || 'newest'}
            onChange={handleSortChange}
            label={t('shop.sortBy')}
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Bộ lọc - Desktop */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <FilterPanel
              priceRange={priceRange}
              onPriceRangeChange={handlePriceRangeChange}
              filterGroups={filterGroups}
              selectedFilters={selectedFilters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />

            {/* Banner bên cạnh */}
            <BannerDisplay position="sidebar" className="mt-8" />
          </div>

          {/* Bộ lọc - Mobile */}
          {isMobileFilterOpen && (
            <div className="lg:hidden">
              <FilterPanel
                priceRange={priceRange}
                onPriceRangeChange={handlePriceRangeChange}
                filterGroups={filterGroups}
                selectedFilters={selectedFilters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
                isMobile
                onCloseMobile={() => setIsMobileFilterOpen(false)}
              />
            </div>
          )}

          {/* Sản phẩm */}
          <div className="flex-grow">
            {/* Sắp xếp và số kết quả - Desktop */}
            <div className="hidden lg:flex justify-between items-center mb-6">
              <p className="text-neutral-600 dark:text-neutral-400">
                {productsData?.total
                  ? t('shop.stats', {
                      current: productsData.data?.length || 0,
                      total: productsData.total,
                    })
                  : t('shop.subtitle')}
              </p>

              <div className="flex items-center gap-4">
                {/* Chuyển chế độ hiển thị */}
                <div className="flex items-center bg-white dark:bg-neutral-800 rounded-lg p-1 border border-neutral-200 dark:border-neutral-700">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-primary-500 text-white'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                    aria-label={t('shop.gridView')}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'list'
                        ? 'bg-primary-500 text-white'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                    aria-label={t('shop.listView')}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  </button>
                </div>

                <div className="w-48">
                  <Select
                    options={sortOptions}
                    value={sort || 'newest'}
                    onChange={handleSortChange}
                    placeholder={t('shop.sortBy')}
                  />
                </div>
              </div>
            </div>

            {/* Lưới sản phẩm */}
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <LoadingSpinner size="lg" />
              </div>
            ) : !productsData?.data || productsData.data.length === 0 ? (
              <div className="text-center py-12 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto text-neutral-400 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  {t('shop.noProducts.title')}
                </h3>
                <p className="text-neutral-500 dark:text-neutral-400 mb-6">
                  {t('shop.noProducts.message')}
                </p>
                <PremiumButton variant="primary" size="large" onClick={handleClearFilters}>
                  {t('shop.noProducts.clearFilters')}
                </PremiumButton>
              </div>
            ) : (
              <>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 xl:gap-10 auto-rows-fr'
                      : 'space-y-8'
                  }
                >
                  {productsData?.data?.map((product: Product) =>
                    viewMode === 'grid' ? (
                      <ProductCard key={product.id} {...product} />
                    ) : (
                      <ProductListCard key={product.id} {...product} />
                    ),
                  )}
                </div>

                {/* Phân trang */}
                {productsData?.total && Math.ceil(productsData.total / productsData.limit) > 1 && (
                  <div className="mt-12 flex justify-center">
                    <Pagination
                      currentPage={page}
                      totalPages={Math.ceil(productsData.total / productsData.limit)}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopPage;
