import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Product } from '@/types/product.types';
import { addItem, setServerCart } from '@/features/cart/cartSlice';
import { addNotification } from '@/features/ui/uiSlice';
import { useAddToCartMutation } from '@/services/cartApi';
import {
  calculatePriceRange,
  calculateDiscountPercentage,
} from '@/utils/priceUtils';
import { v4 as uuidv4 } from 'uuid';
import { RootState } from '@/store';
import { ShoppingCartIcon } from '@heroicons/react/24/outline';

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
  slug,
  variants,
  enableVariantPricing = false, // Mặc định tắt để tránh quá nhiều API calls
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  // Lấy thông tin đăng nhập từ Redux store
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );

  // Chỉ khởi tạo API mutation khi đã đăng nhập
  const [addToCart] = useAddToCartMutation();

  // Luôn sử dụng ID để đảm bảo API sản phẩm liên quan hoạt động đúng
  const productUrl = `/products/${id}`;

  // Sử dụng variants từ API response để tính khoảng giá
  const priceInfo = calculatePriceRange(price, variants);
  const discount = compareAtPrice
    ? calculateDiscountPercentage(compareAtPrice, priceInfo.basePrice)
    : 0;

  // Handle add to cart
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
        const serverCart = await addToCart({
          productId: id,
          quantity: 1,
        }).unwrap();

        // Update Redux store with server response
        dispatch(setServerCart(serverCart));
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
        dispatch(addItem(newItem));
      }

      dispatch(
        addNotification({
          message: `${name} đã được thêm vào giỏ hàng`,
          type: 'success',
          duration: 3000,
        })
      );
    } catch (error: any) {
      console.error('Add to cart failed:', error);
      dispatch(
        addNotification({
          message: error?.data?.message || 'Có lỗi xảy ra khi thêm vào giỏ hàng',
          type: 'error',
          duration: 3000,
        })
      );
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Handle buy now
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
      console.error('Buy now failed:', error);
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <div className="group relative bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden transition-all duration-500 ease-out hover:shadow-2xl hover:-translate-y-1 border border-neutral-100/50 dark:border-neutral-800/50 hover:border-primary-200/30 dark:hover:border-primary-800/30 backdrop-blur-sm">
      <div className="flex flex-col lg:flex-row gap-6 p-8">
        {/* Enhanced Image Section */}
        <div className="relative w-full lg:w-80 h-64 lg:h-48 flex-shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900">
          {/* Enhanced badges */}
          <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-2">
            {compareAtPrice && compareAtPrice > priceInfo.basePrice && (
              <div className="bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl backdrop-blur-sm border border-white/20">
                <span className="drop-shadow-sm">-{discount}%</span>
              </div>
            )}
            {isNew && (
              <div className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl backdrop-blur-sm border border-white/20">
                <span className="drop-shadow-sm">MỚI</span>
              </div>
            )}
          </div>

          {/* Enhanced product image */}
          <Link to={productUrl} className="block w-full h-full">
            <img
              src={thumbnail}
              alt={name}
              className="w-full h-full object-cover object-center transform group-hover:scale-110 transition-transform duration-700 ease-out"
              loading="lazy"
            />
          </Link>

          {/* Image overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
        </div>

        {/* Enhanced Content Section */}
        <div className="flex-1 flex flex-col justify-between space-y-6">
          {/* Header section with rating */}
          <div className="space-y-4">
            <div className="flex justify-between items-start gap-4">
              <Link to={productUrl} className="flex-1">
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 line-clamp-2 leading-tight group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  {name}
                </h3>
              </Link>
              {ratings && (
                <div className="flex items-center bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 px-4 py-2 rounded-xl border border-amber-200/50 dark:border-amber-800/50 shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-amber-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm text-amber-700 dark:text-amber-300 ml-2 font-semibold">
                    {ratings.average}
                  </span>
                </div>
              )}
            </div>

            {/* Enhanced description */}
            {shortDescription && (
              <p className="text-neutral-600 dark:text-neutral-400 text-base leading-relaxed line-clamp-3 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors duration-200">
                {shortDescription}
              </p>
            )}
          </div>

          {/* Enhanced price and actions section */}
          <div className="space-y-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            {/* Price section */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-4">
                <span className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
                  {priceInfo.priceText}
                </span>
                {compareAtPrice && compareAtPrice > priceInfo.basePrice && (
                  <span className="text-lg text-neutral-400 dark:text-neutral-500 line-through font-medium">
                    {compareAtPrice.toLocaleString('vi-VN')}đ
                  </span>
                )}
              </div>
              {compareAtPrice && compareAtPrice > priceInfo.basePrice && (
                <div className="flex items-center gap-3">
                  <span className="text-base text-emerald-600 dark:text-emerald-400 font-bold">
                    Tiết kiệm{' '}
                    {(compareAtPrice - priceInfo.basePrice).toLocaleString(
                      'vi-VN'
                    )}
                    đ
                  </span>
                  <div className="h-1.5 w-1.5 bg-neutral-300 dark:bg-neutral-600 rounded-full"></div>
                  <span className="text-base text-emerald-600 dark:text-emerald-400 font-bold">
                    {discount}% OFF
                  </span>
                </div>
              )}
            </div>

            {/* Enhanced action buttons */}
            <div className="flex flex-col gap-3">
              {/* Buy now button */}
              <button
                onClick={handleBuyNow}
                disabled={isBuying}
                className="w-full bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 hover:from-orange-600 hover:via-orange-700 hover:to-orange-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl px-6 py-4 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.01] active:scale-[0.99] font-bold text-lg flex items-center justify-center gap-3 group/buynow"
              >
                {isBuying ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <ShoppingCartIcon className="h-6 w-6 transition-transform duration-200 group-hover/buynow:scale-110" />
                )}
                <span>MUA NGAY - GIAO TẬN NHÀ</span>
              </button>

              <div className="flex items-center gap-4">
                {/* Add to cart button */}
                <button
                  onClick={handleAddToCart}
                  disabled={isAddingToCart}
                  className="flex-1 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-700 hover:via-emerald-800 hover:to-emerald-900 disabled:from-gray-400 disabled:via-gray-500 disabled:to-gray-600 text-white rounded-xl px-4 py-3.5 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 font-semibold text-base group/cart"
                >
                  <div className="flex items-center justify-center gap-3">
                    {isAddingToCart ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 transition-transform duration-200 group-hover/cart:scale-110"
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
                    <span className="font-medium">
                      {isAddingToCart ? 'Đang thêm...' : 'Thêm vào giỏ'}
                    </span>
                  </div>
                </button>

                {/* Quick view button */}
                <Link
                  to={productUrl}
                  className="flex-1 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 hover:from-primary-700 hover:via-primary-800 hover:to-primary-900 text-white rounded-xl px-6 py-4 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] font-semibold text-base group/view"
                >
                  <div className="flex items-center justify-center gap-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 transition-transform duration-200 group-hover/view:scale-110"
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
                    <span className="font-medium">Xem chi tiết</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Premium glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-600/0 via-primary-600/0 to-primary-600/0 group-hover:from-primary-600/5 group-hover:via-primary-600/10 group-hover:to-primary-600/5 transition-all duration-500 pointer-events-none"></div>
    </div>
  );
};

export default ProductListCard;
