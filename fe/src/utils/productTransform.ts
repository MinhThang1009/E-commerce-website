/**
 * Product transformation utilities
 * Centralizes product data transformation logic to avoid code duplication
 */

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

// Mapping dictionary for Vietnamese labels
const specMapping: Record<string, string> = {
  cpu: 'Vi xử lý (CPU)',
  chipset: 'Chipset',
  cpu_speed: 'Tốc độ CPU',
  ram: 'Bộ nhớ (RAM)',
  ram_type: 'Loại RAM',
  ram_max: 'Hỗ trợ tối đa RAM',
  gpu: 'Đồ họa (GPU)',
  graphics: 'Đồ họa (GPU)',
  graphic_card: 'Card rời',
  storage: 'Dung lượng (Storage)',
  hard_drive: 'Ổ cứng/Lưu trữ',
  rom: 'Bộ nhớ trong (ROM)',
  display: 'Màn hình',
  screen: 'Màn hình',
  display_tech: 'Công nghệ màn hình',
  resolution: 'Độ phân giải',
  refresh_rate: 'Tần số quét',
  brightness: 'Độ sáng',
  battery: 'Dung lượng PIN',
  battery_type: 'Loại PIN',
  charger: 'Công nghệ sạc',
  charging_port: 'Cổng sạc',
  charging_tech: 'Công nghệ sạc',
  charging_speed: 'Tốc độ sạc',
  os: 'Hệ điều hành',
  operating_system: 'Hệ điều hành',
  weight: 'Trọng lượng',
  weight_kg: 'Trọng lượng (kg)',
  dimensions: 'Kích thước',
  dimensions_w: 'Chiều rộng',
  dimensions_h: 'Chiều cao',
  dimensions_d: 'Chiều dày',
  dimensions_weight: 'Kích thước & Trọng lượng',
  camera: 'Hệ thống Camera',
  front_camera: 'Camera trước',
  rear_camera: 'Camera sau',
  rear_camera_features: 'Tính năng camera',
  video: 'Quay phim',
  webcam: 'Webcam/Camera',
  network: 'Kết nối mạng',
  mobile_network: 'Hỗ trợ mạng di động',
  sim: 'Loại SIM',
  connectivity: 'Kết nối không dây',
  wifi: 'Wi-Fi',
  bluetooth: 'Bluetooth',
  gps: 'Định vị GPS',
  port: 'Cổng kết nối',
  ports: 'Cổng kết nối',
  audio_jack: 'Cổng tai nghe 3.5mm',
  audio: 'Công nghệ âm thanh',
  material: 'Chất liệu thiết kế',
  build_material: 'Chất liệu vỏ',
  color: 'Màu sắc',
  special_features: 'Tính năng đặc biệt',
  release_year: 'Năm ra mắt',
  warranty: 'Chế độ bảo hành',
  card_reader: 'Khe cắm thẻ nhớ',
  keyboard_backlight: 'Đèn bàn phím',
  security: 'Tính năng bảo mật',
  cooling_system: 'Hệ thống tản nhiệt',
  panel_type: 'Loại tấm nền',
  contrast_ratio: 'Tỷ lệ tương phản',
  color_gamut: 'Độ phủ màu',
  keyboard: 'Bàn phím',
  touchpad: 'Bàn di chuột (Touchpad)',
  speaker: 'Loa/Âm thanh',
  microphone: 'Microphone',
  warranty_info: 'Thông tin bảo hành',
  accessories: 'Phụ kiện đi kèm',
  made_in: 'Xuất xứ',
  brand_origin: 'Thương hiệu của',
  back_camera: 'Camera sau',
  front_camera_features: 'Tính năng camera trước',
  display_specs: 'Thông số màn hình',
  processor_chipset: 'Vi xử lý (Chipset)',
  graphics_processor: 'Đồ họa (GPU)',
  ram_capacity: 'Bộ nhớ (RAM)',
  storage_capacity: 'Dung lượng (Storage)',
  network_connectivity: 'Kết nối mạng/Không dây',
  sim_slots: 'Khe cắm SIM',
  other_features: 'Tiện ích khác',
};

