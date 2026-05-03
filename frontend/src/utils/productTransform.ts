import i18next from 'i18next';

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
  [key: string]: any;
}

const getSpecLabel = (key: string): string => {
  const lowerKey = key.toLowerCase();
  const tKey = `product.specNames.${lowerKey}`;
  const translated = i18next.t(tKey);
  return translated !== tKey ? translated : key;
};

const transformSpecs = (specs: any, attributes: any = {}) => {
  let mergedSpecs: Record<string, any> = {};

  // 1. Phục hồi từ định dạng mảng nếu tồn tại (chủ yếu cho thông số cơ bản)
  if (Array.isArray(specs)) {
    specs.forEach(s => {
      if (s && s.name) {
        mergedSpecs[s.name] = s.value;
      }
    });
  } else if (typeof specs === 'object' && specs !== null) {
    mergedSpecs = { ...specs };
  }

  // 2. Gộp các thuộc tính (đặc biệt cho biến thể)
  // Kiểm tra xem attributes có phải là plain object không (không phải mảng/liên kết)
  if (typeof attributes === 'object' && attributes !== null && !Array.isArray(attributes)) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (!mergedSpecs[key]) {
        mergedSpecs[key] = value;
      }
    });
  }

  // 3. Chuyển thành mảng và bản địa hóa
  return Object.entries(mergedSpecs).map(([name, value]) => ({
    name: getSpecLabel(name),
    value: String(value),
  }));
};

/**
 * Chuyển đổi một sản phẩm từ định dạng backend sang frontend
 */
export const transformProduct = (product: any): any => {
  if (!product) return null;

  return {
    ...product,
    price: parseFloat(String(product.price)),
    compareAtPrice: product.compareAtPrice
      ? parseFloat(String(product.compareAtPrice))
      : null,
    stock: product.stockQuantity,
    categoryId: product.categoryId || product.category?.id || product.categories?.[0]?.id || '',
    categoryName: product.category?.name || product.categories?.[0]?.name || '',
    categorySlug: product.category?.slug || product.categories?.[0]?.slug || '',
    isFeatured: product.featured || false,
    ratings: product.ratings || {
      average: 0,
      count: 0,
    },
    // Đảm bảo variants và attributes được truyền qua, chuẩn hóa attributes.values thành mảng
    variants: (product.variants || []).map((v: any) => {
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
      ? product.attributes.map((attr: any) => {
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
          let values = Array.isArray(value) ? value : [value];
          return { name: key, values };
        }),
    
    // Chuyển đổi thông số kỹ thuật (cấp ROOT)
    productSpecifications: transformSpecs(product.specifications, product.attributes_object || product.attributes),
    
    // Xử lý biến thể hiện tại nếu có
    currentVariant: product.currentVariant ? {
      ...product.currentVariant,
      // Nếu backend đã gộp thông số vào biến thể, dùng chúng.
      // Ngược lại, gộp thuộc tính biến thể tại đây.
      productSpecifications: transformSpecs(product.currentVariant.specifications || product.specifications, product.currentVariant.attributes),
    } : null,
  };
};

/**
 * Chuyển đổi một mảng sản phẩm
 */
export const transformProducts = (
  products: RawProduct[]
): TransformedProduct[] => {
  if (!Array.isArray(products)) return [];
  return products.map(transformProduct);
};

/**
 * Chuyển đổi response API chứa mảng sản phẩm
 */
export const transformProductsResponse = (response: any): any => {
  if (!response?.data) return response;

  // Xử lý response dạng mảng (ví dụ: sản phẩm nổi bật)
  if (Array.isArray(response.data)) {
    return {
      ...response,
      data: transformProducts(response.data),
    };
  }

  // Xử lý response phân trang (data là mảng trực tiếp)
  if (Array.isArray(response.data)) {
    return {
      ...response,
      data: transformProducts(response.data),
    };
  }

  // Xử lý response sản phẩm đơn
  if (response.data.id) {
    return {
      ...response,
      data: transformProduct(response.data),
    };
  }

  return response;
};

/**
 * Tạo URLSearchParams từ bộ lọc
 */
export const createProductFiltersParams = (
  filters: any = {}
): URLSearchParams => {
  const params = new URLSearchParams();

  // Bộ lọc cơ bản
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.categoryId) params.append('category', filters.categoryId);
  if (filters.search) params.append('search', filters.search);
  if (filters.minPrice !== undefined)
    params.append('minPrice', filters.minPrice.toString());
  if (filters.maxPrice !== undefined)
    params.append('maxPrice', filters.maxPrice.toString());

  // Mặc định lấy sản phẩm đang hoạt động
  if (filters.status !== undefined) {
    params.append('status', filters.status);
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

/**
 * Tạo provide tags cho caching RTK Query
 */
export const generateProductTags = (
  result: any,
  tagType: string = 'LIST'
): Array<{ type: 'Product'; id: string | number }> => {
  if (!result?.data) return [{ type: 'Product', id: tagType }];

  if (Array.isArray(result.data)) {
    return [
      ...result.data.map(({ id }: any) => ({
        type: 'Product' as const,
        id,
      })),
      { type: 'Product', id: tagType },
    ];
  }

  if (Array.isArray(result.data)) {
    return [
      ...result.data.map(({ id }: any) => ({
        type: 'Product' as const,
        id,
      })),
      { type: 'Product', id: tagType },
    ];
  }

  if (result.data.id) {
    return [{ type: 'Product', id: result.data.id }];
  }

  return [{ type: 'Product', id: tagType }];
};

