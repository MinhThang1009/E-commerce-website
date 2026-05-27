/**
 * @file index.ts
 * @layer Barrel
 * @feature checkout
 * @description Public API exports cho feature checkout
 */
// Barrel export feature checkout — public surface
// Checkout flow gộp cart → addresses → payment, dùng nhiều cross-feature
// (cart, payment, orders, catalog) nên feature này chủ yếu là 1 page
// orchestrator + small helper. State chính của checkout (cart) ở features/cart;
// payment flow ở features/payment; orders flow ở features/orders.

export { default as CheckoutPage } from './pages/CheckoutPage';
export { default as CheckoutOrderSummary } from './components/CheckoutOrderSummary';
export { default as CheckoutPaymentMethod } from './components/CheckoutPaymentMethod';
export { default as CheckoutShippingForm } from './components/CheckoutShippingForm';