const transformSpecs = (specs: any, attributes: any = {}) => {
  let mergedSpecs: Record<string, any> = {};

  // 1. Recover from array format if exists (mostly for base specifications)
  if (Array.isArray(specs)) {
    specs.forEach(s => {
      if (s && s.name) {
        mergedSpecs[s.name] = s.value;
      }
    });
  } else if (typeof specs === 'object' && specs !== null) {
    mergedSpecs = { ...specs };
  }

  // 2. Merge attributes (especially for variants)
  // Check if attributes is a plain object (not an array/association)
  if (typeof attributes === 'object' && attributes !== null && !Array.isArray(attributes)) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (!mergedSpecs[key]) {
        mergedSpecs[key] = value;
      }
    });
  }

  // 3. Transform to array and localize
  return Object.entries(mergedSpecs).map(([name, value]) => ({
    name: specMapping[name.toLowerCase()] || name,
    value: String(value),
  }));
};

/**
 * Transform a single product from backend format to frontend format
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
    // Ensure variants and attributes are passed through, normalizing attributes.values to array
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
    
    // Transform specifications (ROOT level)
    productSpecifications: transformSpecs(product.specifications, product.attributes_object || product.attributes),
    
    // Handle current variant if exists
    currentVariant: product.currentVariant ? {
      ...product.currentVariant,
      // If the backend already merged specs into variant, use them.
      // Otherwise merge variant attributes here.
      productSpecifications: transformSpecs(product.currentVariant.specifications || product.specifications, product.currentVariant.attributes),
    } : null,
  };
};

/**
 * Transform an array of products
 */
export const transformProducts = (
  products: RawProduct[]
): TransformedProduct[] => {
  if (!Array.isArray(products)) return [];
  return products.map(transformProduct);
};

/**
 * Transform API response with products array
 */
export const transformProductsResponse = (response: any): any => {
  if (!response?.data) return response;

  // Handle array response (e.g., featured products)
  if (Array.isArray(response.data)) {
    return {
      ...response,
      data: transformProducts(response.data),
    };
  }

  // Handle paginated response
  if (response.data.products && Array.isArray(response.data.products)) {
    return {
      ...response,
      data: {
        ...response.data,
        products: transformProducts(response.data.products),
      },
    };
  }

  // Handle single product response
  if (response.data.id) {
    return {
      ...response,
      data: transformProduct(response.data),
    };
  }

  return response;
};

/**
 * Create URL search params from filters
 */
export const createProductFiltersParams = (
  filters: any = {}
): URLSearchParams => {
  const params = new URLSearchParams();

  // Basic filters
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.categoryId) params.append('category', filters.categoryId);
  if (filters.search) params.append('search', filters.search);
  if (filters.minPrice !== undefined)
    params.append('minPrice', filters.minPrice.toString());
  if (filters.maxPrice !== undefined)
    params.append('maxPrice', filters.maxPrice.toString());

  // Default to active products
  if (filters.status !== undefined) {
    params.append('status', filters.status);
  } else {
    params.append('status', 'active');
  }

  // Array filters
  const arrayFilters = ['brand', 'collection', 'color', 'size'];
  arrayFilters.forEach((filter) => {
    if (filters[filter] && Array.isArray(filters[filter])) {
      filters[filter].forEach((value: string) => {
        params.append(filter, value);
      });
    }
  });

  // Dynamic attribute filters
  Object.keys(filters).forEach((key) => {
    if (key.startsWith('attr_') && Array.isArray(filters[key])) {
      filters[key].forEach((value: string) => {
        params.append(key, value);
      });
    }
  });

  // Sorting
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
 * Generate provide tags for RTK Query caching
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

  if (result.data.products && Array.isArray(result.data.products)) {
    return [
      ...result.data.products.map(({ id }: any) => ({
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
