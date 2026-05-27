/**
 * @file ProductVariantSelector.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/utils/cn';
import { ProductWithVariants } from '../types/product.types';
import { getLocale } from '@/utils/format';

interface ProductVariantSelectorProps {
  product: ProductWithVariants;
  selectedVariantId?: string;
  onVariantChange: (variantId: string) => void;
  className?: string;
}

const ProductVariantSelector: React.FC<ProductVariantSelectorProps> = ({
  product,
  selectedVariantId,
  onVariantChange,
  className,
}) => {
  const { t } = useTranslation();

  if (
    !product.isVariantProduct ||
    !product.availableVariants ||
    product.availableVariants.length <= 1
  ) {
    return null;
  }

  const formatPrice = (price: number) => {
    // Lun dng VND  dng locale ng  format du phn tch (vi: du chm, en: du phy)
    return `${price.toLocaleString(getLocale())}${t('common.currencySymbol')}`;
  };

  const currentVariant = product.currentVariant;
  const availableVariants = product.availableVariants;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>&#128295;</span>
          <span>{t('product.chooseVersion')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {currentVariant && (
          <div className="rounded-lg border border-sky-500 bg-sky-50 dark:bg-sky-950/20 p-3">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-sky-500">
                <Check className="inline size-4 mr-1" />
                {t('product.selectedVariant', { name: currentVariant.name })}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-red-600">
                  {formatPrice(currentVariant.price)}
                </span>
                {currentVariant.compareAtPrice &&
                  currentVariant.compareAtPrice > currentVariant.price && (
                    <span className="text-neutral-500 line-through">
                      {formatPrice(currentVariant.compareAtPrice)}
                    </span>
                  )}
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('product.skuAndStock', {
                  sku: currentVariant.sku,
                  stock: currentVariant.stockQuantity,
                })}
              </span>
            </div>
          </div>
        )}

        <hr className="border-neutral-200 dark:border-neutral-700 my-0" />

        <div>
          <span className="font-semibold block mb-2">{t('product.availableVersions')}</span>
          <div className="flex flex-col gap-2">
            {availableVariants.map((variant) => {
              const isSelected =
                selectedVariantId === variant.id || (!selectedVariantId && variant.isDefault);
              const isOutOfStock = variant.stockQuantity <= 0;

              return (
                <Button
                  key={variant.id}
                  variant="outline"
                  onClick={() => onVariantChange(variant.id)}
                  disabled={isOutOfStock}
                  className={cn(
                    'w-full h-auto p-3 text-left justify-start',
                    isSelected && 'border-2 border-sky-500 bg-sky-50 dark:bg-sky-950/20',
                    isOutOfStock && 'opacity-50',
                  )}
                >
                  <div className="w-full">
                    <div className="flex justify-between items-start mb-1">
                      <span
                        className={cn(
                          'font-semibold text-sm',
                          isSelected ? 'text-sky-500' : 'text-neutral-700 dark:text-neutral-200',
                        )}
                      >
                        {isSelected && <Check className="inline size-3.5 mr-1" />}
                        {variant.name}
                      </span>
                      <div className="flex items-center gap-1">
                        {variant.isDefault && (
                          <span className="inline-block rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-xs">
                            {t('product.defaultVariant')}
                          </span>
                        )}
                        {isOutOfStock && (
                          <span className="inline-block rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-0.5 text-xs">
                            {t('product.outOfStock')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-red-600 text-sm">
                          {formatPrice(variant.price)}
                        </span>
                        {variant.compareAtPrice && variant.compareAtPrice > variant.price && (
                          <span className="text-neutral-500 text-xs line-through">
                            {formatPrice(variant.compareAtPrice)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {t('product.remainingStock', {
                          count: variant.stockQuantity,
                        })}
                      </span>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>

        {availableVariants.length > 1 && (
          <>
            <hr className="border-neutral-200 dark:border-neutral-700 my-0" />
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('product.priceRange', {
                min: formatPrice(Math.min(...availableVariants.map((v) => v.price))),
                max: formatPrice(Math.max(...availableVariants.map((v) => v.price))),
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductVariantSelector;
