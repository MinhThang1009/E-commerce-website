/**
 * @file ChatProductCard.tsx
 * @layer Component
 * @feature ai
 * @description UI component cho feature ai
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { localizeField } from '@/utils/localize';
import { getLocale } from '@/utils/format';
import { proxyImg } from '@/utils/proxy-img';
import { createProductImageErrorHandler } from '@/utils/image-utils';
import { ProductRecommendation } from '../api/chatbot-api';
import {
  useTrackChatbotAnalyticsMutation,
  useAddToCartViaChatbotMutation,
} from '../api/chatbot-api';
import { useAuthStore } from '@/stores/auth-store';
import { useNotifications } from '@/hooks/use-notifications';

interface ChatProductCardProps {
  product: ProductRecommendation;
  sessionId: string;
  onProductClick?: (product: ProductRecommendation) => void;
}

const ChatProductCard: React.FC<ChatProductCardProps> = ({
  product,
  sessionId,
  onProductClick,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { showNotification } = useNotifications();
  const { mutateAsync: trackAnalytics } = useTrackChatbotAnalyticsMutation();
  const { mutateAsync: addToCart } = useAddToCartViaChatbotMutation();

  const handleProductClick = async () => {
    await trackAnalytics({
      event: 'product_clicked',
      userId: user?.id,
      sessionId,
      productId: product.id,
      metadata: { source: 'chatbot_recommendation' },
    });

    onProductClick?.(product);
    navigate(product.slug ? `/products/${product.slug}` : `/products/${product.id}`);
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await addToCart({ productId: product.id, quantity: 1, sessionId });
      await trackAnalytics({
        event: 'product_added_to_cart',
        userId: user.id,
        sessionId,
        productId: product.id,
        value: product.price,
        metadata: { source: 'chatbot_recommendation' },
      });
      showNotification({ message: t('product.addedToCart'), type: 'success' });
    } catch (error) {
      showNotification({ message: t('product.addToCartError'), type: 'error' });
    }
  };

  const handleBuyNow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await addToCart({ productId: product.id, quantity: 1, sessionId });
      navigate('/checkout');
    } catch (error) {
      showNotification({ message: t('product.buyNowFailed'), type: 'error' });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-sm ${i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'}`}
      >
        ★
      </span>
    ));
  };

  return (
    <div
      className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group transform hover:scale-102"
      onClick={handleProductClick}
    >
      <div className="relative overflow-hidden">
        {proxyImg(product.thumbnail) ? (
          <img
            src={proxyImg(product.thumbnail)}
            alt={localizeField(product, 'name', i18n.language)}
            className="w-full h-32 object-cover group-hover:scale-110 transition-transform duration-300 bg-neutral-100 dark:bg-neutral-700"
            onError={createProductImageErrorHandler(localizeField(product, 'name', i18n.language))}
          />
        ) : (
          <div className="w-full h-32 bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
            <span className="text-neutral-400 dark:text-neutral-500 text-xs text-center px-2 line-clamp-2">
              {localizeField(product, 'name', i18n.language)}
            </span>
          </div>
        )}

        {product.discount > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            -{product.discount}%
          </div>
        )}

        {!product.inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">{t('product.outOfStock')}</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <h4 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200 line-clamp-2 mb-2">
          {localizeField(product, 'name', i18n.language)}
        </h4>

        {product.rating !== null && product.rating !== undefined && (
          <div className="flex items-center mb-2">
            {renderStars(product.rating)}
            <span className="text-xs text-neutral-500 ml-1">({product.rating})</span>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-1">
            <span className="font-bold text-primary-600 dark:text-primary-400 text-sm">
              {formatPrice(product.price)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-xs text-neutral-500 line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-1">
          <div className="flex space-x-2">
            <button
              onClick={handleProductClick}
              className="btn-glass-secondary flex-1 py-2 text-xs"
            >
              {t('product.viewDetails')}
            </button>
            {product.inStock && (
              <button onClick={handleAddToCart} className="btn-glass-cart flex-1 py-2 text-xs">
                {t('product.addToCart')}
              </button>
            )}
          </div>
          {product.inStock && (
            <button onClick={handleBuyNow} className="btn-glass-primary w-full py-2 text-xs">
              {t('product.buyNow')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatProductCard;
