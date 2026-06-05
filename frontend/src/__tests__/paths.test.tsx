/**
 * paths.test.tsx — test buildRoute helpers (dynamic route builders).
 * Phủ 14 hàm buildRoute trong routes/paths.ts (trước đây 13% — chỉ định nghĩa, chưa gọi).
 * Assert OUTPUT string thật (gồm encodeURIComponent) — không tautological.
 * (.tsx vì jest project 'components' dùng ts-jest; file thuần logic, không render component.)
 */
import { buildRoute } from '@/routes/paths';

describe('buildRoute — dynamic route builders', () => {
  it('productDetail: chấp nhận number và string', () => {
    expect(buildRoute.productDetail(123)).toBe('/products/123');
    expect(buildRoute.productDetail('slug-abc')).toBe('/products/slug-abc');
  });

  it('category: ghép slug', () => {
    expect(buildRoute.category('dien-thoai')).toBe('/categories/dien-thoai');
  });

  it('shopSearch: encode query (space, ký tự đặc biệt)', () => {
    expect(buildRoute.shopSearch('iphone 15 pro')).toBe('/shop?search=iphone%2015%20pro');
    expect(buildRoute.shopSearch('a&b')).toBe('/shop?search=a%26b');
  });

  it('shopCategory: KHÔNG encode (slug đã an toàn)', () => {
    expect(buildRoute.shopCategory('laptop')).toBe('/shop?category=laptop');
  });

  it('shopBrand: number', () => {
    expect(buildRoute.shopBrand(5)).toBe('/shop?brand=5');
  });

  it('verifyEmail: có email → encode query; không/empty → path trần', () => {
    expect(buildRoute.verifyEmail('user@example.com')).toBe(
      '/verify-email?email=user%40example.com',
    );
    expect(buildRoute.verifyEmail()).toBe('/verify-email');
    expect(buildRoute.verifyEmail('')).toBe('/verify-email'); // empty string → falsy → path trần
  });

  it('paymentQr: 3 query param', () => {
    expect(buildRoute.paymentQr(1, 50000, 'ORD-20260605-1')).toBe(
      '/payment-qr?orderId=1&amount=50000&numberOrder=ORD-20260605-1',
    );
  });

  it('checkoutRepay: repayOrder + amount', () => {
    expect(buildRoute.checkoutRepay(2, 99000)).toBe('/checkout?repayOrder=2&amount=99000');
  });

  it('admin builders', () => {
    expect(buildRoute.adminProductEdit(7)).toBe('/admin/products/edit/7');
    expect(buildRoute.adminUserDetail(8)).toBe('/admin/users/8');
    expect(buildRoute.adminOrderDetail(9)).toBe('/admin/orders/9');
    expect(buildRoute.adminOrdersPending()).toBe('/admin/orders?status=pending');
    expect(buildRoute.adminProductDetail(10)).toBe('/admin/products/10');
  });
});
