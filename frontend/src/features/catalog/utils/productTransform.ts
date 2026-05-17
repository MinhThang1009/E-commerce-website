import type { ProductFilters } from '../types/product.types';

export interface RawProduct {
  id: string;
  name: string;
  price: string | number;
  compareAtPrice?: string | number;
  stockQuantity: number;
  categories?: Array<{ id: string; name: string; slug?: string }>;
  featured?: boolean;
  ratings?: {
    average: number;
    count: number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Index signature cho dynamic backend fields
  [key: string]: any;
}

export interface TransformedProduct {
  id: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  isFeatured: boolean;
  ratings: {
    average: number;
    count: number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Index signature cho dynamic backend fields
  [key: string]: any;
}

const transformSpecs = (
  specs:
    | Record<string, unknown>
    | Array<{ name?: string; value?: unknown; valueEn?: string }>
    | null
    | undefined,
  attributes: Record<string, unknown> = {},
  attributesEn: Record<string, string> = {},
) => {
  let mergedSpecs: Record<string, unknown> = {};
  const mergedSpecsEn: Record<string, string> = {};

  if (Array.isArray(specs)) {
    specs.forEach((s) => {
      if (s && s.name) {
        mergedSpecs[s.name] = s.value;
        if (s.valueEn) mergedSpecsEn[s.name] = s.valueEn;
      }
    });
  } else if (typeof specs === 'object' && specs !== null) {
    mergedSpecs = { ...specs };
  }

  if (typeof attributes === 'object' && attributes !== null && !Array.isArray(attributes)) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (!mergedSpecs[key]) {
        mergedSpecs[key] = value;
        if (attributesEn[key]) mergedSpecsEn[key] = attributesEn[key];
      }
    });
  }

  // Giữ key thô — để component dịch tại render time (reactive với language change)
  return Object.entries(mergedSpecs).map(([name, value]) => ({
    name,
    value: String(value),
    valueEn: mergedSpecsEn[name] || undefined,
  }));
};

/**
 * Chuyển đổi một sản phẩm từ định dạng backend sang frontend
 */
export const transformProduct = (product: RawProduct): TransformedProduct | null => {
  if (!product) return null;

  return {
    ...product,
    price: parseFloat(String(product.price)),
    compareAtPrice: product.compareAtPrice ? parseFloat(String(product.compareAtPrice)) : null,
    stock:
      product.variants?.length > 0
        ? product.variants.reduce(
            (sum: number, v: Record<string, unknown>) => sum + (Number(v.stockQuantity) || 0),
            0,
          )
        : product.stockQuantity,
    isVariantProduct: (product.variants?.length || 0) > 0,
    categoryId: product.categoryId || product.category?.id || product.categories?.[0]?.id || '',
    categoryName: product.category?.name || product.categories?.[0]?.name || '',
    categorySlug: product.category?.slug || product.categories?.[0]?.slug || '',
    isFeatured: product.featured || false,
    ratings: product.ratings || {
      average: 0,
      count: 0,
    },
    // Đảm bảo variants và attributes được truyền qua, chuẩn hóa attributes.values thành mảng
    variants: (product.variants || []).map((v: Record<string, unknown>) => {
      let attrs = v.attributes;
      if (typeof attrs === 'string') {
        try {
          attrs = JSON.parse(attrs);
        } catch {
          attrs = {};
        }
      }
      return { ...v, attributes: attrs || {} };
    }),
    attributes: Array.isArray(product.attributes)
      ? product.attributes.map((attr: Record<string, unknown>) => {
          let values = attr.values;
          if (!Array.isArray(values)) {
            if (typeof values === 'string') {
              try {
                const parsed = JSON.parse(values);
                values = Array.isArray(parsed) ? parsed : [];
              } catch {
                values = [];
              }
            } else {
              values = [];
            }
          }
          return { ...attr, values };
        })
      : Object.entries(product.attributes || {}).map(([key, value]) => {
          const values = Array.isArray(value) ? value : [value];
          return { name: key, values };
        }),

    // Ưu tiên productSpecifications từ normalized table (có valueEn), fallback JSON
    productSpecifications: transformSpecs(
      product.productSpecifications?.length > 0
        ? product.productSpecifications
        : product.specifications,
      product.attributes_object || product.attributes,
    ),

    // Xử lý biến thể hiện tại nếu có
    currentVariant: product.currentVariant
      ? {
          ...product.currentVariant,
          // Ưu tiên table data (có valueEn), fallback JSON variant/product specs
          // Truyền attributesEn để color từ variant cũng có valueEn
          productSpecifications:
            product.productSpecifications?.length > 0
              ? transformSpecs(
                  product.productSpecifications,
                  product.currentVariant.attributes,
                  product.currentVariant.attributesEn || {},
                )
              : transformSpecs(
                  product.currentVariant.specifications || product.specifications,
                  product.currentVariant.attributes,
                  product.currentVariant.attributesEn || {},
                ),
        }
      : null,
  };
};

/**
 * Chuyển đổi một mảng sản phẩm
 */
export const transformProducts = (products: RawProduct[]): TransformedProduct[] => {
  if (!Array.isArray(products)) return [];
  return products.map(transformProduct).filter((p): p is TransformedProduct => p !== null);
};

/**
 * Chuyển đổi response API chứa mảng sản phẩm
 */
export const transformProductsResponse = <T extends { data?: unknown }>(response: T): T => {
  if (!response?.data) return response;

  const { data } = response;

  // Xử lý response dạng mảng (ví dụ: sản phẩm nổi bật)
  if (Array.isArray(data)) {
    return {
      ...response,
      data: transformProducts(data),
    };
  }

  // Xử lý response sản phẩm đơn
  if (typeof data === 'object' && data !== null && 'id' in data) {
    return {
      ...response,
      data: transformProduct(data as RawProduct),
    };
  }

  return response;
};

/**
 * Tạo URLSearchParams từ bộ lọc
 */
export const createProductFiltersParams = (filters: ProductFilters = {}): URLSearchParams => {
  const params = new URLSearchParams();

  // Bộ lọc cơ bản
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.categoryId) params.append('category', filters.categoryId);
  if (filters.search) params.append('search', filters.search);
  if (filters.minPrice !== undefined) params.append('minPrice', filters.minPrice.toString());
  if (filters.maxPrice !== undefined) params.append('maxPrice', filters.maxPrice.toString());

  // Mặc định lấy sản phẩm đang hoạt động
  if (filters.status !== undefined) {
    params.append('status', String(filters.status));
  } else {
    params.append('status', 'active');
  }

  // Bộ lọc mảng
  const arrayFilters = ['brand', 'collection', 'color', 'size'];
  arrayFilters.forEach((filter) => {
    if (filters[filter] && Array.isArray(filters[filter])) {
      filters[filter].forEach((value: string) => {
        params.append(filter, value);
      });
    }
  });

  // Bộ lọc thuộc tính động
  Object.keys(filters).forEach((key) => {
    if (key.startsWith('attr_') && Array.isArray(filters[key])) {
      filters[key].forEach((value: string) => {
        params.append(key, value);
      });
    }
  });

  // Sắp xếp
  if (filters.sort) {
    const sortMap: Record<string, string> = {
      price_asc: 'price',
      price_desc: 'price',
      newest: 'createdAt',
      popular: 'rating',
    };

    const orderMap: Record<string, string> = {
      price_desc: 'DESC',
      newest: 'DESC',
      popular: 'DESC',
    };

    params.append('sort', sortMap[filters.sort] || 'createdAt');
    params.append('order', orderMap[filters.sort] || 'ASC');
  }

  return params;
};
