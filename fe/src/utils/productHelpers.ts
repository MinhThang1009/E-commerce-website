/**
 * Product Helper Functions for Frontend
 * Utilities for managing product variants and stock
 */

import {
  Product,
  ProductVariant,
  ProductAttribute,
} from '@/types/product.types';

/**
 * Get available stock for specific attribute combination
 */
export const getVariantStock = (
  product: Product,
  selectedAttributes: Record<string, string>
): number => {
  // If no variants, return product stock
  if (!product.variants || product.variants.length === 0) {
    return product.stock || 0;
  }

  // If no attributes selected, return total stock
  if (Object.keys(selectedAttributes).length === 0) {
    return product.stock || 0;
  }

  // Find variants that match selected attributes
  const matchingVariants = product.variants.filter((variant) => {
    if (!variant.attributes) return false;
    return Object.entries(selectedAttributes).every(([key, value]) => {
      const variantValue = variant.attributes[key];
      if (!variantValue || !value) return false;
      
      // Normalize strings to NFC and compare case-insensitively
      const v1 = String(variantValue).normalize('NFC').toLowerCase().trim();
      const v2 = String(value).normalize('NFC').toLowerCase().trim();
      return v1 === v2;
    });
  });

  // If we have exactly one variant match, return its stock
  if (matchingVariants.length === 1) {
    return matchingVariants[0].stockQuantity;
  }

  // If we have multiple matches (partial attribute selection), return total stock
  if (matchingVariants.length > 1) {
    return matchingVariants.reduce(
      (total, variant) => total + variant.stockQuantity,
      0
    );
  }

  // No matching variants
  return 0;
};

/**
 * Find variant by selected attributes
 */
export const findVariantByAttributes = (
  variants: ProductVariant[],
  selectedAttributes: Record<string, string>
): ProductVariant | null => {
  if (!variants || variants.length === 0) return null;

  return (
    variants.find((variant) => {
      if (!variant.attributes) return false;
      return Object.entries(selectedAttributes).every(([key, value]) => {
        const variantValue = variant.attributes[key];
        if (!variantValue || !value) return false;
        return (
          String(variantValue).normalize('NFC').toLowerCase().trim() ===
          String(value).normalize('NFC').toLowerCase().trim()
        );
      });
    }) || null
  );
};

/**
 * Get stock for a specific attribute value
 */
export const getAttributeValueStock = (
  product: Product,
  attributeName: string,
  attributeValue: string
): number => {
  if (!product.variants || product.variants.length === 0) {
    return product.stock || 0;
  }

  const matchingVariants = product.variants.filter((variant) => {
    if (!variant.attributes || !variant.attributes[attributeName]) return false;
    return (
      String(variant.attributes[attributeName]).normalize('NFC').toLowerCase().trim() ===
      String(attributeValue).normalize('NFC').toLowerCase().trim()
    );
  });

  return matchingVariants.reduce(
    (total, variant) => total + variant.stockQuantity,
    0
  );
};

/**
 * Check if product has variants
 */
export const hasVariants = (product: Product): boolean => {
  return !!(product.variants && product.variants.length > 0);
};

/**
 * Get all available combinations of attributes
 */
export const getAvailableAttributeCombinations = (
  product: Product
): Record<string, string>[] => {
  if (!product.variants || product.variants.length === 0) return [];

  return product.variants
    .filter((variant) => variant.stockQuantity > 0)
    .map((variant) => variant.attributes);
};

/**
 * Check if a specific attribute combination is available
 */
export const isAttributeCombinationAvailable = (
  product: Product,
  selectedAttributes: Record<string, string>
): boolean => {
  if (!product.variants || product.variants.length === 0) {
    return product.stock > 0;
  }

  const stock = getVariantStock(product, selectedAttributes);
  return stock > 0;
};

/**
 * Get price for selected attributes
 */
