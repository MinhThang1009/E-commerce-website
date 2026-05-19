/**
 * @file HomePage.tsx
 * @layer Page
 * @feature global
 * @description Trang chủ premium — unified canvas, bento grid, marquee brands, editorial collections
 */
import React from 'react';
import { message } from 'antd';
import { HeroSection, HomeNewsSection } from '@/components/sections';
import { ProductCardSkeleton, CategoryCardSkeleton } from '@/components/common/LoadingState';
import { ErrorState, EmptyState } from '@/components/common/ErrorState';
import { PageLayout } from '@/components/layout/PageLayout';
import { useGetCategoriesQuery } from '@/features/catalog';
import { useGetFeaturedProductsQuery } from '@/features/catalog';
import { useGetBrandsQuery } from '@/features/catalog';
import { useGetCollectionsQuery } from '@/features/catalog';
import { useSubscribeNewsletterMutation } from '@/features/content';
import { useApiState } from '@/hooks/use-api-state';
import { getCategoryImage, createCategoryImageErrorHandler } from '@/utils/image-utils';
import { getUploadUrl } from '@/utils/upload-url';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ProductCard } from '@/features/catalog';
import { PremiumButton } from '@/components/common';
import { ROUTES, buildRoute } from '@/routes/paths';
import { getErrorMsg } from '@/utils/error-utils';
import { localizeField } from '@/utils/localize';
import { motion } from 'framer-motion';
import { ChevronRight, Sparkles, Mail, ArrowRight, LayoutGrid, Award, Layers } from 'lucide-react';

/**
 * Simple Icons CDN — SVG logos cho tech brands, reliable hơn Clearbit
 * URL: https://cdn.simpleicons.org/{slug}/{color}
 * Color: dùng hex không có # — light/dark mode khác nhau
 */
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
  NOKIA: 'nokia',
};

function getBrandLogoUrl(name: string): string | null {
  const slug = SIMPLE_ICONS_SLUGS[name.toUpperCase().trim()];
  // 6b7280 = gray-500, visible on both light/dark
  return slug ? `https://cdn.simpleicons.org/${slug}/6b7280` : null;
}

