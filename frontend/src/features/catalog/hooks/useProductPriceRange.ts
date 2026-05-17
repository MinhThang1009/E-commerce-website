/**
 * @file useProductPriceRange.ts
 * @layer Hook
 * @feature catalog
 * @description Custom React hook cho feature catalog
 */
import { useMemo } from 'react';
import { calculatePriceRange } from '@/utils/priceUtils';

interface VariantInput {
  id?: string;
  sku?: string;
  name?: string;
  price: number | string;
  stockQuantity?: number;
  attributes?: Record<string, string>;
}

export const useProductPriceRange = (basePrice: number, variants?: VariantInput[]) => {
  const priceInfo = useMemo(() => {
    if (variants && variants.length > 0) {
      const processedVariants = variants.map((variant) => ({
        id: variant.id ?? '',
        sku: variant.sku ?? '',
        name: variant.name ?? '',
        price: parseFloat(String(variant.price)),
        stockQuantity: variant.stockQuantity ?? 0,
        attributes: variant.attributes ?? {},
      }));

      return {
        ...calculatePriceRange(basePrice, processedVariants),
        hasVariants: true,
      };
    }

    return {
      ...calculatePriceRange(basePrice),
      hasVariants: false,
    };
  }, [basePrice, variants]);

  return {
    priceInfo,
    isLoading: false,
    hasVariants: priceInfo.hasVariants,
  };
};

