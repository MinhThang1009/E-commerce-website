// Các kiểu dữ liệu sản phẩm
export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  thumbnail: string;
  images: string[];
  description: string;
  shortDescription?: string;
  categoryId: string;
  categoryName: string;
  stock: number;
  ratings?: {
    average: number;
    count: number;
  };
  attributes?: ProductAttribute[];
  variants?: ProductVariant[];
  isNew?: boolean;
  isFeatured?: boolean;
  // Các trường mới dành riêng cho laptop
  brand?: string;
  model?: string;
  condition?: 'new' | 'like-new' | 'used' | 'refurbished';
  warrantyMonths?: number;
  specifications?: Record<string, string | number | boolean>;
  warrantyPackages?: WarrantyPackage[];
  faqs?: FAQ[];
  // SEO — có thể null nếu admin chưa điền
  seoTitle?: string | null;
  seoDescription?: string | null;
  createdAt: string;
  updatedAt: string;
  // Fields added by transformProduct at runtime
  categorySlug?: string;
  category?: { id: string; name: string; slug?: string };
  productSpecifications?: Array<{ name: string; value: string }>;
  discountPercentage?: number;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  attributes: Record<string, string>;
  images?: string[];
  // Các trường mới
  displayName?: string;
  sortOrder?: number;
  isDefault?: boolean;
  isAvailable?: boolean;
  stock?: number; // alias cho stockQuantity
  compareAtPrice?: number | null;
  specifications?: Record<string, string | number | boolean>;
}

export interface ProductAttribute {
  id: string;
  productId: string;
  name: string;
  values: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WarrantyPackage {
  id: string;
  name: string;
  description?: string;
  durationMonths: number;
  price: number;
  terms?: Record<string, string | number | boolean>;
  coverage?: string[];
  isActive?: boolean;
  sortOrder?: number;
  productWarranty?: {
    isDefault: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductFilters {
  categoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  page?: number;
  limit?: number;
  brand?: string[];
  color?: string[];
  size?: string[];
  [key: string]: string | string[] | number | boolean | undefined; // Dành cho các filter thuộc tính động
}

// Dữ liệu form để tạo/chỉnh sửa sản phẩm
export interface ProductFormData {
  // Thông tin cơ bản
  name: string;
  baseName?: string;
  description: string;
  shortDescription: string;

  // Giá (dành cho sản phẩm không có biến thể)
  price?: number;
  compareAtPrice?: number;

  // Tồn kho (dành cho sản phẩm không có biến thể)
  stockQuantity?: number;

  // Hình ảnh/Media
  images: string[];

  // Danh mục
  categoryIds: string[];

  // Cài đặt sản phẩm
  status: 'active' | 'inactive' | 'draft';
  featured: boolean;
  condition: 'new' | 'like-new' | 'used' | 'refurbished';

  // SEO (tối ưu tìm kiếm)
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];

  // Thông số kỹ thuật
  specifications?: ProductSpecification[];

  // Thuộc tính & Biến thể
  attributes?: ProductAttribute[];
  variants?: ProductVariantFormData[];

  // Bảo hành
  warrantyMonths?: number;
  warrantyPackageIds?: string[];

  // Câu hỏi thường gặp
  faqs?: FAQ[];

  // Cờ đánh dấu sản phẩm có biến thể
  isVariantProduct?: boolean;
}

export interface ProductVariantFormData {
  id?: string;
  name: string;
  variantName?: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  stockQuantity: number;
  stock?: number; // alias cho stockQuantity
  isDefault?: boolean;
  isAvailable?: boolean;
  attributes?: Record<string, string>;
  attributeValues?: Record<string, string>;
  specifications?: Record<string, string | number | boolean>;
  images?: string[];
  displayName?: string;
  sortOrder?: number;
}

export interface ProductSpecification {
  id?: string;
  name: string;
  value: string;
  category?: string;
  sortOrder?: number;
}

export interface ProductListApiResponse {
  status: string;
  data: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductDetailApiResponse {
  status: string;
  data: ProductWithVariants;
}

export interface ProductArrayApiResponse {
  status: string;
  data: Product[];
}

// Interface Product nâng cao hỗ trợ biến thể
export interface ProductWithVariants extends Product {
  baseName?: string;
  isVariantProduct?: boolean;
  currentVariant?: {
    id: string;
    name: string;
    fullName: string;
    price: number;
    compareAtPrice?: number;
    sku: string;
    stockQuantity: number;
    specifications?: Record<string, string | number | boolean>;
    images: string[];
    attributes?: Record<string, string>;
    thumbnail?: string;
    productSpecifications?: Array<{ name: string; value: string }>;
  };
  availableVariants?: Array<{
    id: string;
    name: string;
    price: number;
    compareAtPrice?: number;
    stockQuantity: number;
    isDefault: boolean;
    sku: string;
  }>;
}