// Animation variants dùng lại nhiều nơi
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemFade = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const HomePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isVi = i18n.language !== 'en';

  // ── Data fetching ──
  const featuredProductsQuery = useGetFeaturedProductsQuery({ limit: 4 });
  const categoriesQuery = useGetCategoriesQuery();
  const brandsQuery = useGetBrandsQuery({ isActive: true });
  const collectionsQuery = useGetCollectionsQuery({ isActive: true });

  const featuredProducts = useApiState({
    data: featuredProductsQuery.data,
    isLoading: featuredProductsQuery.isLoading,
    error: featuredProductsQuery.error,
    refetch: featuredProductsQuery.refetch,
    isArray: true,
  });

  const categories = useApiState({
    data: categoriesQuery.data,
    isLoading: categoriesQuery.isLoading,
    error: categoriesQuery.error,
    refetch: categoriesQuery.refetch,
    isArray: true,
  });

  const brands = useApiState({
    data: brandsQuery.data?.data,
    isLoading: brandsQuery.isLoading,
    error: brandsQuery.error,
    refetch: brandsQuery.refetch,
    isArray: true,
  });

  const collections = useApiState({
    data: collectionsQuery.data?.data,
    isLoading: collectionsQuery.isLoading,
    error: collectionsQuery.error,
    refetch: collectionsQuery.refetch,
    isArray: true,
  });

  const [newsletterEmail, setNewsletterEmail] = React.useState('');
  const { mutateAsync: subscribeNewsletter, isPending: isSubscribing } =
    useSubscribeNewsletterMutation();

  const handleNewsletterSubmit = async () => {
    if (!newsletterEmail) {
      message.error(t('homepage.newsletter.emailRequired'));
      return;
    }
    try {
      await subscribeNewsletter({ email: newsletterEmail });
      message.success(t('homepage.newsletter.subscribeSuccess'));
      setNewsletterEmail('');
    } catch (error) {
      message.error(getErrorMsg(error, t('homepage.newsletter.subscribeError')));
    }
  };

  const displayCategories =
    categories.data
      ?.slice(0, 5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((category: any) => ({
        id: category.id,
        name: localizeField(category, 'name', i18n.language),
        image: category.image
          ? getUploadUrl(category.image)
          : getCategoryImage(category.nameVi || category.name, category.slug ?? ''),
        count: category.productCount || 0,
        slug: category.slug,
      })) || [];

  // Collections cần hiển thị — API data chưa có full type
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const displayCollections =
    (collections.data as any[])
      ?.filter((c: any) => ['dien-thoai-moi-nhat', 'tablet-dang-mua-nhat'].includes(c.slug))
      ?.sort((a: any, b: any) => {
        const order = ['dien-thoai-moi-nhat', 'tablet-dang-mua-nhat'];
        return order.indexOf(a.slug) - order.indexOf(b.slug);
      })
      ?.slice(0, 2) ?? [];
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brandList: any[] = brands.data ?? [];

  // Fallback ảnh collection
  const COLLECTION_FALLBACKS: Record<string, string> = {
    'dien-thoai-moi-nhat':
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/42/342667/iphone-17-xanh-6-638930798970669098-750x500.jpg',
    'tablet-dang-mua-nhat':
      'https://cdn.tgdd.vn/Products/Images/522/335311/ipad-11-5g-sliver-thumb-600x600.jpg',
  };

  return (
    <PageLayout
      title={t('homepage.pageTitle')}
      description={t('homepage.pageDescription')}
      keywords={t('homepage.keywords')}
      showContainer={false}
      noPaddingTop
    >
      {/* ── Unified page canvas — 1 background, không stripe ── */}
      <div className="page-canvas">
        {/* ──────────────── HERO ──────────────── */}
        {/* overflow-hidden ngăn hero parallax text bleeding vào section dưới */}
        <div className="overflow-hidden">
          <HeroSection />
        </div>

        {/* ──────────────── SECTION 01: FEATURED PRODUCTS ──────────────── */}
        <section className="section-featured relative overflow-hidden py-24">
          {/* Ambient orbs — đủ đậm để glass thấy rõ */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
            <div
              className="absolute -top-24 -left-24 w-[560px] h-[560px] rounded-full blur-[85px]"
              style={{
                background: 'radial-gradient(ellipse, rgba(42,172,167,0.15) 0%, transparent 70%)',
              }}
            />
            <div
              className="absolute top-1/3 -right-16 w-[420px] h-[420px] rounded-full blur-[70px]"
              style={{
                background: 'radial-gradient(ellipse, rgba(255,117,94,0.20) 0%, transparent 70%)',
              }}
            />
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* Section header */}
            <motion.div
              className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
            >
              <div>
                <div className="section-number mb-3">
                  <Sparkles className="w-3 h-3" />
                  {isVi ? '01 / Nổi Bật' : '01 / Featured'}
                </div>
                <h2 className="display-heading text-4xl lg:text-5xl">
                  {t('homepage.featuredProducts.title')}
                </h2>
              </div>
              <Link
                to={ROUTES.SHOP}
                className="group inline-flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors shrink-0"
              >
                {t('homepage.featuredProducts.viewAll')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            {/* 4-col equal grid */}
            {featuredProducts.isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : featuredProducts.isError ? (
              <ErrorState
                error={featuredProducts.error}
                onRetry={featuredProducts.retry}
                retryText={t('common.tryAgain')}
              />
            ) : featuredProducts.isEmpty ? (
              <EmptyState
                title={t('homepage.featured.emptyTitle')}
                description={t('homepage.featured.emptyDescription')}
              />
            ) : (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={stagger}
              >
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {featuredProducts.data?.data?.map((product: any) => (
                  <motion.div key={product.id} variants={itemFade}>
                    <ProductCard {...product} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </section>

        {/* Iridescent divider */}
        <hr className="iridescent-rule" />

        {/* ──────────────── SECTION 02: CATEGORIES ──────────────── */}
        <section className="relative overflow-hidden py-24">
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
            <div
              className="absolute top-1/2 -translate-y-1/2 -right-32 w-[450px] h-[450px] rounded-full blur-[80px]"
              style={{
                background: 'radial-gradient(ellipse, rgba(42,172,167,0.15) 0%, transparent 70%)',
              }}
            />
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              className="mb-12"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
            >
              <div className="section-number mb-3">
                <LayoutGrid className="w-3 h-3" />
                {isVi ? '02 / Danh Mục' : '02 / Categories'}
              </div>
              <h2 className="display-heading text-4xl lg:text-5xl">
                {t('homepage.categories.title')}
              </h2>
            </motion.div>

            {categories.isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <CategoryCardSkeleton key={i} />
                ))}
              </div>
            ) : categories.isError ? (
              <ErrorState
                error={categories.error}
                onRetry={categories.retry}
                retryText={t('common.tryAgain')}
              />
            ) : (
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={stagger}
              >
                {displayCategories.map((category, idx) => (
                  <motion.div key={category.id} variants={itemFade} custom={idx}>
                    <Link
                      to={buildRoute.shopCategory(category.slug ?? '')}
                      className="collection-card group block aspect-[3/4]"
                    >
                      <img
                        src={category.image}
                        alt={category.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                        onError={createCategoryImageErrorHandler(category.name)}
                      />
                      <div className="absolute inset-0 z-10 flex flex-col justify-end p-5">
                        <h3 className="font-bold text-white text-base leading-tight drop-shadow-md">
                          {category.name}
                        </h3>
                        <p className="text-white/70 text-xs mt-1">
                          {category.count} {t('homepage.categories.productsCount')}
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </section>

        {/* Iridescent divider */}
        <hr className="iridescent-rule" />

        {/* ──────────────── SECTION 03: BRANDS (MARQUEE) ──────────────── */}
        <section className="section-brands relative py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] rounded-full blur-[80px]"
              style={{
                background: 'radial-gradient(ellipse, rgba(255,117,94,0.12) 0%, transparent 70%)',
              }}
            />
          </div>

          <div className="relative z-10">
            <motion.div
              className="container mx-auto px-4 sm:px-6 lg:px-8 mb-10"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
            >
              <div className="section-number mb-3">
                <Award className="w-3 h-3" />
                {isVi ? '03 / Thương Hiệu' : '03 / Brands'}
              </div>
              <h2 className="display-heading text-4xl lg:text-5xl">{t('homepage.brands.title')}</h2>
            </motion.div>

            {/* Marquee — auto-scroll brand names */}
            {!brands.isLoading && brandList.length > 0 && (
              <div className="marquee-container py-4">
                <div className="marquee-track">
                  {/* Duplicate list cho seamless loop */}
                  {[...brandList, ...brandList].map((brand, idx) => (
                    <Link
                      key={idx}
                      to={buildRoute.shopBrand(brand.id)}
                      className="flex-shrink-0 flex items-center justify-center mx-5"
                    >
                      <div className="glass-card-sm px-6 py-4 hover:border-primary-400/40 dark:hover:border-primary-400/30 transition-all min-w-[120px] text-center">
                        {(() => {
                          const brandName = localizeField(brand, 'name', i18n.language);
                          const logoSrc = brand.logo || getBrandLogoUrl(brandName);
                          return logoSrc ? (
                            <img
                              src={logoSrc}
                              alt={brandName}
                              className="h-7 w-auto mx-auto opacity-50 hover:opacity-90 dark:brightness-0 dark:invert dark:opacity-70 dark:hover:opacity-100 transition-all duration-300"
                              onError={(e) => {
                                // Fallback về text khi logo không load được
                                const img = e.currentTarget;
                                const span = document.createElement('span');
                                span.className =
                                  'text-xs font-bold tracking-wider uppercase text-neutral-500 dark:text-neutral-400 whitespace-nowrap';
                                span.textContent = img.alt;
                                img.parentElement?.replaceChild(span, img);
                              }}
                            />
                          ) : (
                            <span className="text-xs font-bold tracking-wider uppercase text-neutral-500 dark:text-neutral-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors whitespace-nowrap">
                              {brandName}
                            </span>
                          );
                        })()}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {brands.isLoading && (
              <div className="flex gap-4 overflow-hidden px-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 h-16 w-36 glass-card-sm animate-pulse rounded-2xl"
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Iridescent divider */}
        <hr className="iridescent-rule" />

        {/* ──────────────── SECTION 04: COLLECTIONS (EDITORIAL) ──────────────── */}
        <section className="relative overflow-hidden py-24">
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
            <div
              className="absolute -bottom-20 -left-20 w-[480px] h-[480px] rounded-full blur-[85px]"
              style={{
                background: 'radial-gradient(ellipse, rgba(42,172,167,0.22) 0%, transparent 70%)',
              }}
            />
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              className="mb-12"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
            >
              <div className="section-number mb-3">
                <Layers className="w-3 h-3" />
                {isVi ? '04 / Bộ Sưu Tập' : '04 / Collections'}
              </div>
              <h2 className="display-heading text-4xl lg:text-5xl">
                {t('homepage.collections.title')}
              </h2>
            </motion.div>

            {collections.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="aspect-[16/9] rounded-3xl glass-card animate-pulse" />
                ))}
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={stagger}
              >
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {displayCollections.map((collection: any, idx: number) => {
                  const imgSrc =
                    collection.thumbnail ||
                    collection.banner ||
                    COLLECTION_FALLBACKS[collection.slug] ||
                    COLLECTION_FALLBACKS['dien-thoai-moi-nhat'];
                  const descText =
                    (i18n.language === 'en'
                      ? collection.descriptionEn
                      : collection.descriptionVi) ||
                    collection.description ||
                    t('homepage.collections.fallbackDescription');

                  return (
                    <motion.div key={collection.id} variants={itemFade} custom={idx}>
                      <Link
                        to={buildRoute.shopCollection(collection.id)}
                        className="collection-card group block"
                        style={{ aspectRatio: idx === 0 ? '16/10' : '16/10' }}
                      >
                        <img
                          src={imgSrc}
                          alt={localizeField(collection, 'name', i18n.language)}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 z-10 flex flex-col justify-end p-8">
                          <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 drop-shadow-lg leading-tight">
                            {localizeField(collection, 'name', i18n.language)}
                          </h3>
                          <p className="text-white/75 text-sm mb-5 max-w-xs leading-relaxed">
                            {descText}
                          </p>
                          <span className="collection-cta w-fit">
                            {t('homepage.collections.exploreButton')}
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>
        </section>

        {/* ──────────────── NEWS ──────────────── */}
        <HomeNewsSection />

        {/* Iridescent divider */}
        <hr className="iridescent-rule" />

        {/* ──────────────── SECTION 05: NEWSLETTER ──────────────── */}
        <section className="section-newsletter relative overflow-hidden py-24">
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] rounded-full blur-[100px]"
              style={{
                background: 'radial-gradient(ellipse, rgba(42,172,167,0.18) 0%, transparent 65%)',
              }}
            />
            <div
              className="absolute -bottom-16 right-0 w-[350px] h-[350px] rounded-full blur-[80px]"
              style={{
                background: 'radial-gradient(ellipse, rgba(255,117,94,0.14) 0%, transparent 70%)',
              }}
            />
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              className="glass-section-card max-w-xl mx-auto px-8 py-12 text-center"
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-500/10 dark:bg-primary-500/15 mb-5 mx-auto">
                <Mail className="w-5 h-5 text-primary-500 dark:text-primary-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white mb-3 tracking-tight">
                {t('homepage.newsletter.title')}
              </h2>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-7 max-w-sm mx-auto leading-relaxed">
                {t('homepage.newsletter.description')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder={t('homepage.newsletter.emailPlaceholder')}
                  className="glass-input flex-grow px-4 py-3 text-sm"
                />
                <PremiumButton
                  variant="primary"
                  size="large"
                  iconType="arrow-right"
                  className="px-5 py-3 shrink-0"
                  onClick={handleNewsletterSubmit}
                  loading={isSubscribing}
                >
                  {t('homepage.newsletter.subscribe')}
                </PremiumButton>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
      {/* end page-canvas */}
    </PageLayout>
  );
};

export default HomePage;
