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
import { EmptyState } from '@/components/common/ErrorState';
import { useGetWishlistQuery, useClearWishlistMutation } from '../api/wishlist-api';
import { ProductCard } from '@/features/catalog';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { Heart } from 'lucide-react';
import { useWishlistStore } from '@/stores/wishlist-store';
import { useAuthStore } from '@/stores/auth-store';

const WishlistPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const clearWishlistLocal = useWishlistStore((s) => s.clearWishlistLocal);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);

  const { data: wishlistData, isLoading } = useGetWishlistQuery(undefined, {
    enabled: isAuthenticated,
  });
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
          <Heart className="h-8 w-8 text-rose-500" />
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
        <EmptyState
          variant="wishlist"
          title={t('wishlist.emptyTitle')}
          description={t('wishlist.emptyDesc')}
          actionLabel={t('wishlist.continueShopping')}
          onAction={() => navigate(ROUTES.SHOP)}
        />
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
