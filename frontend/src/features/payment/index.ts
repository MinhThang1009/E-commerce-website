/**
 * @file index.ts
 * @layer Barrel
 * @feature payment
 * @description Public API exports cho feature payment
 */
// Barrel export feature payment — public surface
// Sau Phase 42 (Modular Monolith), code ngoài feature import qua barrel này
// thay vì deep import từ subfolders để giảm coupling.

// Trang
export { default as PaymentQRPage } from './pages/PaymentQRPage';

// API hooks (TanStack Query)
export { useCreateMomoUrlMutation } from './api/momo-api';
export { useCreateVNPayUrlMutation } from './api/vnpay-api';
