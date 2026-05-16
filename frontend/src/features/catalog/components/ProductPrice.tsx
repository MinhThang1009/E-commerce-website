import React from 'react';
import { useTranslation } from 'react-i18next';
import { useProductPriceRange } from '../hooks/useProductPriceRange';

interface ProductPriceProps {
  basePrice: number;
  variants?: Array<{ price: number | string }>;
  compareAtPrice?: number;
  className?: string;
}

const ProductPrice: React.FC<ProductPriceProps> = ({
  basePrice,
  variants,
  compareAtPrice,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const { priceInfo } = useProductPriceRange(basePrice, variants);

  const discount =
    compareAtPrice && compareAtPrice > priceInfo.basePrice
      ? Math.round(
          ((compareAtPrice - priceInfo.basePrice) / compareAtPrice) * 100
        )
      : 0;

  return (
    <div className={`product-price ${className}`}>
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
          {priceInfo.priceText}
        </span>
        {compareAtPrice && compareAtPrice > priceInfo.basePrice && (
          <span className="text-base text-neutral-400 dark:text-neutral-500 line-through font-medium">
            {compareAtPrice.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}{t('common.currencySymbol')}
          </span>
        )}
      </div>

      {compareAtPrice && compareAtPrice > priceInfo.basePrice && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
            {t('product.savings', {
              amount: `${(compareAtPrice - priceInfo.basePrice).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}${t('common.currencySymbol')}`,
            })}
          </span>
          <div className="h-1 w-1 bg-neutral-300 dark:bg-neutral-600 rounded-full"></div>
          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
            {t('product.discountOff', { percent: discount })}
          </span>
        </div>
      )}
    </div>
  );
};

export default ProductPrice;
