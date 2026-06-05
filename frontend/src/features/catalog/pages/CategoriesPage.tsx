/**
 * @file CategoriesPage.tsx
 * @layer Page
 * @feature catalog
 * @description Page component của feature catalog
 */
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { localizeField } from '@/utils/localize';
import { buildRoute } from '@/routes/paths';
import { useGetAllCategoriesQuery } from '../api/category-api';
import { Category } from '../types/category.types';
import {
  Smartphone,
  Tablet,
  Laptop,
  Watch,
  Clock,
  Package,
  LayoutGrid,
  Search,
  ChevronRight,
  SearchX,
  type LucideIcon,
} from 'lucide-react';
import PageHero from '@/components/common/PageHero';

const CATEGORY_CONFIG: Record<string, { icon: LucideIcon; gradient: string }> = {
  'dien-thoai': { icon: Smartphone, gradient: 'from-blue-500 to-blue-700' },
  tablet: { icon: Tablet, gradient: 'from-purple-500 to-purple-700' },
  laptop: { icon: Laptop, gradient: 'from-teal-500 to-teal-700' },
  smartwatch: { icon: Watch, gradient: 'from-orange-500 to-orange-700' },
  'dong-ho': { icon: Clock, gradient: 'from-rose-500 to-rose-700' },
};

const FALLBACK_GRADIENTS = [
  'from-indigo-500 to-indigo-700',
  'from-emerald-500 to-emerald-700',
  'from-amber-500 to-amber-700',
  'from-cyan-500 to-cyan-700',
  'from-pink-500 to-pink-700',
];

// `index` luôn được CategoryCard truyền → default `= 0` chỉ phòng thủ, không reachable qua unit test
/* istanbul ignore next -- default arg index=0 luôn được caller truyền */
const getCategoryConfig = (slug?: string, name?: string, index = 0) => {
  if (slug && CATEGORY_CONFIG[slug]) return CATEGORY_CONFIG[slug];
  const n = name?.toLowerCase() || '';
  if (n.includes('điện thoại') || n.includes('phone')) return CATEGORY_CONFIG['dien-thoai'];
  if (n.includes('tablet') || n.includes('máy tính bảng')) return CATEGORY_CONFIG['tablet'];
  if (n.includes('laptop') || n.includes('máy tính xách tay')) return CATEGORY_CONFIG['laptop'];
  if (n.includes('smartwatch') || n.includes('thông minh')) return CATEGORY_CONFIG['smartwatch'];
  if (n.includes('đồng hồ') || n.includes('watch')) return CATEGORY_CONFIG['dong-ho'];
  return {
    icon: Package,
    gradient: FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length],
  };
};

const CategoriesPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: categoriesData, isLoading } = useGetAllCategoriesQuery();
  const [searchTerm, setSearchTerm] = useState('');

  const categories = useMemo(() => {
    return Array.isArray(categoriesData?.data) ? (categoriesData.data as Category[]) : [];
  }, [categoriesData]);

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Helmet>
        <title>{t('categories.pageTitle', { defaultValue: 'Categories' })} | TechStore</title>
      </Helmet>
      <PageHero
        icon={<LayoutGrid className="w-7 h-7" />}
        title={t('categories.heroTitle')}
        subtitle={t('categories.heroDesc', { count: categories?.length || 0 })}
        gradient="primary"
      >
        <div className="max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('categories.searchPlaceholder')}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/15 backdrop-blur-sm border border-white/25 text-white placeholder-white/60 focus:outline-none focus:bg-white/25 focus:border-white/40 transition-all text-sm"
            />
          </div>
        </div>
      </PageHero>

      <div className="container mx-auto px-4 py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-neutral-200 dark:bg-neutral-800 rounded-2xl h-48 animate-pulse"
              />
            ))}
          </div>
        ) : filteredCategories?.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800">
            <SearchX className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              {t('categories.noResults')}
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              {t('categories.noResultsHint')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories?.map((cat, index) => (
              <CategoryCard key={cat.id} category={cat} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CategoryCard: React.FC<{ category: Category; index: number }> = ({ category, index }) => {
  const { t, i18n } = useTranslation();
  const config = getCategoryConfig(category.slug, category.nameVi || category.name, index);
  const Icon = config.icon;
  const hasImage = !!category.image;

  return (
    <Link
      to={buildRoute.shopCategory(category.id)}
      className="group relative rounded-2xl overflow-hidden h-52 flex flex-col justify-end transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
    >
      {hasImage ? (
        <>
          <img
            src={category.image}
            alt={localizeField(category, 'name', i18n.language)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        </>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient}`}>
          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-6 -right-6 w-32 h-32 border-2 border-white rounded-full" />
            <div className="absolute -bottom-4 -left-4 w-24 h-24 border-2 border-white rounded-full" />
          </div>
          {/* Large centered icon */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-15 transition-transform duration-500 group-hover:scale-110">
            <Icon className="w-28 h-28 text-white" strokeWidth={0.8} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </div>
      )}

      <div className="absolute top-4 left-4">
        <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30 shadow-lg">
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>

      {(category.productCount ?? 0) > 0 && (
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm text-white border border-white/30">
            {t('categories.productCount', { count: category.productCount })}
          </span>
        </div>
      )}

      <div className="relative p-5 pt-0">
        <h3 className="font-bold text-white text-lg leading-snug mb-1 drop-shadow-sm">
          {localizeField(category, 'name', i18n.language)}
        </h3>
        <div className="flex items-center gap-1 text-sm text-white/80 group-hover:text-white transition-colors">
          <span>{t('categories.viewNow')}</span>
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
};

export default CategoriesPage;