export const getVariantPrice = (
  product: Product,
  selectedAttributes: Record<string, string>
): number => {
  if (!product.variants || product.variants.length === 0) {
    return product.price;
  }

  const variant = findVariantByAttributes(product.variants, selectedAttributes);
  return variant ? variant.price : product.price;
};

/**
 * Check if all required attributes are selected
 */
export const areAllAttributesSelected = (
  attributes: ProductAttribute[],
  selectedAttributes: Record<string, string>
): boolean => {
  if (!attributes || attributes.length === 0) return true;

  return attributes.every((attr) => selectedAttributes[attr.name]);
};

/**
 * Get attribute values with stock information considering selected attributes
 */
export const getAttributeValuesWithStock = (
  product: Product,
  attributeName: string,
  selectedAttributes: Record<string, string> = {}
): Array<{ value: string; stock: number; available: boolean }> => {
  const attribute = product.attributes?.find(
    (attr) => attr.name === attributeName
  );
  if (!attribute) return [];

  // Normalize values to array in case backend returns JSON string or non-array
  let values: string[];
  if (Array.isArray(attribute.values)) {
    values = attribute.values;
  } else if (typeof attribute.values === 'string') {
    try {
      const parsed = JSON.parse(attribute.values);
      values = Array.isArray(parsed) ? parsed : [];
    } catch {
      values = [];
    }
  } else {
    values = [];
  }

  // Sort values: 
  // 1. If variants exist, sort by the minimum variant ID that has this value
  // 2. Otherwise fall back to natural sort
  const sortedValues = [...values].sort((a, b) => {
    if (product.variants && product.variants.length > 0) {
      const getMinId = (val: string) => {
        const matchingVariants = product.variants!.filter(v => 
          v.attributes && (v.attributes[attributeName] === val)
        );
        return matchingVariants.length > 0 
          ? Math.min(...matchingVariants.map(v => parseInt(v.id.toString()) || 0)) 
          : Infinity;
      };
      
      const idA = getMinId(a);
      const idB = getMinId(b);
      
      if (idA !== idB) return idA - idB;
    }
    
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });

  return sortedValues.map((value) => {
    // Create a temporary combination with this value
    const tempAttributes = { ...selectedAttributes, [attributeName]: value };

    // Get stock for this specific combination
    const stock = getVariantStock(product, tempAttributes);

    return {
      value,
      stock,
      available: stock > 0,
    };
  });
};

/**
 * Get available stock for a specific attribute value considering other selected attributes
 */
export const getAttributeValueStockWithContext = (
  product: Product,
  attributeName: string,
  attributeValue: string,
  otherSelectedAttributes: Record<string, string> = {}
): number => {
  if (!product.variants || product.variants.length === 0) {
    return product.stock || 0;
  }

  // Combine other selected attributes with this specific value
  const combinedAttributes = {
    ...otherSelectedAttributes,
    [attributeName]: attributeValue,
  };

  // Find matching variants
  const matchingVariants = product.variants.filter((variant) => {
    if (!variant.attributes) return false;
    return Object.entries(combinedAttributes).every(([key, value]) => {
      const variantValue = variant.attributes[key];
      if (!variantValue || !value) return false;
      return (
        String(variantValue).normalize('NFC').toLowerCase().trim() ===
        String(value).normalize('NFC').toLowerCase().trim()
      );
    });
  });

  return matchingVariants.reduce(
    (total, variant) => total + variant.stockQuantity,
    0
  );
};

/**
 * Format stock display text
 */
export const formatStockText = (stock: number): string => {
  if (stock === 0) return 'Hết hàng';
  if (stock < 10) return `Chỉ còn ${stock} sản phẩm`;
  return `Còn ${stock} sản phẩm`;
};

/**
 * Get stock status color
 */
export const getStockStatusColor = (stock: number): string => {
  if (stock === 0) return 'text-red-500';
  if (stock < 10) return 'text-orange-500';
  return 'text-green-500';
};
