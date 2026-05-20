/**
 * @file index.ts
 * @layer Barrel
 * @feature admin
 * @description Public API exports cho feature admin
 *
 * Admin pages theo domain (feature-based):
 *   - Dashboard, Users, Discount, Inventory, Warranty → features/admin/pages/
 *   - Products, Categories, Brands, Collections      → features/catalog/pages/admin/
 *   - News, Banners, Email Campaigns                 → features/content/pages/admin/
 *   - Orders                                         → features/orders/pages/admin/
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
export * from './api/warranty-api';
