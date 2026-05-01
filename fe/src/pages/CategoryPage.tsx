import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useGetCategoryBySlugQuery, useGetProductsByCategoryQuery } from '@/services/categoryApi';
import { useGetAllCategoriesQuery } from '@/services/categoryApi';
import ProductCard from '@/components/features/ProductCard';
import { getCategoryBySlug, mockCategories } from '@/data/mockCategories';

type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'popular';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price-asc', label: 'Giá thấp đến cao' },
  { value: 'price-desc', label: 'Giá cao đến thấp' },
  { value: 'popular', label: 'Phổ biến nhất' },
];

const sortOrderMap: Record<SortOption, { sort: string; order: 'ASC' | 'DESC' }> = {
  newest: { sort: 'createdAt', order: 'DESC' },
  'price-asc': { sort: 'price', order: 'ASC' },
  'price-desc': { sort: 'price', order: 'DESC' },
  popular: { sort: 'totalSold', order: 'DESC' },
};

// Category icons map
const CATEGORY_ICONS: Record<string, string> = {
  audio: '🎧',
  wearables: '⌚',
  computers: '💻',
  accessories: '🔌',
  'tvs-home-theater': '📺',
  cameras: '📷',
  gaming: '🎮',
};

const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Get category info via API
  const { data: categoryData, isLoading: categoryLoading } = useGetCategoryBySlugQuery(slug || '', { skip: !slug });

  // Fallback info from mock (if API loading or failed)
  const mockInfo = getCategoryBySlug(slug || '');

  const categoryInfo = useMemo(() => {
    if (categoryData?.data && !Array.isArray(categoryData.data)) {
      return categoryData.data;
    }
    return mockInfo as any;
  }, [categoryData, mockInfo]);

  // Get real products via API using category ID
  const { sort, order } = sortOrderMap[sortBy];
  const {
    data: productsData,
    isLoading: productsLoading,
    isFetching,
  } = useGetProductsByCategoryQuery(
    { id: categoryInfo?.id || '', page, limit: 12, sort, order },
    { skip: !categoryInfo?.id }
  );

  // Related categories (siblings)
  const { data: allCatsData } = useGetAllCategoriesQuery();
  const relatedCategories = useMemo(() => {
    const cats = Array.isArray(allCatsData?.data) ? allCatsData.data : [];
    return cats.filter((c: any) => c.slug !== slug).slice(0, 5);
  }, [allCatsData, slug]);

  // Redirect if category not found AFTER loading finished
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
  const totalProducts = productsData?.data?.pagination?.totalItems ?? categoryInfo.productCount ?? 0;
  const totalPages = productsData?.data?.pagination?.totalPages ?? 1;

  const emoji = CATEGORY_ICONS[slug || ''] || '📦';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-800 via-primary-700 to-primary-600 text-white">
        {categoryInfo.image && (
          <div className="absolute inset-0 opacity-25">
            <img 
              src={categoryInfo.image.startsWith('http') ? categoryInfo.image : `${import.meta.env.VITE_API_URL || 'http://localhost:8888'}${categoryInfo.image}`}
              className="w-full h-full object-cover object-center"
              alt="bg"
            />
            <div className="absolute inset-0 bg-black/40"></div>
          </div>
        )}
        
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-8 left-16 text-8xl rotate-12 select-none">{emoji}</div>
          <div className="absolute top-4 right-32 text-6xl -rotate-6 select-none">{emoji}</div>
          <div className="absolute bottom-4 right-12 text-7xl rotate-3 select-none">{emoji}</div>
          <div className="absolute bottom-6 left-1/3 text-5xl -rotate-12 select-none">{emoji}</div>
        </div>

        <div className="relative container mx-auto px-4 py-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-white/70 mb-6">
            <Link to="/" className="hover:text-white transition-colors">Trang chủ</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Link to="/shop" className="hover:text-white transition-colors">Cửa hàng</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-white font-medium">{categoryInfo.name}</span>
          </nav>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-4xl border border-white/30 shadow-lg overflow-hidden">
              {categoryInfo.image ? (
                <img 
                  src={categoryInfo.image.startsWith('http') ? categoryInfo.image : `${import.meta.env.VITE_API_URL || 'http://localhost:8888'}${categoryInfo.image}`}
                  alt={categoryInfo.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                emoji
              )}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{categoryInfo.name}</h1>
              {categoryInfo.description && (
                <p className="text-white/80 mt-1 text-sm md:text-base max-w-xl">{categoryInfo.description}</p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm border border-white/20 text-white text-xs font-medium px-3 py-1 rounded-full">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  {productsLoading ? '...' : `${totalProducts} sản phẩm`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Related Categories */}
        {relatedCategories.length > 0 && (
          <div className="mb-8 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Link
              to="/shop"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
            >
              🛍️ Tất cả
            </Link>
            {relatedCategories.map((cat) => (
              <Link
                key={cat.slug}
                to={`/categories/${cat.slug}`}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 hover:border-primary-300 hover:text-primary-700 dark:hover:border-primary-700 dark:hover:text-primary-300 transition-all"
              >
                <span>{CATEGORY_ICONS[cat.slug] || '📦'}</span>
                {cat.name}
              </Link>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-white dark:bg-neutral-900 rounded-2xl px-5 py-3.5 border border-neutral-100 dark:border-neutral-800 shadow-sm">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {productsLoading ? (
              <span className="animate-pulse">Đang tải...</span>
            ) : (
              <>Hiển thị <span className="font-semibold text-neutral-800 dark:text-neutral-100">{products.length}</span> / <span className="font-semibold text-neutral-800 dark:text-neutral-100">{totalProducts}</span> sản phẩm</>
            )}
          </p>

          <div className="flex items-center gap-3">
            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as SortOption); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* View toggle */}
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-neutral-700 text-primary-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                title="Dạng lưới"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-neutral-700 text-primary-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
                title="Dạng danh sách"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Products */}
        {productsLoading || isFetching ? (
          <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden animate-pulse">
                <div className={`bg-neutral-200 dark:bg-neutral-700 ${viewMode === 'grid' ? 'aspect-square' : 'h-48'}`}></div>
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
            <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-5 text-4xl">
              {emoji}
            </div>
            <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Chưa có sản phẩm
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6">
              Danh mục này hiện chưa có sản phẩm nào. Hãy khám phá các danh mục khác!
            </p>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Xem tất cả sản phẩm
            </Link>
          </div>
        ) : (
          <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 lg:grid-cols-2'}`}>
            {products.map((product: any) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Trước
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
                  <span key={`ellipsis-${idx}`} className="px-2 text-neutral-400">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-9 h-9 rounded-xl text-sm font-medium transition-colors ${page === p
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800'
                      }`}
                  >
                    {p}
                  </button>
                )
              )}

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Tiếp
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryPage;
