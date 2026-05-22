import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { AdminLayout } from '@/features/admin';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { ProtectedRoute, PublicOnlyRoute, AdminRoute } from '@/features/auth';
import { ROUTES } from '@/routes/paths';

// Các trang được tải theo yêu cầu (lazy-loaded)
const HomePage = lazy(() => import('@/pages/HomePage'));
// Trang catalog (BE module catalog) — deep import giữ code splitting riêng từng page
const ShopPage = lazy(() => import('@/features/catalog/pages/ShopPage'));
const ProductDetailPage = lazy(() => import('@/features/catalog/pages/ProductDetailPage'));
const CartPage = lazy(() => import('@/features/cart/pages/CartPage'));
const CheckoutPage = lazy(() => import('@/features/checkout/pages/CheckoutPage'));
// Trang xác thực — deep import giữ code splitting riêng từng page
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/features/auth/pages/VerifyEmailPage'));
const ProfilePage = lazy(() => import('@/features/users/pages/ProfilePage'));
const OrdersPage = lazy(() => import('@/features/orders/pages/OrdersPage'));
const WishlistPage = lazy(() => import('@/features/wishlist/pages/WishlistPage'));
const CategoriesPage = lazy(() => import('@/features/catalog/pages/CategoriesPage'));
const CategoryPage = lazy(() => import('@/features/catalog/pages/CategoryPage'));
const BrandsPage = lazy(() => import('@/features/catalog/pages/BrandsPage'));
const DealsPage = lazy(() => import('@/features/catalog/pages/DealsPage'));
const NewArrivalsPage = lazy(() => import('@/features/catalog/pages/NewArrivalsPage'));
const BestSellersPage = lazy(() => import('@/features/catalog/pages/BestSellersPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const ContactPage = lazy(() => import('@/features/content/pages/ContactPage'));
const FAQsPage = lazy(() => import('@/pages/FAQsPage'));
const ShippingReturnsPage = lazy(() => import('@/pages/ShippingReturnsPage'));
const TrackOrderPage = lazy(() => import('@/features/orders/pages/TrackOrderPage'));
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));

// Các trang dành cho Admin
const AdminDashboardPage = lazy(() => import('@/features/admin/pages/DashboardPage'));
const AdminProductsPage = lazy(() => import('@/features/admin/pages/catalog/ProductsPage'));
const CreateProductPage = lazy(() => import('@/features/admin/pages/catalog/CreateProductPage'));
const EditProductPage = lazy(() => import('@/features/admin/pages/catalog/EditProductPage'));
const AdminOrdersPage = lazy(() => import('@/features/admin/pages/orders/OrdersPage'));
const AdminUsersPage = lazy(() => import('@/features/admin/pages/UsersPage'));
const AdminUserDetailPage = lazy(() => import('@/features/admin/pages/UserDetailPage'));
const AdminCategoriesPage = lazy(() => import('@/features/admin/pages/catalog/CategoriesPage'));
const AdminDiscountCodesPage = lazy(() => import('@/features/admin/pages/DiscountCodesPage'));
const AdminBrandsPage = lazy(() => import('@/features/admin/pages/catalog/BrandsPage'));
const AdminInventoryPage = lazy(() => import('@/features/admin/pages/InventoryPage'));

const PaymentQRPage = lazy(() => import('@/features/payment/pages/PaymentQRPage'));

// Các trang lỗi
const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        {/* Routes dùng layout chính */}
        <Route path="/" element={<MainLayout />}>
          {/* Routes công khai */}
          <Route index element={<HomePage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="products/:productId" element={<ProductDetailPage />} />
          <Route path="cart" element={<CartPage />} />

          {/* Trang danh mục */}
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="categories/:slug" element={<CategoryPage />} />

          {/* Trang thương hiệu */}
          <Route path="brands" element={<BrandsPage />} />

          {/* Các mục trong cửa hàng */}
          <Route path="deals" element={<DealsPage />} />
          <Route path="new-arrivals" element={<NewArrivalsPage />} />
          <Route path="best-sellers" element={<BestSellersPage />} />

          {/* Trang tĩnh */}
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="faqs" element={<FAQsPage />} />
          <Route path="shipping-returns" element={<ShippingReturnsPage />} />
          <Route path="track-order" element={<TrackOrderPage />} />
          <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="terms" element={<TermsPage />} />
          {/* Routes chỉ dành cho khách (chuyển hướng về trang chủ nếu đã đăng nhập) */}
          <Route
            path="login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPasswordPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="reset-password"
            element={
              <PublicOnlyRoute>
                <ResetPasswordPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="verify-email/:token" element={<VerifyEmailPage />} />

          {/* Routes được bảo vệ (yêu cầu đăng nhập) */}
          <Route
            path="checkout"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="checkout/payment"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="payment-qr"
            element={
              <ProtectedRoute>
                <PaymentQRPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders"
            element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="wishlist"
            element={
              <ProtectedRoute>
                <WishlistPage />
              </ProtectedRoute>
            }
          />

          {/* Trang lỗi */}
          <Route path="unauthorized" element={<UnauthorizedPage />} />

          {/* Route 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Routes admin */}
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to={ROUTES.ADMIN_DASHBOARD} replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          {/* Quản lý sản phẩm */}
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/create" element={<CreateProductPage />} />
          <Route path="products/edit/:id" element={<EditProductPage />} />
          {/* Các mục admin khác */}
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:id" element={<AdminUserDetailPage />} />{' '}
          <Route path="discount-codes" element={<AdminDiscountCodesPage />} />
          <Route path="brands" element={<AdminBrandsPage />} />
          <Route path="inventory" element={<AdminInventoryPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
