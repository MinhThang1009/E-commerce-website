import i18next from 'i18next';

import {
  Product,
  ProductVariant,
  ProductAttribute,
} from '@/types/product.types';

/**
 * Lấy tồn kho khả dụng cho tổ hợp thuộc tính cụ thể
 */
export const getVariantStock = (
  product: Product,
  selectedAttributes: Record<string, string>
): number => {
  // Nếu không có biến thể, trả về tồn kho sản phẩm
  if (!product.variants || product.variants.length === 0) {
    return product.stock || 0;
  }

  // Nếu chưa chọn thuộc tính, trả về tổng tồn kho
  if (Object.keys(selectedAttributes).length === 0) {
    return product.stock || 0;
  }

  // Tìm các biến thể khớp với thuộc tính đã chọn
  const matchingVariants = product.variants.filter((variant) => {
    if (!variant.attributes) return false;
    return Object.entries(selectedAttributes).every(([key, value]) => {
      const variantValue = variant.attributes[key];
      if (!variantValue || !value) return false;
      
      // Chuẩn hóa chuỗi về NFC và so sánh không phân biệt hoa thường
      const v1 = String(variantValue).normalize('NFC').toLowerCase().trim();
      const v2 = String(value).normalize('NFC').toLowerCase().trim();
      return v1 === v2;
    });
  });

  // Nếu tìm được đúng một biến thể, trả về tồn kho của nó
  if (matchingVariants.length === 1) {
    return matchingVariants[0].stockQuantity;
  }

  // Nếu có nhiều biến thể khớp (chọn thuộc tính một phần), trả về tổng tồn kho
  if (matchingVariants.length > 1) {
    return matchingVariants.reduce(
      (total, variant) => total + variant.stockQuantity,
      0
    );
  }

  // Không tìm thấy biến thể nào khớp
  return 0;
};

/**
 * Tìm biến thể theo thuộc tính đã chọn
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
 * Lấy tồn kho cho một giá trị thuộc tính cụ thể
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
 * Kiểm tra sản phẩm có biến thể không
 */
export const hasVariants = (product: Product): boolean => {
  return !!(product.variants && product.variants.length > 0);
};

/**
 * Lấy tất cả tổ hợp thuộc tính khả dụng
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
 * Kiểm tra tổ hợp thuộc tính cụ thể có sẵn không
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
 * Lấy giá cho các thuộc tính đã chọn
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
 * Kiểm tra tất cả thuộc tính bắt buộc đã được chọn chưa
 */
export const areAllAttributesSelected = (
  attributes: ProductAttribute[],
  selectedAttributes: Record<string, string>
): boolean => {
  if (!attributes || attributes.length === 0) return true;

  return attributes.every((attr) => selectedAttributes[attr.name]);
};

/**
 * Lấy các giá trị thuộc tính kèm thông tin tồn kho theo ngữ cảnh thuộc tính đã chọn
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

  // Chuẩn hóa giá trị thành mảng phòng trường hợp backend trả về chuỗi JSON hoặc kiểu khác
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

  // Sắp xếp các giá trị:
  // 1. Nếu có biến thể, sắp xếp theo ID biến thể nhỏ nhất chứa giá trị này
  // 2. Nếu không, dùng sắp xếp tự nhiên
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
    // Tạo tổ hợp tạm thời với giá trị này
    const tempAttributes = { ...selectedAttributes, [attributeName]: value };

    // Lấy tồn kho cho tổ hợp cụ thể này
    const stock = getVariantStock(product, tempAttributes);

    return {
      value,
      stock,
      available: stock > 0,
    };
  });
};

/**
 * Lấy tồn kho khả dụng cho một giá trị thuộc tính có xét đến các thuộc tính đã chọn khác
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

  // Kết hợp các thuộc tính đã chọn khác với giá trị cụ thể này
  const combinedAttributes = {
    ...otherSelectedAttributes,
    [attributeName]: attributeValue,
  };

  // Tìm các biến thể khớp
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
 * Định dạng văn bản hiển thị tồn kho
 */
export const formatStockText = (stock: number): string => {
  if (stock === 0) return i18next.t('product.outOfStock');
  if (stock < 10) return i18next.t('product.stockLimited', { count: stock });
  return i18next.t('product.stockAvailable', { count: stock });
};

/**
 * Lấy màu trạng thái tồn kho
 */
export const getStockStatusColor = (stock: number): string => {
  if (stock === 0) return 'text-red-500';
  if (stock < 10) return 'text-orange-500';
  return 'text-green-500';
};
