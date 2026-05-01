import React from 'react';
import { message } from 'antd';
import { HeroSection, HomeNewsSection } from '@/components/sections';
import {
  ProductCardSkeleton,
  CategoryCardSkeleton,
} from '@/components/common/LoadingState';
import { ErrorState, EmptyState } from '@/components/common/ErrorState';
import { ProductGrid, CategoryGrid } from '@/components/layout/Grid';
import { PageLayout, PageSection } from '@/components/layout/PageLayout';
import { useGetCategoriesQuery } from '@/services/categoryApi';
import { useGetFeaturedProductsQuery } from '@/services/productApi';
import { useGetBrandsQuery } from '@/services/brandApi';
import { useGetCollectionsQuery } from '@/services/collectionApi';
import { useSubscribeNewsletterMutation } from '@/services/contactApi';
import { useApiState } from '@/hooks/useApiState';
import {
  getCategoryImage,
  createCategoryImageErrorHandler,
} from '@/utils/imageUtils';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ProductCard from '@/components/features/ProductCard';
import { PremiumButton, BannerDisplay } from '@/components/common';

/**
 * HomePage component - Main landing page with hero, featured products, and categories
 */
const HomePage: React.FC = () => {
  const { t } = useTranslation();

  // API queries with enhanced state management
  const featuredProductsQuery = useGetFeaturedProductsQuery({ limit: 4 });
  const categoriesQuery = useGetCategoriesQuery();

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

  const brandsQuery = useGetBrandsQuery({ isActive: true });
  const brands = useApiState({
    data: brandsQuery.data?.data,
    isLoading: brandsQuery.isLoading,
    error: brandsQuery.error,
    refetch: brandsQuery.refetch,
    isArray: true,
  });

  const collectionsQuery = useGetCollectionsQuery({ isActive: true });
  const collections = useApiState({
    data: collectionsQuery.data?.data,
    isLoading: collectionsQuery.isLoading,
    error: collectionsQuery.error,
    refetch: collectionsQuery.refetch,
    isArray: true,
  });

  // Newsletter subscription
  const [newsletterEmail, setNewsletterEmail] = React.useState('');
  const [subscribeNewsletter, { isLoading: isSubscribing }] = useSubscribeNewsletterMutation();

  const handleNewsletterSubmit = async () => {
    if (!newsletterEmail) {
      message.error(t('homepage.newsletter.emailRequired') || 'Vui lòng nhập email');
      return;
    }

    try {
      const response = await subscribeNewsletter({ email: newsletterEmail }).unwrap();
      message.success(response.message);
      setNewsletterEmail('');
    } catch (error: any) {
      message.error(error?.data?.message || 'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại sau.');
    }
  };

  // Transform categories for display
  const displayCategories =
    categories.data?.slice(0, 6).map((category: any) => ({
      id: category.id,
      name: category.name,
      image: category.image
        ? category.image.startsWith('http')
          ? category.image
          : `${import.meta.env.VITE_API_URL || 'http://localhost:8888'}${category.image}`
        : getCategoryImage(category.name, category.slug),
      count: category.productCount || 0,
      slug: category.slug,
    })) || [];

  return (
    <PageLayout
      title="Trang chủ"
      description="Khám phá các sản phẩm chất lượng với giá cả tốt nhất"
      keywords="mua sắm, sản phẩm chất lượng, giá tốt"
      showContainer={false}
    >
      {/* Hero Banners */}
      <BannerDisplay position="home_hero" className="container mx-auto px-4 mt-8" />

      {/* Hero Section */}
      <HeroSection />

      {/* Featured Products */}
      <PageSection
        title={t('homepage.featuredProducts.title')}
        className="py-12 bg-neutral-50 dark:bg-neutral-900"
        headerActions={
          <Link
            to="/shop"
            className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium flex items-center"
          >
            {t('homepage.featuredProducts.viewAll')}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 ml-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        }
      >
        {featuredProducts.isLoading ? (
          <ProductGrid>
            {Array.from({ length: 4 }).map((_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </ProductGrid>
        ) : featuredProducts.isError ? (
          <ErrorState
            error={featuredProducts.error}
            onRetry={featuredProducts.retry}
            retryText="Thử lại"
          />
        ) : featuredProducts.isEmpty ? (
          <EmptyState
            title="Không có sản phẩm nổi bật"
            description="Hiện tại chưa có sản phẩm nổi bật nào để hiển thị."
          />
        ) : (
          <ProductGrid>
            {featuredProducts.data?.data?.map((product: any) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </ProductGrid>
        )}
      </PageSection>

      {/* Middle Banner */}
      <BannerDisplay
        position="home_middle"
        className="container mx-auto px-4"
      />

      {/* Categories */}
      <PageSection
        title={t('homepage.categories.title')}
        className="py-12 bg-white dark:bg-neutral-800"
      >
        {categories.isLoading ? (
          <CategoryGrid>
            {Array.from({ length: 6 }).map((_, index) => (
              <CategoryCardSkeleton key={index} />
            ))}
          </CategoryGrid>
        ) : categories.isError ? (
          <ErrorState
            error={categories.error}
            onRetry={categories.retry}
            retryText="Thử lại"
          />
        ) : categories.isEmpty ? (
          <EmptyState
            title="Không có danh mục"
            description="Hiện tại chưa có danh mục nào để hiển thị."
          />
        ) : (
          <CategoryGrid>
            {displayCategories.map((category) => (
              <Link
                key={category.id}
                to={`/shop?category=${category.slug}`}
                className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="aspect-w-3 aspect-h-2 bg-neutral-100 dark:bg-neutral-700">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={createCategoryImageErrorHandler(category.name)}
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-6">
                  <h3 className="text-lg md:text-xl font-bold text-white mb-0.5 drop-shadow-md truncate">
                    {category.name}
                  </h3>
                  <p className="text-white text-xs md:text-sm drop-shadow-md">
                    {category.count} {t('homepage.categories.productsCount')}
                  </p>
                </div>
              </Link>
            ))}
          </CategoryGrid>
        )}
      </PageSection>

      {/* Brands Section */}
      <PageSection
        title={t('homepage.brands.title')}
        className="py-12 bg-neutral-50 dark:bg-neutral-900"
        headerActions={
          <Link
            to="/shop"
            className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium flex items-center"
          >
            {t('homepage.brands.viewAll')}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 ml-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {brands.isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse"
                />
              ))
            : brands.data?.map((brand: any) => (
                <Link
                  key={brand.id}
                  to={`/shop?brand=${brand.id}`}
                  className="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center border border-neutral-100 dark:border-neutral-700 group"
                >
                  {brand.logo ? (
                    <img
                      src={brand.logo}
                      alt={brand.name}
                      className="max-h-12 w-auto grayscale group-hover:grayscale-0 transition-all"
                    />
                  ) : (
                    <span className="text-lg font-bold text-neutral-400 group-hover:text-primary-500 transition-colors uppercase">
                      {brand.name}
                    </span>
                  )}
                </Link>
              ))}
        </div>
      </PageSection>

      {/* Collections Section */}
      <PageSection
        title={t('homepage.collections.title')}
        className="py-12 bg-white dark:bg-neutral-800"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {collections.isLoading
            ? Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-w-16 aspect-h-9 bg-neutral-200 dark:bg-neutral-700 rounded-2xl animate-pulse"
                />
              ))
            : collections.data?.slice(0, 2).map((collection: any) => (
                <Link
                  key={collection.id}
                  to={`/shop?collection=${collection.id}`}
                  className="group relative h-80 overflow-hidden rounded-2xl shadow-xl"
                >
                  <img
                    src={
                      collection.banner ||
                      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=80'
                    }
                    alt={collection.name}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent flex flex-col justify-center p-10">
                    <h3 className="text-3xl font-extrabold text-white mb-4 drop-shadow-lg">
                      {collection.name}
                    </h3>
                    <p className="text-neutral-200 mb-6 max-w-xs drop-shadow-md">
                      {collection.description ||
                        'Khám phá bộ sưu tập mới nhất với phong cách độc đáo.'}
                    </p>
                    <div>
                      <span className="inline-flex items-center px-6 py-3 rounded-full bg-white text-neutral-900 font-bold hover:bg-neutral-100 transition-colors">
                        Khám phá ngay
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 ml-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
        </div>
      </PageSection>


      {/* News Section */}
      <HomeNewsSection />

      {/* Newsletter */}
      <PageSection
        className="py-16 bg-white dark:bg-neutral-800 relative overflow-hidden"
        containerized={false}
      >
        <div className="absolute inset-0 opacity-10">
          <img
            src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=2070&q=80"
            alt={t('homepage.newsletter.backgroundAlt')}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="container mx-auto px-4 max-w-3xl text-center relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-3">
            {t('homepage.newsletter.title')}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-300 mb-8">
            {t('homepage.newsletter.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder={t('homepage.newsletter.emailPlaceholder')}
              className="flex-grow px-4 py-3 rounded-lg sm:rounded-r-none border border-neutral-300 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-neutral-700 dark:text-neutral-100"
            />
            <PremiumButton
              variant="primary"
              size="large"
              iconType="arrow-right"
              className="px-6 py-3 sm:rounded-l-none"
              onClick={handleNewsletterSubmit}
              loading={isSubscribing}
            >
              {t('homepage.newsletter.subscribe')}
            </PremiumButton>
          </div>
        </div>
      </PageSection>
    </PageLayout>
  );
};

export default HomePage;
