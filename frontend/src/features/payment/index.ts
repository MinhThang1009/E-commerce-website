// Barrel export feature payment — public surface
// Sau Phase 42 (Modular Monolith), code ngoài feature import qua barrel này
// thay vì deep import từ subfolders để giảm coupling.

// Components
export { default as StripePaymentForm } from './components/StripePaymentForm';
export { default as BankTransferQR } from './components/BankTransferQR';

// Trang
export { default as PaymentQRPage } from './pages/PaymentQRPage';

// Context
export { default as StripeProvider } from './contexts/StripeContext';

// API endpoints (RTK Query)
export * from './api/momoApi';
export * from './api/stripeApi';
export * from './api/vnpayApi';
