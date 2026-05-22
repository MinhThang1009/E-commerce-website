/**
 * @file index.ts
 * @layer Barrel
 * @feature admin
 * @description Public API exports cho feature admin
 *
 * Tất cả admin pages nằm trong features/admin/pages/<domain>/:
 *   - features/admin/pages/          → Dashboard, Users, Inventory, DiscountCodes
 *   - features/admin/pages/catalog/  → Products, Categories, Brands
 *   - features/admin/pages/content/  → News, Banners
 *   - features/admin/pages/orders/   → OrdersPage
 */
// Barrel export feature admin — public surface

// Components
export { default as AdminLayout } from './components/AdminLayout';
export { default as CreateProductForm } from './components/CreateProductForm';
export { default as DashboardCharts } from './components/DashboardCharts';
export { default as ProductExportModal } from './components/ProductExportModal';

// API endpoints (TanStack Query)
export * from './api/admin-dashboard-api';
export * from './api/admin-order-api';
export * from './api/admin-product-api';
export * from './api/admin-user-api';
export * from './api/discount-code-api';
