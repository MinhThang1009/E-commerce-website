/**
 * @file CartItem.tsx
 * @layer Component
 * @feature cart
 * @description UI component cho feature cart
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildRoute } from '@/routes/paths';
import { toast } from '@/utils/toast';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import {
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
} from '../api/cartApi';
import type { CartItem as CartItemType } from '../types/cart.types';
import { formatPrice, parsePrice } from '@/utils/format';

interface CartItemProps {
  item: CartItemType;
  isCheckout?: boolean;
  readonly?: boolean;
  maxStock?: number;
}

const CartItem: React.FC<CartItemProps> = ({ item, isCheckout = false, readonly: _readonly = false, maxStock }) => {
  const { t } = useTranslation();
  const effectiveMaxStock = maxStock ?? item.stockQuantity;
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const _isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { mutateAsync: updateCartItem, isPending: isUpdating } = useUpdateCartItemMutation();
  const { mutateAsync: removeCartItem, isPending: isRemoving } = useRemoveCartItemMutation();

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity <= 0 || newQuantity > 99) return;

    if (effectiveMaxStock && newQuantity > effectiveMaxStock) {
      toast.error(t('cart.notifications.stockLimit', { count: effectiveMaxStock }));
      return;
    }

    try {
      if (item.id && typeof item.id === 'string') {
        await updateCartItem({ id: item.id, data: { quantity: newQuantity } });
        toast.success(t('cart.notifications.quantityUpdated'));
      } else {
        updateQuantity({ id: item.id, quantity: newQuantity });
        toast.success(t('cart.notifications.quantityUpdatedOffline'));
      }
    } catch (error) {
      console.error('Lỗi cập nhật sản phẩm trong giỏ:', error);
      updateQuantity({ id: item.id, quantity: newQuantity });
      toast.error(t('cart.notifications.updateServerError'));
    }
  };

  const handleRemove = async () => {
    try {
      if (item.id && typeof item.id === 'string') {
        await removeCartItem(item.id);
        toast.success(t('cart.notifications.itemRemoved'));
      } else {
        removeItem(item.id);
        toast.success(t('cart.notifications.itemRemoved'));
      }
    } catch (error) {
      console.error('Lỗi xóa sản phẩm khỏi giỏ:', error);
      removeItem(item.id);
      toast.error(t('cart.notifications.removeServerError'));
    }
  };

  return (
    <div className="flex py-4 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
      {/* Product image */}
      <div className="w-20 h-20 flex-shrink-0">
        <Link to={buildRoute.productDetail(item.productId)}>
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover rounded-md"
          />
        </Link>
      </div>

      {/* Product details */}
      <div className="ml-4 flex-grow">
        <div className="flex justify-between">
          <Link
            to={buildRoute.productDetail(item.productId)}
            className="text-neutral-800 dark:text-neutral-100 font-medium hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            {item.name}
          </Link>
          <span className="text-neutral-900 dark:text-white font-semibold">
            {formatPrice(parsePrice(item.price) * item.quantity)}
          </span>
        </div>

        {item.attributes && Object.keys(item.attributes).length > 0 && (
          <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {Object.entries(item.attributes).map(([key, value]) => (
              <span key={key} className="mr-3">
                {key}: {value}
              </span>
            ))}
          </div>
        )}

        <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {formatPrice(item.price)} {t('cart.perItem')}
        </div>

        {item.inStock === false && (
          <div className="mt-1 text-sm text-red-500 font-medium">❌ {t('cart.outOfStock')}</div>
        )}
        {effectiveMaxStock && effectiveMaxStock > 0 && effectiveMaxStock <= 5 && item.inStock && (
          <div className="mt-1 text-sm text-amber-600 font-medium">
            ⚡ {t('cart.lowStock', { count: effectiveMaxStock })}
          </div>
        )}

        <div className="mt-2 flex justify-between items-center">
          {!isCheckout ? (
            <div className="flex items-center">
              <button
                onClick={() => handleQuantityChange(item.quantity - 1)}
                disabled={isUpdating || item.quantity <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t('cart.decreaseQuantity')}
              >
                {isUpdating ? (
                  <div className="w-3 h-3 border border-neutral-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                )}
              </button>
              <span className="mx-3 w-8 text-center">{item.quantity}</span>
              <button
                onClick={() => handleQuantityChange(item.quantity + 1)}
                disabled={isUpdating || !!(effectiveMaxStock && item.quantity >= effectiveMaxStock)}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t('cart.increaseQuantity')}
              >
                {isUpdating ? (
                  <div className="w-3 h-3 border border-neutral-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </button>
            </div>
          ) : (
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              {t('common.quantity')}: {item.quantity}
            </div>
          )}

          {!isCheckout && (
            <button
              onClick={handleRemove}
              disabled={isRemoving}
              className="text-neutral-500 dark:text-neutral-400 hover:text-error dark:hover:text-error transition-colors disabled:opacity-50"
              aria-label={t('cart.removeItem')}
            >
              {isRemoving ? (
                <div className="w-5 h-5 border border-neutral-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartItem;
