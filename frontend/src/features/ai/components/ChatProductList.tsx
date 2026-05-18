/**
 * @file ChatProductList.tsx
 * @layer Component
 * @feature ai
 * @description UI component cho feature ai
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProductRecommendation } from '../services/chatbot-api';
import ChatProductCard from './ChatProductCard';

interface ChatProductListProps {
  products: ProductRecommendation[];
  sessionId: string;
  title?: string;
  onProductClick?: (product: ProductRecommendation) => void;
}

const ChatProductList: React.FC<ChatProductListProps> = ({
  products,
  sessionId,
  title,
  onProductClick,
}) => {
  const { t } = useTranslation();
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      {title && (
        <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
          {title}
        </h4>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {products.map((product) => (
          <ChatProductCard
            key={product.id}
            product={product}
            sessionId={sessionId}
            onProductClick={onProductClick}
          />
        ))}
      </div>

      {/* Nút xem thêm sản phẩm khi danh sách nhiều */}
      {products.length > 4 && (
        <div className="mt-4 text-center">
          <button className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium">
            {t('chat.viewMoreProducts')} →
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatProductList;
