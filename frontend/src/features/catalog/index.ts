/**
 * @file index.ts
 * @layer Barrel
 * @feature catalog
 * @description Public API exports cho feature catalog
 */
// Barrel export feature catalog — public surface
// Sau Phase 42 (Modular Monolith), code ngoài feature import qua barrel này
// thay vì deep import từ subfolders để giảm coupling.

// Components UI dùng phổ biến (các component lớn khác giữ ở components/, import deep nội bộ)
// Type ProductFilters trùng tên component nên export component dạng alias để tránh đụng
export { default as ProductGrid } from './components/ProductGrid';
export { default as ProductFiltersComponent } from './components/ProductFilters';
export { default as ProductGallery } from './components/ProductGallery';
export { default as ProductCategoryForm } from './components/ProductCategoryForm';
export { default as ProductPrice } from './components/ProductPrice';
export { default as ProductImageGallery } from './components/ProductImageGallery';
export { default as ProductVariantSelector } from './components/ProductVariantSelector';
export { default as RecentlyViewedProducts } from './components/RecentlyViewedProducts';

// Hooks
export { useProductAttributes } from './hooks/use-product-attributes';
export { useProductForm } from './hooks/use-product-form';
export { useProductPriceRange } from './hooks/use-product-price-range';
export { useProductVariants } from './hooks/use-product-variants';

// API hooks — Product
export {
  useGetProductsQuery,
  useGetProductByIdQuery,
  useGetProductBySlugQuery,
  useGetFeaturedProductsQuery,
  useGetNewArrivalsQuery,
  useGetBestSellersQuery,
  useGetDealsQuery,
  useGetRelatedProductsQuery,
  useGetProductVariantsQuery,
  useGetProductReviewsSummaryQuery,
  useSearchProductsQuery,
  useGetProductFiltersQuery,
  useGetRecentlyViewedQuery,
} from './api/product-api';

// API hooks — Category
export {
  useGetAllCategoriesQuery,
  useGetCategoryTreeQuery,
  useGetCategoryByIdQuery,
  useGetCategoryBySlugQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useGetProductsByCategoryQuery,
  useGetFeaturedCategoriesQuery,
  useGetCategoriesQuery,
} from './api/category-api';

// API hooks — Brand
export {
  useGetBrandsQuery,
  useGetBrandBySlugQuery,
  useGetProductsByBrandQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeleteBrandMutation,
} from './api/brand-api';

// API hooks — Collection
export {
  useGetCollectionsQuery,
  useGetCollectionBySlugQuery,
  useGetProductsByCollectionQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
} from './api/collection-api';

// API endpoints — Attribute (raw service, không phải TanStack Query hook)
export { default as attributeApi } from './api/attribute-api';

// API endpoints — Search History
export {
  useSaveSearchMutation,
  useGetSearchHistoryQuery,
  useDeleteSearchHistoryMutation,
  useClearAllSearchHistoryMutation,
} from './api/search-history-api';

// Kiểu dữ liệu
export type {
  Product,
  FAQ,
  ProductVariant,
  ProductAttribute,
  WarrantyPackage,
  ProductsResponse,
  ProductFilters,
  ProductFormData,
  ProductVariantFormData,
  ProductSpecification,
  ProductListApiResponse,
  ProductDetailApiResponse,
  ProductArrayApiResponse,
  ProductWithVariants,
} from './types/product.types';
export type { Category } from './types/category.types';

export { default as ProductCard } from './components/ProductCard';
export { default as ProductListCard } from './components/ProductListCard';
export { default as FilterPanel } from './components/FilterPanel';
