/**
 * @file ProductCard.tsx
 * @layer Component
 * @feature catalog
 * @description Card sản phẩm — glass 2.0, teal CTA, mix-blend-mode cho nền trắng CDN
 */
import { useUiStore } from '@/stores/ui-store';
import { proxyImg } from '@/utils/proxy-img';
import { Product } from '@/features/catalog';
import { calculatePriceRange } from '@/utils/price-utils';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeField } from '@/utils/localize';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { useWishlistStore } from '@/stores/wishlist-store';
import { useAddToWishlistMutation, useRemoveFromWishlistMutation } from '@/features/wishlist';
import { Heart, ShoppingCart, Eye } from 'lucide-react';
import { useAddToCartMutation } from '@/features/cart';
import { motion } from 'framer-motion';

interface ProductCardProps extends Product {
  discountPercentage?: number;
  enableVariantPricing?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  nameVi,
  nameEn,
  thumbnail,
  price,
  compareAtPrice,
  ratings,
  isNew,
  slug: _slug,
  discountPercentage,
  variants,
  enableVariantPricing: _enableVariantPricing = false,
}) => {
  const { t, i18n } = useTranslation();
  const displayName = localizeField({ name, nameVi, nameEn }, 'name', i18n.language);
  const navigate = useNavigate();
  const addNotification = useUiStore((s) => s.addNotification);

  const wishlistItems = useWishlistStore((s) => s.items);
  const addToWishlistLocal = useWishlistStore((s) => s.addToWishlistLocal);
  const removeFromWishlistLocal = useWishlistStore((s) => s.removeFromWishlistLocal);
  const isWishlisted = wishlistItems.includes(id);

  const { mutateAsync: addToWishlist } = useAddToWishlistMutation();
  const { mutateAsync: removeFromWishlist } = useRemoveFromWishlistMutation();
  const { mutateAsync: _addToCart } = useAddToCartMutation();
  const [isToggling, setIsToggling] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const priceInfo = calculatePriceRange(price, variants);
  const discount =
    discountPercentage !== undefined
      ? Math.round(discountPercentage)
      : compareAtPrice
        ? Math.round(((compareAtPrice - priceInfo.basePrice) / compareAtPrice) * 100)
        : 0;

  const productUrl = `/products/${id}`;

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      addNotification({ type: 'info', message: t('product.loginToWishlist') });
      navigate('/login');
      return;
    }
    if (isToggling) return;
    setIsToggling(true);
    try {
      if (isWishlisted) {
        removeFromWishlistLocal(id);
        await removeFromWishlist(id);
      } else {
        addToWishlistLocal(id);
        await addToWishlist({ productId: id });
      }
    } catch {
      if (isWishlisted) addToWishlistLocal(id);
      else removeFromWishlistLocal(id);
    } finally {
      setIsToggling(false);
    }
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(productUrl);
  };

  const handleBuyNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBuying) return;
    setIsBuying(true);
    const defaultVariant = variants?.find((v) => v.isDefault) || variants?.[0];
    try {
      const buyNowItem = {
        id: defaultVariant ? `${id}-${defaultVariant.id}` : id,
        productId: id,
        variantId: defaultVariant?.id,
        name: displayName,
        price: defaultVariant?.price || price,
        quantity: 1,
        image: thumbnail,
        inStock: true,
        stockQuantity: defaultVariant?.stockQuantity || 10,
        attributes: defaultVariant ? { variant: defaultVariant.name } : undefined,
      };
      sessionStorage.setItem('buyNowItem', JSON.stringify(buyNowItem));
      sessionStorage.setItem('buyNowAction', 'true');
      navigate('/checkout?buyNow=true');
    } catch {
      addNotification({ type: 'error', message: t('product.buyNowFailed') });
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <motion.div
      className="group relative glass-product-card h-full flex flex-col"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ── Image area ── */}
      {/*
       * Image area: neutral-50 light mode (blend seamless với white img bg)
       * dark:bg-[#1c2030] — dark navy, đủ tối để không jarring, đủ sáng để product visible
       */}
      {/*
       * aspect-square: tự scale theo chiều rộng cột → responsive hoàn toàn
       * bg-white: CDN images có nền trắng → seamless
       * translateZ(0): GPU layer → fix zoom artifact
       */}
      <div
        className="relative w-full aspect-square overflow-hidden bg-white shrink-0 rounded-t-[1.5rem]"
        style={{ transform: 'translateZ(0)', willChange: 'transform' }}
      >
        {/* Discount / New badges */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
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

        {/* Wishlist — scale bounce khi toggle */}
        <motion.button
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-white/80 dark:bg-neutral-700/80 backdrop-blur-sm shadow hover:bg-white dark:hover:bg-neutral-700 transition-all"
          onClick={handleToggleWishlist}
          disabled={isToggling}
          aria-label={t('product.toggleWishlist')}
          whileTap={{ scale: 0.85 }}
          animate={isWishlisted ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          {isWishlisted ? (
            <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
          ) : (
            <Heart className="h-4 w-4 text-neutral-400 group-hover:text-rose-400 transition-colors" />
          )}
        </motion.button>

        {/* Product image
         * mix-blend-mode: multiply — loại bỏ nền trắng baked-in của ảnh CDN
         * bg-neutral-50/neutral-100 + multiply = white pixels trở nên transparent
         */}
        <Link to={productUrl} className="block w-full h-full">
          <img
            src={proxyImg(thumbnail)}
            alt={displayName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </Link>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>

      {/* ── Info area ── */}
      <div className="p-4 flex flex-col gap-2 flex-grow">
        {/* Rating */}
        {ratings && (
          <div className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {ratings.average}
            </span>
          </div>
        )}

        {/* Name */}
        <Link to={productUrl}>
          <h3 className="font-bold text-sm sm:text-base leading-snug line-clamp-2 text-neutral-900 dark:text-neutral-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
            {displayName}
          </h3>
        </Link>

        {/* Price */}
        <div className="mt-auto pt-1 flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">
              {priceInfo.priceText}
            </span>
            {compareAtPrice && compareAtPrice > priceInfo.basePrice && (
              <span className="text-xs text-neutral-400 line-through">
                {compareAtPrice.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
                {t('common.currencySymbol')}
              </span>
            )}
          </div>
          {compareAtPrice && compareAtPrice > priceInfo.basePrice && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">
                {t('product.savings', {
                  amount: `${(compareAtPrice - priceInfo.basePrice).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}${t('common.currencySymbol')}`,
                })}
              </span>
            </div>
          )}
        </div>

        {/* CTAs — Glass 2.0 với đầy đủ hover/active effects */}
        <div className="flex flex-col gap-2 mt-2">
          <button
            className="btn-glass-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
            onClick={handleBuyNow}
            disabled={isBuying}
          >
            {isBuying ? (
              <div className="h-4 w-4 border-2 border-white/70 border-t-white rounded-full animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            {t('product.buyNow')}
          </button>

          <button
            className="btn-glass-secondary w-full py-2 text-sm flex items-center justify-center gap-1.5"
            onClick={handleViewDetails}
          >
            <Eye className="w-4 h-4 flex-shrink-0" />
            {t('product.viewDetails')}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(ProductCard);
