/**
 * @file category.types.ts
 * @layer Type
 * @feature catalog
 * @description TypeScript type definitions cho feature catalog
 */
// Kiểu dữ liệu danh mục
// DB có: id, name_vi, name_en, slug, description_vi, description_en, is_active, sort_order, deleted_at, created_at, updated_at.
// Field image/level chưa tồn tại trong DB — giữ optional.
export interface Category {
  id: string;
  name: string;
  nameVi?: string;
  nameEn?: string;
  slug: string;
  description?: string;
  descriptionVi?: string;
  descriptionEn?: string;
  image?: string;
  parentId?: string | null;
  level?: number;
  isActive?: boolean;
  sortOrder?: number;
  children?: Category[];
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoriesResponse {
  categories: Category[];
  total: number;
}

export interface CategoryFilters {
  parentId?: string;
  isActive?: boolean;
  search?: string;
}
