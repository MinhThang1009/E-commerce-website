/**
 * @file ProductListCard.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Product } from '@/features/catalog';
import { useCartStore } from '@/stores/cart-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';
import { useAddToCartMutation } from '@/features/cart';
import { calculatePriceRange, calculateDiscountPercentage } from '@/utils/price-utils';
import { proxyImg } from '@/utils/proxy-img';
import { v4 as uuidv4 } from 'uuid';
import { ShoppingCartIcon } from '@heroicons/react/24/outline';
import { getErrorMsg } from '@/utils/error-utils';

interface ProductListCardProps extends Product {
  enableVariantPricing?: boolean; // Option để bật/tắt việc load variants
}

const ProductListCard: React.FC<ProductListCardProps> = ({
  id,
  name,
  thumbnail,
  price,
  compareAtPrice,
  shortDescription,
  ratings,
  isNew,
  slug: _slug,
  variants,
  enableVariantPricing: _enableVariantPricing = false, // Mặc định tắt để tránh quá nhiều API calls
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const addNotification = useUiStore((s) => s.addNotification);
  const addItem = useCartStore((s) => s.addItem);
  const setServerCart = useCartStore((s) => s.setServerCart);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  // Lấy thông tin đăng nhập từ Zustand store
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Mutation thêm vào giỏ hàng
  const { mutateAsync: addToCart } = useAddToCartMutation();

  // Luôn sử dụng ID để đảm bảo API sản phẩm liên quan hoạt động đúng
  const productUrl = `/products/${id}`;

  // Sử dụng variants từ API response để tính khoảng giá
  const priceInfo = calculatePriceRange(price, variants);
  const discount = compareAtPrice
    ? calculateDiscountPercentage(compareAtPrice, priceInfo.basePrice)
    : 0;

  // Xử lý thêm vào giỏ hàng
  const handleAddToCart = async (e?: React.MouseEvent | React.FormEvent) => {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }

    if (isAddingToCart) return;
    setIsAddingToCart(true);

    try {
      if (isAuthenticated) {
        // Nếu đã đăng nhập, sử dụng API
        const serverCartData = await addToCart({
          productId: id,
          quantity: 1,
        });

        // Cập nhật Zustand store với phản hồi từ server
        setServerCart(serverCartData);
      } else {
        // Nếu chưa đăng nhập, lưu vào localStorage
        const newItem = {
          id: uuidv4(),
          productId: id,
          name,
          price,
          quantity: 1,
          image: thumbnail,
        };
        addItem(newItem);
      }

      addNotification({
        message: t('product.addedToCartMsg', { name }),
        type: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Thêm vào giỏ hàng thất bại:', error);
      addNotification({
        message: getErrorMsg(error, t('product.addToCartError')),
        type: 'error',
        duration: 3000,
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Xử lý mua ngay
  const handleBuyNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isBuying) return;
    setIsBuying(true);

    try {
      const buyNowItem = {
        id: uuidv4(),
        productId: id,
        name,
        price,
        quantity: 1,
        image: thumbnail,
      };

      // Lưu vào sessionStorage để CheckoutPage sử dụng
      sessionStorage.setItem('buyNowItem', JSON.stringify(buyNowItem));
      sessionStorage.setItem('buyNowAction', 'true');

      navigate('/checkout?buyNow=true');
    } catch (error) {
      console.error('Mua ngay thất bại:', error);
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <div className="group relative bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-100 dark:border-neutral-800 hover:shadow-xl hover:border-primary-200/40 dark:hover:border-primary-800/40 transition-all duration-300">
      <div className="flex min-h-[200px]">
        {/* Image section — bên trái */}
        <div className="relative w-64 sm:w-80 md:w-96 flex-shrink-0 self-stretch overflow-hidden bg-neutral-50 dark:bg-neutral-800">
          {/* Badges */}
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
            {compareAtPrice && compareAtPrice > priceInfo.basePrice && (
              <span className="bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                -{discount}%
              </span>
            )}
            {isNew && (
              <span className="bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                {t('product.new')}
              </span>
            )}
          </div>

          <Link to={productUrl} className="block w-full h-full">
            <img
              src={proxyImg(thumbnail)}
              alt={name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 ease-out"
              loading="lazy"
            />
          </Link>

          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>

        {/* Content section — bên phải */}
        <div className="flex-1 flex flex-col p-5 sm:p-6 min-w-0">
          {/* Tiêu đề + đánh giá */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <Link to={productUrl} className="flex-1 min-w-0">
              <h3 className="font-bold text-base sm:text-lg leading-snug line-clamp-2 text-neutral-900 dark:text-neutral-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200">
                {name}
              </h3>
            </Link>
            {ratings && (
              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 rounded-lg shrink-0 border border-amber-200/50 dark:border-amber-800/50">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 text-amber-500 fill-amber-500"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {ratings.average}
                </span>
              </div>
            )}
          </div>

          {shortDescription && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 mb-3 leading-relaxed">
              {shortDescription}
            </p>
          )}

          {/* Giá — đẩy xuống dưới bằng mt-auto */}
          <div className="mt-auto space-y-1 mb-4">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                {priceInfo.priceText}
              </span>
              {compareAtPrice && compareAtPrice > priceInfo.basePrice && (
                <span className="text-sm text-neutral-400 dark:text-neutral-500 line-through font-medium">
                  {compareAtPrice.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
                  {t('common.currencySymbol')}
                </span>
              )}
            </div>
            {compareAtPrice && compareAtPrice > priceInfo.basePrice && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                {t('product.savings', {
                  amount: `${(compareAtPrice - priceInfo.basePrice).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}${t('common.currencySymbol')}`,
                })}{' '}
                • {discount}%
              </p>
            )}
          </div>

          {/* Nút hành động */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleBuyNow}
              disabled={isBuying}
              className="btn-glass-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2"
            >
              {isBuying ? (
                <div className="h-4 w-4 border-2 border-white/70 border-t-white rounded-full animate-spin" />
              ) : (
                <ShoppingCartIcon className="h-5 w-5" />
              )}
              {t('product.buyNowDelivery')}
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                className="btn-glass-cart flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
              >
                {isAddingToCart ? (
                  <div className="h-4 w-4 border-2 border-white/70 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13v6a2 2 0 002 2h8a2 2 0 002-2v-6"
                    />
                  </svg>
                )}
                <span>{isAddingToCart ? t('product.adding') : t('product.addToCart')}</span>
              </button>

              <Link
                to={productUrl}
                className="btn-glass-secondary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
              >
                <svg
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span>{t('product.viewDetails')}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductListCard;
