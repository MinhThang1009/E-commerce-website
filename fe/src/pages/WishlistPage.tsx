import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useGetWishlistQuery, useClearWishlistMutation } from '@/services/wishlistApi';
import ProductCard from '@/components/features/ProductCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { HeartIcon } from '@heroicons/react/24/outline';
import { useDispatch } from 'react-redux';
import { clearWishlistLocal } from '@/features/wishlist/wishlistSlice';

const WishlistPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const { data: wishlistData, isLoading, refetch } = useGetWishlistQuery();
  const [clearWishlist, { isLoading: isClearing }] = useClearWishlistMutation();

  const handleClearWishlist = async () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tất cả sản phẩm yêu thích?')) {
      try {
        dispatch(clearWishlistLocal());
        await clearWishlist().unwrap();
      } catch (error) {
        console.error('Failed to clear wishlist:', error);
      }
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

        {items.length > 0 && (
          <button
            onClick={handleClearWishlist}
            disabled={isClearing}
            className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
          >
            {isClearing ? 'Đang xóa...' : 'Xóa tất cả'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <div className="bg-neutral-100 dark:bg-neutral-800 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
            <HeartIcon className="h-10 w-10 text-neutral-400 dark:text-neutral-500" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
            Danh sách yêu thích trống
          </h2 >
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            Bạn chưa thêm sản phẩm nào vào danh sách yêu thích.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-2.5 px-6 font-semibold transition-colors"
          >
            Tiếp tục mua sắm
          </Link>
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
