/**
 * @file BrandsPage.tsx
 * @layer Page
 * @feature catalog
 * @description Page component của feature catalog
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { localizeField } from '@/utils/localize';
import { buildRoute } from '@/routes/paths';
import { useGetBrandsQuery } from '../api/brand-api';
import { PageLayout } from '@/components/layout/PageLayout';
import { ErrorState } from '@/components/common/ErrorState';

// Simple Icons CDN fallback — dùng chung với HomePage marquee
const SIMPLE_ICONS_SLUGS: Record<string, string> = {
  APPLE: 'apple',
  SAMSUNG: 'samsung',
  XIAOMI: 'xiaomi',
  ASUS: 'asus',
  DELL: 'dell',
  HP: 'hp',
  LENOVO: 'lenovo',
  OPPO: 'oppo',
  REALME: 'realme',
  ACER: 'acer',
  LG: 'lg',
  SONY: 'sony',
  HUAWEI: 'huawei',
  MOTOROLA: 'motorola',
  CITIZEN: 'citizen',
};

function getBrandLogoUrl(name: string): string | null {
  const slug = SIMPLE_ICONS_SLUGS[name.toUpperCase().trim()];
  return slug ? `https://cdn.simpleicons.org/${slug}/2aaca7` : null;
}

const BrandsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { data: brandsData, isLoading, error, refetch } = useGetBrandsQuery({ isActive: true });
  const [searchTerm, setSearchTerm] = useState('');

  const brands = brandsData?.data || [];
  const filteredBrands = // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API brand data
    brands.filter((brand: any) =>
      localizeField(brand, 'name', i18n.language).toLowerCase().includes(searchTerm.toLowerCase()),
    );

  return (
    <PageLayout title={t('brands.pageTitle')} description={t('brands.pageDescription')}>
      <div className="py-10">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold text-neutral-900 dark:text-white mb-4">
            {t('brands.title')}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-8">
            {t('brands.description')}
          </p>
          <div className="max-w-md mx-auto relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('brands.searchPlaceholder')}
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-2 focus:ring-primary-500 transition-all shadow-sm"
            />
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-32 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : filteredBrands.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-xl font-bold">{t('brands.noResults')}</h3>
            <p className="text-neutral-500">{t('brands.noResultsHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {filteredBrands.map((brand: any) => (
              <Link
                key={brand.id}
                to={buildRoute.shopBrand(brand.id)}
                className="group bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:shadow-xl hover:border-primary-500/30 transition-all duration-300"
              >
                <div className="h-20 flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-500">
                  {(() => {
                    const brandName = localizeField(brand, 'name', i18n.language);
                    // API trả về logoUrl, không phải logo
                    const logoSrc = brand.logoUrl || brand.logo || getBrandLogoUrl(brandName);
                    return logoSrc ? (
                      <img
                        src={logoSrc}
                        alt={brandName}
                        className="max-h-12 max-w-full dark:brightness-0 dark:invert opacity-70 group-hover:opacity-100 transition-all duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-2xl font-bold">
                        {brandName.charAt(0)}
                      </div>
                    );
                  })()}
                </div>
                <h3 className="font-bold text-neutral-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {localizeField(brand, 'name', i18n.language)}
                </h3>
                <p className="text-xs text-neutral-500 mt-2 line-clamp-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {t('brands.viewProducts')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default BrandsPage;
