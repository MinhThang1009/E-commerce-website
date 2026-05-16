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
export { useProductAttributes } from './hooks/useProductAttributes';
export { useProductForm } from './hooks/useProductForm';
export { useProductPriceRange } from './hooks/useProductPriceRange';
export { useProductVariants } from './hooks/useProductVariants';

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
} from './api/productApi';

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
} from './api/categoryApi';

// API hooks — Brand
export {
  useGetBrandsQuery,
  useGetBrandBySlugQuery,
  useGetProductsByBrandQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeleteBrandMutation,
} from './api/brandApi';

// API hooks — Collection
export {
  useGetCollectionsQuery,
  useGetCollectionBySlugQuery,
  useGetProductsByCollectionQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
} from './api/collectionApi';

// API endpoints — Attribute (raw service, không phải TanStack Query hook)
export { default as attributeApi } from './api/attributeApi';

// API endpoints — Search History
export {
  useSaveSearchMutation,
  useGetSearchHistoryQuery,
  useDeleteSearchHistoryMutation,
  useClearAllSearchHistoryMutation,
} from './api/searchHistoryApi';

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
