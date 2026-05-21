/**
 * @file WishlistPage.tsx
 * @layer Page
 * @feature wishlist
 * @description Page component của feature wishlist
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/routes/paths';
import { PremiumButton } from '@/components/common';
import { useGetWishlistQuery, useClearWishlistMutation } from '../api/wishlist-api';
import { ProductCard } from '@/features/catalog';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { HeartIcon } from '@heroicons/react/24/outline';
import { useWishlistStore } from '@/stores/wishlist-store';

const WishlistPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const clearWishlistLocal = useWishlistStore((s) => s.clearWishlistLocal);
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);

  const { data: wishlistData, isLoading } = useGetWishlistQuery();
  const { mutateAsync: clearWishlist, isPending: isClearing } = useClearWishlistMutation();

  const handleClearWishlist = async () => {
    try {
      clearWishlistLocal();
      await clearWishlist();
    } catch (error) {
      console.error('Failed to clear wishlist:', error);
    } finally {
      setShowClearConfirm(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  const items = wishlistData?.data || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8 border-b border-neutral-200 dark:border-neutral-700 pb-4">
        <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
          <HeartIcon className="h-8 w-8 text-rose-500" />
          {t('header.dropdown.wishlist')}
        </h1>

        {items.length > 0 &&
          (showClearConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('wishlist.confirmClear')}
              </span>
              <button
                onClick={handleClearWishlist}
                disabled={isClearing}
                className="px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {isClearing ? t('wishlist.clearing') : t('common.confirm')}
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-sm font-medium border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
            >
              {t('wishlist.clearAll')}
            </button>
          ))}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <div className="bg-neutral-100 dark:bg-neutral-800 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
            <HeartIcon className="h-10 w-10 text-neutral-400 dark:text-neutral-500" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
            {t('wishlist.emptyTitle')}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">{t('wishlist.emptyDesc')}</p>
          <PremiumButton
            variant="primary"
            size="large"
            iconType="arrow-right"
            onClick={() => navigate(ROUTES.SHOP)}
            className="px-8"
          >
            {t('wishlist.continueShopping')}
          </PremiumButton>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
