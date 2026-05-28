/**
 * @file CategoryPage.tsx
 * @layer Page
 * @feature catalog
 * @description Page component của feature catalog
 */
import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Button from '@/components/common/Button';
import { useTranslation } from 'react-i18next';
import { ROUTES, buildRoute } from '@/routes/paths';
import { Helmet } from 'react-helmet-async';
import { useGetCategoryBySlugQuery, useGetProductsByCategoryQuery } from '../api/category-api';
import { useGetAllCategoriesQuery } from '../api/category-api';
import { ProductCard } from '@/features/catalog';
import { getUploadUrl } from '@/utils/upload-url';
import { localizeField } from '@/utils/localize';
import {
  Smartphone,
  Tablet,
  Laptop,
  Watch,
  Clock,
  Package,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';

type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'popular';

const sortOrderMap: Record<SortOption, { sort: string; order: 'ASC' | 'DESC' }> = {
  newest: { sort: 'createdAt', order: 'DESC' },
  'price-asc': { sort: 'price', order: 'ASC' },
  'price-desc': { sort: 'price', order: 'DESC' },
  popular: { sort: 'totalSold', order: 'DESC' },
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'dien-thoai': Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  smartwatch: Watch,
  'dong-ho': Clock,
};

const getCategoryIcon = (slug: string) => CATEGORY_ICONS[slug] ?? Package;

const CategoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: categoryData, isLoading: categoryLoading } = useGetCategoryBySlugQuery(slug || '', {
    enabled: !!slug,
  });
  const categoryInfo = useMemo(() => {
    if (categoryData?.data && !Array.isArray(categoryData.data)) {
      return categoryData.data;
    }
    return null;
  }, [categoryData]);

  const { sort, order } = sortOrderMap[sortBy];
  const {
    data: productsData,
    isLoading: productsLoading,
    isFetching,
  } = useGetProductsByCategoryQuery(
    { id: categoryInfo?.id || '', page, limit: 12, sort, order },
    { enabled: !!categoryInfo?.id },
  );

  const { data: allCatsData } = useGetAllCategoriesQuery();
  const relatedCategories = useMemo(() => {
    const cats = Array.isArray(allCatsData?.data) ? allCatsData.data : [];
    return cats.filter((c) => c.slug !== slug).slice(0, 5);
  }, [allCatsData, slug]);

  useEffect(() => {
    if (!categoryLoading && !categoryInfo) {
      navigate('/not-found');
    }
  }, [categoryLoading, categoryInfo, navigate]);

  if (categoryLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!categoryInfo) return null;

  const products = productsData?.data?.products || [];
  const totalProducts = productsData?.data?.total ?? categoryInfo.productCount ?? 0;
  const totalPages = productsData?.data?.pages ?? 1;

  const CategoryIcon = getCategoryIcon(slug || '');
  const catName = localizeField(categoryInfo, 'name', i18n.language);
  const catDesc = localizeField(categoryInfo, 'description', i18n.language);

  const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'newest', label: t('category.sortNewest') },
    { value: 'price-asc', label: t('category.sortPriceAsc') },
    { value: 'price-desc', label: t('category.sortPriceDesc') },
    { value: 'popular', label: t('category.sortPopular') },
  ];

  // URL ảnh đầy đủ cho og:image
  const categoryImageUrl = getUploadUrl(categoryInfo.image);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Thẻ meta SEO cho trang danh mục */}
      <Helmet>
        <title>{`${catName} | TechStore`}</title>
        <meta name="description" content={catDesc || catName} />
        <meta property="og:title" content={catName} />
        <meta property="og:description" content={catDesc || catName} />
        {categoryImageUrl && <meta property="og:image" content={categoryImageUrl} />}
        <meta property="og:type" content="website" />
        <link
          rel="canonical"
          href={`${import.meta.env.VITE_SITE_URL || 'https://techstore.vn'}/categories/${slug}`}
        />
      </Helmet>
      {/* Banner hero */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-800 via-primary-700 to-primary-600 text-white">
        {categoryInfo.image && (
          <div className="absolute inset-0 opacity-25">
            <img
              src={getUploadUrl(categoryInfo.image)}
              className="w-full h-full object-cover object-center"
              alt=""
            />
            <div className="absolute inset-0 bg-black/40"></div>
          </div>
        )}

        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-8 left-16 rotate-12 select-none opacity-10">
            <CategoryIcon className="w-24 h-24 text-white" />
          </div>
          <div className="absolute top-4 right-32 -rotate-6 select-none opacity-10">
            <CategoryIcon className="w-16 h-16 text-white" />
          </div>
          <div className="absolute bottom-4 right-12 rotate-3 select-none opacity-10">
            <CategoryIcon className="w-20 h-20 text-white" />
          </div>
          <div className="absolute bottom-6 left-1/3 -rotate-12 select-none opacity-10">
            <CategoryIcon className="w-14 h-14 text-white" />
          </div>
        </div>

        <div className="relative container mx-auto px-4 py-12">
          <nav className="flex items-center gap-2 text-sm text-white/70 mb-6">
            <Link to={ROUTES.HOME} className="hover:text-white transition-colors">
              {t('category.home')}
            </Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Link to={ROUTES.SHOP} className="hover:text-white transition-colors">
              {t('category.shop')}
            </Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-white font-medium">{catName}</span>
          </nav>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-lg overflow-hidden">
              {categoryInfo.image ? (
                <img
                  src={getUploadUrl(categoryInfo.image)}
                  alt={catName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <CategoryIcon className="w-8 h-8 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{catName}</h1>
              {catDesc && (
                <p className="text-white/80 mt-1 text-sm md:text-base max-w-xl">{catDesc}</p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm border border-white/20 text-white text-xs font-medium px-3 py-1 rounded-full">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  {productsLoading ? '...' : t('category.productCount', { count: totalProducts })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {relatedCategories.length > 0 && (
          <div className="mb-8 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Link
              to={ROUTES.SHOP}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
            >
              <ShoppingBag className="w-4 h-4" /> {t('category.all')}
            </Link>
            {relatedCategories.map((cat) => (
              <Link
                key={cat.slug}
                to={buildRoute.category(cat.slug)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 hover:border-primary-300 hover:text-primary-700 dark:hover:border-primary-700 dark:hover:text-primary-300 transition-all"
              >
                {(() => {
                  const Icon = getCategoryIcon(cat.slug);
                  return <Icon className="w-4 h-4" />;
                })()}
                {localizeField(cat, 'name', i18n.language)}
              </Link>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-white dark:bg-neutral-900 rounded-2xl px-5 py-3.5 border border-neutral-100 dark:border-neutral-800 shadow-sm">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {productsLoading ? (
              <span className="animate-pulse">{t('category.loading')}</span>
            ) : (
              t('category.showing', { shown: products.length, total: totalProducts })
            )}
          </p>

          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortOption);
                  setPage(1);
                }}
                className="appearance-none pl-3 pr-8 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>

            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-neutral-700 text-primary-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                title={t('category.gridView')}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-neutral-700 text-primary-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                title={t('category.listView')}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {productsLoading || isFetching ? (
          <div
            className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}
          >
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden animate-pulse"
              >
                <div
                  className={`bg-neutral-200 dark:bg-neutral-700 ${viewMode === 'grid' ? 'aspect-square' : 'h-48'}`}
                ></div>
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
                  <div className="h-9 bg-neutral-200 dark:bg-neutral-700 rounded-lg mt-4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800">
            <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <CategoryIcon className="w-10 h-10 text-neutral-400 dark:text-neutral-500" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              {t('category.noProducts')}
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6">
              {t('category.noProductsDesc')}
            </p>
            <Button variant="primary" size="sm" as={Link} to={ROUTES.SHOP}>
              {t('category.viewAllProducts')}
            </Button>
          </div>
        ) : (
          <div
            className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 lg:grid-cols-2'}`}
          >
            {products.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Product card cần nhiều trường
              (product: any) => (
                <ProductCard key={product.id} {...product} />
              ),
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              {t('category.prev')}
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                if (idx > 0 && (arr[idx - 1] as number) !== p - 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-neutral-400">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-9 h-9 rounded-xl text-sm font-medium transition-colors ${
                      page === p
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800'
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('category.next')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryPage;
