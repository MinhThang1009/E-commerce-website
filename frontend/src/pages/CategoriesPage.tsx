import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGetAllCategoriesQuery } from '@/services/categoryApi';
import { Category } from '@/types/category.types';

const CATEGORY_ICONS: Record<string, string> = {
  audio: '🎧',
  wearables: '⌚',
  computers: '💻',
  accessories: '🔌',
  'tvs-home-theater': '📺',
  cameras: '📷',
  gaming: '🎮',
  laptop: '💻',
  'giay-dep': '👟',
  'thoi-trang-nam': '👔',
  'thoi-trang-nu': '👗',
  'o-to-xe-may': '🚗',
};

const getIcon = (slug?: string, name?: string) => {
  if (slug && CATEGORY_ICONS[slug]) return CATEGORY_ICONS[slug];
  const n = name?.toLowerCase() || '';
  if (n.includes('laptop') || n.includes('máy tính')) return '💻';
  if (n.includes('giày') || n.includes('dép')) return '👟';
  if (n.includes('thời trang nam')) return '👔';
  if (n.includes('thời trang nữ') || n.includes('nu')) return '👗';
  if (n.includes('audio') || n.includes('âm thanh')) return '🎧';
  if (n.includes('camera')) return '📷';
  if (n.includes('game') || n.includes('gaming')) return '🎮';
  if (n.includes('ô tô') || n.includes('xe máy')) return '🚗';
  if (n.includes('phụ kiện') || n.includes('accessories')) return '🔌';
  return '📦';
};

const CategoriesPage: React.FC = () => {
  const { data: categoriesData, isLoading } = useGetAllCategoriesQuery();
  const [searchTerm, setSearchTerm] = useState('');

  const categories = useMemo(() => {
    return Array.isArray(categoriesData?.data) ? (categoriesData.data as Category[]) : [];
  }, [categoriesData]);

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedCategories = filteredCategories.reduce<Record<string, Category[]>>((acc, cat) => {
    const letter = cat.name.charAt(0).toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(cat);
    return acc;
  }, {});

  const sortedLetters = groupedCategories ? Object.keys(groupedCategories).sort() : [];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Tiêu đề hero */}
      <div className="relative bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 select-none pointer-events-none">
          {['💻', '👗', '👟', '🎧', '📷', '🎮', '⌚', '🔌'].map((icon, i) => (
            <span
              key={i}
              className="absolute text-5xl"
              style={{
                top: `${[10, 50, 20, 70, 5, 40, 60, 80][i]}%`,
                left: `${[5, 15, 40, 55, 70, 80, 90, 30][i]}%`,
                transform: `rotate(${[-10, 15, -5, 20, -15, 8, -20, 12][i]}deg)`,
              }}
            >
              {icon}
            </span>
          ))}
        </div>
        <div className="relative container mx-auto px-4 py-14 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 text-3xl mb-5 shadow-md">
            🗂️
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Tất cả danh mục</h1>
          <p className="text-white/80 text-sm md:text-base max-w-md mx-auto">
            Khám phá hàng ngàn sản phẩm trong {categories?.length || 0} danh mục đa dạng
          </p>

          {/* Thanh tìm kiếm */}
          <div className="mt-8 max-w-md mx-auto">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm danh mục..."
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-6xl">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-neutral-900 rounded-2xl p-5 animate-pulse">
                <div className="w-12 h-12 bg-neutral-200 dark:bg-neutral-700 rounded-xl mb-3"></div>
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3 mb-2"></div>
                <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : filteredCategories?.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Không tìm thấy danh mục
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">Hãy thử từ khóa khác</p>
          </div>
        ) : searchTerm ? (
          /* Kết quả tìm kiếm */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredCategories?.map((cat) => (
              <CategoryCard key={cat.id} category={cat} />
            ))}
          </div>
        ) : (
          /* Lưới phẳng - tất cả danh mục */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredCategories?.map((cat) => (
              <CategoryCard key={cat.id} category={cat} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CategoryCard: React.FC<{ category: Category }> = ({ category }) => {
  const icon = getIcon(category.slug, category.name);
  return (
    <Link
      to={`/shop?category=${category.id}`}
      className="group bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-100 dark:border-neutral-800 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all duration-200"
    >
      <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform duration-200">
        {icon}
      </div>
      <h3 className="font-semibold text-neutral-900 dark:text-white text-sm leading-snug group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors line-clamp-2">
        {category.name}
      </h3>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
        {category.productCount || 0} sản phẩm
      </p>
      <div className="mt-3 flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
        <span>Xem ngay</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
};

export default CategoriesPage;
