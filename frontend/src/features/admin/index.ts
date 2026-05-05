// Barrel export feature admin — public surface
// Bao gồm các trang admin cross-cutting và các API admin (dashboard, order admin,
// product admin, user admin, discount code, warranty package).

// Components
export { default as AdminLayout } from './components/AdminLayout';
export { default as CreateProductForm } from './components/CreateProductForm';
export { default as DashboardCharts } from './components/DashboardCharts';
export { default as ProductExportModal } from './components/ProductExportModal';

// API endpoints (RTK Query)
export * from './api/adminDashboardApi';
export * from './api/adminOrderApi';
export * from './api/adminProductApi';
export * from './api/adminUserApi';
export * from './api/discountCodeApi';
export * from './api/warrantyApi';
