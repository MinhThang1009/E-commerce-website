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
import { useGetAllCategoriesQuery } from '../api/categoryApi';
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

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'dien-thoai': Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  smartwatch: Watch,
  'dong-ho': Clock,
};

const getIcon = (slug?: string, name?: string): LucideIcon => {
  if (slug && CATEGORY_ICONS[slug]) return CATEGORY_ICONS[slug];
  const n = name?.toLowerCase() || '';
  if (n.includes('điện thoại') || n.includes('phone')) return Smartphone;
  if (n.includes('tablet') || n.includes('máy tính bảng')) return Tablet;
  if (n.includes('laptop') || n.includes('máy tính xách tay')) return Laptop;
  if (n.includes('smartwatch') || n.includes('thông minh')) return Watch;
  if (n.includes('đồng hồ') || n.includes('watch')) return Clock;
  return Package;
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
      <div className="relative bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 text-white overflow-hidden">
        <div className="relative container mx-auto px-4 py-14 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 mb-5 shadow-md">
            <LayoutGrid className="w-8 h-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{t('categories.heroTitle')}</h1>
          <p className="text-white/80 text-sm md:text-base max-w-md mx-auto">
            {t('categories.heroDesc', { count: categories?.length || 0 })}
          </p>

          <div className="mt-8 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('categories.searchPlaceholder')}
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
            <SearchX className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              {t('categories.noResults')}
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              {t('categories.noResultsHint')}
            </p>
          </div>
        ) : (
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
  const { t, i18n } = useTranslation();
  const Icon = getIcon(category.slug, category.nameVi || category.name);
  return (
    <Link
      to={buildRoute.shopCategory(category.id)}
      className="group bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-100 dark:border-neutral-800 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all duration-200"
    >
      <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200">
        <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
      </div>
      <h3 className="font-semibold text-neutral-900 dark:text-white text-sm leading-snug group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors line-clamp-2">
        {localizeField(category, 'name', i18n.language)}
      </h3>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
        {t('categories.productCount', { count: category.productCount || 0 })}
      </p>
      <div className="mt-3 flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
        <span>{t('categories.viewNow')}</span>
        <ChevronRight className="w-3 h-3" />
      </div>
    </Link>
  );
};

export default CategoriesPage;
